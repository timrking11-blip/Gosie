const { pool } = require('./db');
const { token, hasCsrf, isCommunityOperator } = require('./security');
const { handleOrganizationAccess } = require('./organization-access');
const { pendingReReviews, decideReReview } = require('./organization-rereview');
const organizationRoles = new Set(['restaurant-owner', 'venue', 'municipality', 'nonprofit']);

const iso = (value) => value ? new Date(value).toISOString() : null;
// Opt in only for the contributor's own records or the moderator queue.
// Public serializers deliberately never include review reasons or identities.
const privateReview = (row) => ({ decisionReason: row.decision_reason || null });
function mapComment(row) {
  return { id: row.id, itemId: row.item_id, text: row.body, attribution: row.attribution,
    status: row.status, createdAt: iso(row.created_at), reviewedAt: iso(row.reviewed_at) };
}
function mapItem(row, comments = []) {
  const expired = row.kind === 'event' && new Date(row.ends_at).getTime() <= Date.now();
  return {
    id: row.id, kind: row.kind, title: row.title, description: row.description,
    location: row.location, attribution: row.attribution, sourceUrl: row.source_url,
    startsAt: iso(row.starts_at), endsAt: iso(row.ends_at), status: row.status,
    createdAt: iso(row.created_at), reviewedAt: iso(row.reviewed_at), expired, comments,
    why: row.kind === 'gem'
      ? 'An approved community hidden gem. Evergreen discovery, not a scheduled event. Opening hours and availability are not verified.'
      : 'An approved community event with contributor-supplied dates. Confirm details with the source; approval is not a guarantee of availability.',
  };
}
function validDateTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value)) && value.slice(0, 10) === new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10);
}
function validateDraft(body) {
  const allowed = new Set(['kind', 'title', 'description', 'location', 'attribution', 'sourceUrl', 'startsAt', 'endsAt']);
  if (Object.keys(body).some((key) => !allowed.has(key))) return 'unsupported_field';
  if (!['event', 'gem'].includes(body.kind)) return 'invalid_kind';
  for (const [key, max] of [['title', 160], ['description', 2000], ['location', 160], ['attribution', 80]]) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > max) return `invalid_${key}`;
  }
  if (body.sourceUrl) {
    try {
      const url = new URL(body.sourceUrl);
      if (typeof body.sourceUrl !== 'string' || body.sourceUrl.length > 1000 || url.protocol !== 'https:' || url.username || url.password) return 'invalid_source_url';
    } catch { return 'invalid_source_url'; }
  }
  if (body.kind === 'gem') {
    if (body.startsAt || body.endsAt) return 'evergreen_cannot_have_dates';
  } else {
    if (!validDateTime(body.startsAt) || !validDateTime(body.endsAt)) return 'invalid_event_dates';
    if (Date.parse(body.endsAt) <= Date.parse(body.startsAt) || Date.parse(body.endsAt) <= Date.now()) return 'event_must_end_in_future_after_start';
  }
  return null;
}
async function rolesFor(userId, client = pool) {
  if (!userId) return [];
  return (await client.query('SELECT role, restaurant_name, organization_name, access_version FROM gosie_community_roles WHERE user_id=$1 ORDER BY role', [userId])).rows;
}
async function authorWrite(userId, write) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM gosie_users WHERE id=$1 FOR UPDATE', [userId]);
    const result = await write(client, await rolesFor(userId, client));
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function publicItems(includeExpired = false) {
  const items = await pool.query(`SELECT * FROM gosie_community_items WHERE status='approved'
    ${includeExpired ? '' : "AND (kind='gem' OR ends_at > NOW())"} ORDER BY starts_at NULLS LAST, created_at DESC`);
  const comments = await pool.query(`SELECT c.* FROM gosie_community_comments c
    JOIN gosie_community_items i ON i.id=c.item_id
    WHERE c.status='approved' AND i.status='approved' ORDER BY c.created_at`);
  return items.rows.map((row) => mapItem(row, comments.rows.filter((c) => c.item_id === row.id).map(mapComment)));
}
async function handleCommunity({ req, res, path, url, body, session, send }) {
  if (!path.startsWith('/community')) return false;
  const reply = (status, payload) => { send(res, status, payload); return true; };
  if (req.method === 'GET' && path === '/community/items') {
    return reply(200, { items: await publicItems(url.searchParams.get('includeExpired') === 'true') });
  }
  if (!session) return reply(401, { error: 'unauthorized' });
  if (['POST', 'PATCH', 'DELETE'].includes(req.method) && !hasCsrf(req, session.session)) {
    return reply(403, { error: 'csrf_required' });
  }
  const userId = session.user.id;
  if (path === '/community/organization-access' || path.startsWith('/community/organization-access/')) {
    return handleOrganizationAccess({ req, path, body, userId, reply });
  }
  const grants = await rolesFor(userId);
  const roles = grants.map((grant) => grant.role);
  if (req.method === 'GET' && path === '/community/organization-reviews') {
    if (!roles.includes('moderator')) return reply(403, { error: 'moderator_permission_required' });
    const rows = await pendingReReviews();
    const parentIds = rows.slice(0, 100).filter((row) => row.content_type === 'comments').map((row) => row.record.item_id);
    const parents = parentIds.length
      ? (await pool.query('SELECT * FROM gosie_community_items WHERE id=ANY($1::text[])', [parentIds])).rows : [];
    const parentById = new Map(parents.map((parent) => [parent.id, mapItem(parent)]));
    return reply(200, { truncated: rows.length > 100, reviews: rows.slice(0, 100).map((row) => ({
      revocationId: row.revocation_id, revokedAt: iso(row.revoked_at),
      organizationType: row.organization_type, publicIdentity: row.public_identity,
      contentType: row.content_type, basis: row.basis, canReview: row.author_id !== userId,
      content: row.content_type === 'items' ? mapItem(row.record) : mapComment(row.record),
      ...(row.content_type === 'comments' ? { parent: parentById.get(row.record.item_id) || null } : {}),
    })) });
  }
  const reReview = path.match(/^\/community\/organization-reviews\/([^/]+)\/(items|comments)\/([^/]+)$/);
  if (req.method === 'POST' && reReview) {
    if (!roles.includes('moderator')) return reply(403, { error: 'moderator_permission_required' });
    const [status, payload] = await decideReReview({ userId, revocationId: reReview[1], kind: reReview[2], id: reReview[3], body });
    return reply(status, payload);
  }
  if (req.method === 'GET' && path === '/community/mine') {
    const [items, comments] = await Promise.all([
      pool.query('SELECT * FROM gosie_community_items WHERE user_id=$1 ORDER BY created_at DESC', [userId]),
      pool.query('SELECT * FROM gosie_community_comments WHERE user_id=$1 ORDER BY created_at DESC', [userId]),
    ]);
    return reply(200, { roles, isOperator: await isCommunityOperator(userId),
      items: items.rows.map((row) => ({ ...mapItem(row), ...privateReview(row) })),
      comments: comments.rows.map((row) => ({ ...mapComment(row), ...privateReview(row) })) });
  }
  if (req.method === 'POST' && path === '/community/items') {
    const invalid = validateDraft(body);
    if (invalid) return reply(400, { error: invalid });
    const [status, payload] = await authorWrite(userId, async (client, currentGrants) => {
      const organization = currentGrants.find((grant) => organizationRoles.has(grant.role));
      if (!currentGrants.some((grant) => grant.role === 'contributor') && !organization) return [403, { error: 'contributor_permission_required' }];
      const result = await client.query(`INSERT INTO gosie_community_items
      (id,user_id,kind,title,description,location,attribution,source_url,starts_at,ends_at,organization_role,organization_access_version)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [`community-${token(12)}`, userId, body.kind, body.title.trim(), body.description.trim(),
      body.location.trim(), organization ? (organization.organization_name || organization.restaurant_name) : body.attribution.trim(), body.sourceUrl || null,
      body.kind === 'event' ? body.startsAt : null, body.kind === 'event' ? body.endsAt : null,
      organization?.role || 'individual', organization?.access_version || null]);
      return [201, { item: mapItem(result.rows[0]) }];
    });
    return reply(status, payload);
  }
  const commentMatch = path.match(/^\/community\/items\/([^/]+)\/comments$/);
  if (req.method === 'POST' && commentMatch) {
    if (Object.keys(body).some((key) => key !== 'text') || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 1000) return reply(400, { error: 'invalid_comment' });
    const [status, payload] = await authorWrite(userId, async (client, currentGrants) => {
      const owner = currentGrants.find((grant) => organizationRoles.has(grant.role));
      if (!owner) return [403, { error: 'organization_permission_required' }];
      const result = await client.query(`INSERT INTO gosie_community_comments (id,item_id,user_id,body,attribution,organization_role,organization_access_version)
      SELECT $1,id,$2,$3,$4,$6,$7 FROM gosie_community_items
      WHERE id=$5 AND kind='event' AND status='approved' AND ends_at>NOW() RETURNING *`,
    [`comment-${token(12)}`, userId, body.text.trim(), owner.organization_name || owner.restaurant_name, commentMatch[1], owner.role, owner.access_version]);
      return result.rowCount ? [201, { comment: mapComment(result.rows[0]) }] : [404, { error: 'current_approved_event_not_found' }];
    });
    return reply(status, payload);
  }
  if (req.method === 'GET' && path === '/community/moderation') {
    if (!roles.includes('moderator')) return reply(403, { error: 'moderator_permission_required' });
    const [items, comments] = await Promise.all([
      pool.query("SELECT * FROM gosie_community_items WHERE status='pending' ORDER BY created_at"),
      pool.query("SELECT * FROM gosie_community_comments WHERE status='pending' ORDER BY created_at"),
    ]);
    return reply(200, {
      items: items.rows.map((row) => ({ ...mapItem(row), ...privateReview(row), canReview: row.user_id !== userId })),
      comments: comments.rows.map((row) => ({ ...mapComment(row), ...privateReview(row), canReview: row.user_id !== userId })),
    });
  }
  const moderationMatch = path.match(/^\/community\/moderation\/(items|comments)\/([^/]+)$/);
  if (req.method === 'POST' && moderationMatch) {
    if (!roles.includes('moderator')) return reply(403, { error: 'moderator_permission_required' });
    if (Object.keys(body).some((key) => !['decision', 'decisionReason'].includes(key)) || !['approved', 'rejected'].includes(body.decision)) return reply(400, { error: 'invalid_decision' });
    if (typeof body.decisionReason !== 'string' || body.decisionReason.length > 1000 || body.decisionReason.trim().length < 10) {
      return reply(400, { error: 'decision_reason_required_10_to_1000_characters' });
    }
    // Table names come only from the fixed regex above, never a user SQL fragment.
    const table = moderationMatch[1] === 'items' ? 'gosie_community_items' : 'gosie_community_comments';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const author = (await client.query(`SELECT user_id FROM ${table} WHERE id=$1`, [moderationMatch[2]])).rows[0];
      if (author) await client.query('SELECT id FROM gosie_users WHERE id=$1 FOR UPDATE', [author.user_id]);
      const selected = await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [moderationMatch[2]]);
      const row = selected.rows[0];
      if (!row || row.status !== 'pending') { await client.query('ROLLBACK'); return reply(409, { error: 'pending_record_not_found' }); }
      if (row.user_id === userId) { await client.query('ROLLBACK'); return reply(403, { error: 'cannot_moderate_own_content' }); }
      if ((await pendingReReviews(client, { kind: moderationMatch[1], id: row.id })).length) {
        await client.query('ROLLBACK'); return reply(409, { error: 'organization_re_review_required' });
      }
      if (body.decision === 'approved') {
        if (moderationMatch[1] === 'items' && row.kind === 'event' && new Date(row.ends_at) <= new Date()) {
          await client.query('ROLLBACK'); return reply(409, { error: 'event_expired' });
        }
        if (moderationMatch[1] === 'comments') {
          const parent = await client.query("SELECT id FROM gosie_community_items WHERE id=$1 AND status='approved' AND kind='event' AND ends_at>NOW()", [row.item_id]);
          if (!parent.rowCount) { await client.query('ROLLBACK'); return reply(409, { error: 'event_no_longer_current' }); }
        }
      }
      await client.query(`UPDATE ${table} SET status=$1,reviewed_by=$2,reviewed_at=NOW(),decision_reason=$4 WHERE id=$3`,
        [body.decision, userId, row.id, body.decisionReason.trim()]);
      await client.query('COMMIT');
      return reply(200, { status: body.decision });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  return reply(404, { error: 'not_found' });
}
module.exports = { handleCommunity, validateDraft };
