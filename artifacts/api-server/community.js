const { pool } = require('./db');
const { token, hasCsrf } = require('./security');

const iso = (value) => value ? new Date(value).toISOString() : null;
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
async function rolesFor(userId) {
  if (!userId) return [];
  return (await pool.query('SELECT role, restaurant_name FROM gosie_community_roles WHERE user_id=$1', [userId])).rows;
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
  const grants = await rolesFor(userId);
  const roles = grants.map((grant) => grant.role);
  if (req.method === 'GET' && path === '/community/mine') {
    const [items, comments] = await Promise.all([
      pool.query('SELECT * FROM gosie_community_items WHERE user_id=$1 ORDER BY created_at DESC', [userId]),
      pool.query('SELECT * FROM gosie_community_comments WHERE user_id=$1 ORDER BY created_at DESC', [userId]),
    ]);
    return reply(200, { roles, items: items.rows.map((row) => mapItem(row)), comments: comments.rows.map(mapComment) });
  }
  if (req.method === 'POST' && path === '/community/items') {
    if (!roles.includes('contributor') && !roles.includes('restaurant-owner')) return reply(403, { error: 'contributor_permission_required' });
    const invalid = validateDraft(body);
    if (invalid) return reply(400, { error: invalid });
    const result = await pool.query(`INSERT INTO gosie_community_items
      (id,user_id,kind,title,description,location,attribution,source_url,starts_at,ends_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [`community-${token(12)}`, userId, body.kind, body.title.trim(), body.description.trim(),
      body.location.trim(), body.attribution.trim(), body.sourceUrl || null,
      body.kind === 'event' ? body.startsAt : null, body.kind === 'event' ? body.endsAt : null]);
    return reply(201, { item: mapItem(result.rows[0]) });
  }
  const commentMatch = path.match(/^\/community\/items\/([^/]+)\/comments$/);
  if (req.method === 'POST' && commentMatch) {
    const owner = grants.find((grant) => grant.role === 'restaurant-owner');
    if (!owner) return reply(403, { error: 'restaurant_owner_permission_required' });
    if (Object.keys(body).some((key) => key !== 'text') || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 1000) return reply(400, { error: 'invalid_comment' });
    const result = await pool.query(`INSERT INTO gosie_community_comments (id,item_id,user_id,body,attribution)
      SELECT $1,id,$2,$3,$4 FROM gosie_community_items
      WHERE id=$5 AND kind='event' AND status='approved' AND ends_at>NOW() RETURNING *`,
    [`comment-${token(12)}`, userId, body.text.trim(), owner.restaurant_name, commentMatch[1]]);
    return result.rowCount ? reply(201, { comment: mapComment(result.rows[0]) }) : reply(404, { error: 'current_approved_event_not_found' });
  }
  if (req.method === 'GET' && path === '/community/moderation') {
    if (!roles.includes('moderator')) return reply(403, { error: 'moderator_permission_required' });
    const [items, comments] = await Promise.all([
      pool.query("SELECT * FROM gosie_community_items WHERE status='pending' ORDER BY created_at"),
      pool.query("SELECT * FROM gosie_community_comments WHERE status='pending' ORDER BY created_at"),
    ]);
    return reply(200, { items: items.rows.map((row) => mapItem(row)), comments: comments.rows.map(mapComment) });
  }
  const moderationMatch = path.match(/^\/community\/moderation\/(items|comments)\/([^/]+)$/);
  if (req.method === 'POST' && moderationMatch) {
    if (!roles.includes('moderator')) return reply(403, { error: 'moderator_permission_required' });
    if (Object.keys(body).some((key) => key !== 'decision') || !['approved', 'rejected'].includes(body.decision)) return reply(400, { error: 'invalid_decision' });
    // Table names come only from the fixed regex above, never a user SQL fragment.
    const table = moderationMatch[1] === 'items' ? 'gosie_community_items' : 'gosie_community_comments';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const selected = await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [moderationMatch[2]]);
      const row = selected.rows[0];
      if (!row || row.status !== 'pending') { await client.query('ROLLBACK'); return reply(409, { error: 'pending_record_not_found' }); }
      if (row.user_id === userId) { await client.query('ROLLBACK'); return reply(403, { error: 'cannot_moderate_own_content' }); }
      if (body.decision === 'approved') {
        if (moderationMatch[1] === 'items' && row.kind === 'event' && new Date(row.ends_at) <= new Date()) {
          await client.query('ROLLBACK'); return reply(409, { error: 'event_expired' });
        }
        if (moderationMatch[1] === 'comments') {
          const parent = await client.query("SELECT id FROM gosie_community_items WHERE id=$1 AND status='approved' AND kind='event' AND ends_at>NOW()", [row.item_id]);
          if (!parent.rowCount) { await client.query('ROLLBACK'); return reply(409, { error: 'event_no_longer_current' }); }
        }
      }
      await client.query(`UPDATE ${table} SET status=$1,reviewed_by=$2,reviewed_at=NOW() WHERE id=$3`, [body.decision, userId, row.id]);
      await client.query('COMMIT');
      return reply(200, { status: body.decision });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  return reply(404, { error: 'not_found' });
}
module.exports = { handleCommunity, validateDraft };
