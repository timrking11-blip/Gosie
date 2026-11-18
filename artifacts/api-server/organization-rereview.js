const { pool } = require('./db');
const { token } = require('./security');

// Fixed identifiers only. Legacy attribution matches are explicitly uncertain.
const sources = {
  items: { table: 'gosie_community_items', key: 'item_id' },
  comments: { table: 'gosie_community_comments', key: 'comment_id' },
};
const candidates = Object.entries(sources).map(([kind, { table, key }]) => `
  SELECT a.id AS revocation_id,a.organization_type,a.public_identity,a.created_at AS revoked_at,
    '${kind}' AS content_type,c.id AS content_id,c.user_id AS author_id,to_jsonb(c) AS record,
    CASE WHEN c.organization_role=a.organization_type AND c.organization_access_version=a.access_version THEN 'recorded-grant'
      ELSE 'legacy-attribution' END AS basis
  FROM gosie_organization_access_reviews a JOIN ${table} c ON c.user_id=a.user_id
  WHERE a.action='revoke' AND c.created_at<=a.created_at AND c.status IN ('pending','approved')
    AND ((c.organization_role=a.organization_type AND c.organization_access_version=a.access_version)
      OR (c.organization_role IS NULL AND c.attribution=a.public_identity))
    AND NOT EXISTS (SELECT 1 FROM gosie_organization_content_reviews r
      WHERE r.revocation_id=a.id AND r.${key}=c.id)`).join(' UNION ALL ');

async function pendingReReviews(client = pool, filter) {
  const params = filter ? [filter.kind, filter.id, filter.revocationId || null] : [];
  const where = filter
    ? 'WHERE content_type=$1 AND content_id=$2 AND ($3::text IS NULL OR revocation_id=$3)' : '';
  return (await client.query(`WITH candidates AS (${candidates}) SELECT * FROM candidates ${where}
    ORDER BY revoked_at,revocation_id,content_type,content_id LIMIT 101`, params)).rows;
}

async function decideReReview({ userId, kind, id, revocationId, body }) {
  if (Object.keys(body).some((key) => !['action', 'reason', 'expectedStatus'].includes(key)) ||
      !['retain', 'hide', 'dismiss'].includes(body.action) || !['pending', 'approved'].includes(body.expectedStatus) ||
      typeof body.reason !== 'string' || body.reason.length > 1000 || body.reason.trim().length < 10) {
    return [400, { error: 'invalid_organization_content_review' }];
  }
  const { table, key } = sources[kind];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const author = (await client.query(`SELECT user_id FROM ${table} WHERE id=$1`, [id])).rows[0];
    if (!author) { await client.query('ROLLBACK'); return [409, { error: 'review_changed_refresh_required' }]; }
    // Same author->content lock order as submission, revocation and moderation.
    await client.query('SELECT id FROM gosie_users WHERE id=$1 FOR UPDATE', [author.user_id]);
    const allowed = await client.query("SELECT user_id FROM gosie_community_roles WHERE user_id=$1 AND role='moderator' FOR SHARE", [userId]);
    if (!allowed.rowCount) { await client.query('ROLLBACK'); return [403, { error: 'moderator_permission_required' }]; }
    if (author.user_id === userId) { await client.query('ROLLBACK'); return [403, { error: 'cannot_moderate_own_content' }]; }
    const row = (await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    const match = (await pendingReReviews(client, { kind, id, revocationId }))[0];
    if (!match || row.status !== body.expectedStatus) {
      await client.query('ROLLBACK'); return [409, { error: 'review_changed_refresh_required' }];
    }
    if (body.action === 'dismiss' && match.basis !== 'legacy-attribution') {
      await client.query('ROLLBACK'); return [400, { error: 'only_uncertain_legacy_matches_can_be_dismissed' }];
    }
    await client.query(`INSERT INTO gosie_organization_content_reviews
      (id,revocation_id,${key},action,reason,before_status,before_decision_reason,reviewed_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [`content-review-${token(12)}`, revocationId, id, body.action, body.reason.trim(), row.status, row.decision_reason, userId]);
    if (body.action === 'hide') {
      // Never publishes. Rejected content (and a parent's nested notes) is private.
      await client.query(`UPDATE ${table} SET status='rejected',decision_reason=$1,reviewed_by=$2,reviewed_at=NOW() WHERE id=$3`,
        [body.reason.trim(), userId, id]);
    }
    await client.query('COMMIT');
    return [200, { action: body.action, status: body.action === 'hide' ? 'rejected' : row.status }];
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

module.exports = { pendingReReviews, decideReReview };
