const { pool } = require('./db');
const { token, isCommunityOperator } = require('./security');
const types = ['restaurant-owner', 'venue', 'municipality', 'nonprofit'];
const base = '/community/organization-access';
function validateAccessReview(body, revoke) {
  if (!body || Array.isArray(body) || typeof body !== 'object') return false;
  const keys = revoke
    ? ['userId', 'organizationType', 'reason', 'accessVersion']
    : ['userId', 'organizationType', 'reason', 'publicIdentity'];
  if (Object.keys(body).some((key) => !keys.includes(key))) return false;
  return typeof body.userId === 'string' && body.userId.trim().length > 0 && body.userId.length <= 200 &&
    types.includes(body.organizationType) &&
    typeof body.reason === 'string' && body.reason.trim().length >= 10 && body.reason.length <= 1000 &&
    (revoke ? typeof body.accessVersion === 'string' && body.accessVersion.length > 0 && body.accessVersion.length <= 100
      : typeof body.publicIdentity === 'string' && body.publicIdentity.trim().length > 0 && body.publicIdentity.length <= 80);
}

// Called only after community session and CSRF guards. Operator status is
// checked again inside the write transaction; no route can appoint operators.
async function handleOrganizationAccess({ req, path, body, userId, reply }) {
  if (path !== base && !path.startsWith(`${base}/`)) return false;
  if (!await isCommunityOperator(userId)) return reply(403, { error: 'operator_permission_required' });
  if (req.method === 'GET' && path === base) {
    const [grants, reviews] = await Promise.all([
      pool.query(`SELECT user_id,role,COALESCE(organization_name,restaurant_name) AS public_identity,access_version
        FROM gosie_community_roles WHERE role=ANY($1::text[]) ORDER BY user_id,role LIMIT 501`, [types]),
      pool.query('SELECT * FROM gosie_organization_access_reviews ORDER BY created_at DESC,id DESC LIMIT 100'),
    ]);
    return reply(200, {
      grants: grants.rows.slice(0, 500).map((row) => ({
        userId: row.user_id, organizationType: row.role, publicIdentity: row.public_identity,
        accessVersion: row.access_version, legacy: row.access_version === 'legacy',
      })),
      truncated: grants.rowCount > 500,
      reviews: reviews.rows.map((row) => ({
        id: row.id, userId: row.user_id, reviewedBy: row.reviewed_by,
        organizationType: row.organization_type, publicIdentity: row.public_identity,
        action: row.action, reason: row.reason, createdAt: row.created_at,
      })),
    });
  }
  const revoke = path === `${base}/revoke`;
  if (req.method !== 'POST' || (path !== base && !revoke)) return reply(404, { error: 'not_found' });
  if (!validateAccessReview(body, revoke)) return reply(400, { error: 'invalid_access_review' });
  if (body.userId === userId) return reply(403, { error: 'cannot_manage_own_organization_access' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Locks serialize decisions for this account, including conflicting types.
    if (!(await client.query('SELECT id FROM gosie_users WHERE id=$1 FOR UPDATE', [body.userId])).rowCount) {
      await client.query('ROLLBACK'); return reply(404, { error: 'existing_account_required' });
    }
    const authorized = await client.query('SELECT user_id FROM gosie_community_operators WHERE user_id=$1 FOR SHARE', [userId]);
    if (!authorized.rowCount) { await client.query('ROLLBACK'); return reply(403, { error: 'operator_permission_required' }); }
    const existing = await client.query(`SELECT * FROM gosie_community_roles
      WHERE user_id=$1 AND role=ANY($2::text[]) FOR UPDATE`, [body.userId, types]);
    let identity = body.publicIdentity?.trim();
    if (revoke) {
      const grant = existing.rows.find((row) => row.role === body.organizationType && row.access_version === body.accessVersion);
      if (!grant) { await client.query('ROLLBACK'); return reply(409, { error: 'access_changed_refresh_required' }); }
      identity = grant.organization_name || grant.restaurant_name;
      await client.query('DELETE FROM gosie_community_roles WHERE user_id=$1 AND role=$2', [body.userId, body.organizationType]);
    } else {
      if (existing.rowCount) { await client.query('ROLLBACK'); return reply(409, { error: 'revoke_existing_organization_first' }); }
      await client.query(`INSERT INTO gosie_community_roles (user_id,role,restaurant_name,organization_name,access_version)
        VALUES ($1,$2,$3,$4,$5)`, [body.userId, body.organizationType,
        body.organizationType === 'restaurant-owner' ? identity : null, identity, token(16)]);
    }
    await client.query(`INSERT INTO gosie_organization_access_reviews
      (id,user_id,reviewed_by,organization_type,public_identity,action,reason) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [`access-${token(12)}`, body.userId, userId, body.organizationType, identity, revoke ? 'revoke' : 'grant', body.reason.trim()]);
    await client.query('COMMIT');
    return reply(revoke ? 200 : 201, { status: revoke ? 'revoked' : 'granted' });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = { handleOrganizationAccess, validateAccessReview };
