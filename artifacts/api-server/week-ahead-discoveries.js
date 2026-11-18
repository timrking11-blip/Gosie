const { pool } = require('./db');
const { hasCsrf, token } = require('./security');

const base = '/week-ahead/discoveries';
const reviewPath = `${base}/review`;
const fieldLabels = {
  price: 'Price',
  travel: 'Travel',
  accessibility: 'Accessibility',
  availability: 'Availability',
};
const recordFields = [
  'title', 'venue', 'region', 'startsAt', 'price', 'travel', 'accessibility',
  'availability', 'publisher', 'sourceUrl', 'retrievedAt', 'whyIncluded',
];
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 &&
  value.length <= max && !/[\u0000-\u001f]/.test(value);
const timestamp = (value) => text(value, 40) && Number.isFinite(Date.parse(value));

function safePublicUrl(value) {
  if (!text(value, 2048)) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.port && host.includes('.') &&
      !/(^|\.)((localhost|local|internal|test|invalid|example|onion)|example\.(com|net|org))$/.test(host) &&
      !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && !/^\[.*\]$/.test(host);
  } catch { return false; }
}

function validEvidenceField(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).some((key) => !['label', 'value', 'status'].includes(key))) return false;
  return value.label === label &&
    (value.value === null || text(value.value, 180)) &&
    ['verified', 'estimated', 'unknown'].includes(value.status) &&
    ((value.status === 'unknown') === (value.value === null));
}

function validateRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).some((key) => !recordFields.includes(key))) return false;
  return text(value.title, 180) && text(value.venue, 140) && text(value.region, 120) &&
    (value.startsAt === null || timestamp(value.startsAt)) &&
    Object.entries(fieldLabels).every(([key, label]) => validEvidenceField(value[key], label)) &&
    text(value.publisher, 120) && safePublicUrl(value.sourceUrl) &&
    timestamp(value.retrievedAt) && text(value.whyIncluded, 400);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}

function withApproval(payload) {
  return { ...payload, approval: 'reviewed' };
}

function publicEntry(row) {
  return withApproval(row.payload);
}

function privateEntry(row, userId) {
  return {
    ...withApproval(row.payload),
    status: row.status,
    version: row.version,
    canApprove: row.status === 'draft' && row.updated_by !== userId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    withdrawnAt: row.withdrawn_at,
  };
}

function reply(send, res, status, payload) {
  send(res, status, payload);
  return true;
}

async function isModerator(client, userId) {
  return Boolean((await client.query(
    "SELECT user_id FROM gosie_community_roles WHERE user_id=$1 AND role='moderator' FOR SHARE",
    [userId],
  )).rowCount);
}

async function addHistory(client, id, userId, action, version, payload) {
  await client.query(`INSERT INTO gosie_week_ahead_discovery_history
    (discovery_id,actor_user_id,action,version,snapshot) VALUES ($1,$2,$3,$4,$5::jsonb)`,
  [id, userId, action, version, JSON.stringify(payload)]);
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    if (result.status >= 400) await client.query('ROLLBACK');
    else await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function createDraft(userId, payload) {
  if (!exactKeys(payload, recordFields) || !validateRecord(payload)) return [400, { error: 'invalid_discovery' }];
  return transaction(async (client) => {
    if (!await isModerator(client, userId)) return [403, { error: 'moderator_permission_required' }];
    const id = `lead-${token(12)}`;
    const version = 1;
    const result = await client.query(`INSERT INTO gosie_week_ahead_discoveries
      (id,payload,status,version,created_by,updated_by)
      VALUES ($1,$2::jsonb,'draft',$3,$4,$4) RETURNING *`,
    [id, JSON.stringify(payload), version, userId]);
    await addHistory(client, id, userId, 'created', version, payload);
    return [201, { entry: privateEntry(result.rows[0], userId) }];
  });
}

async function editDraft(userId, id, body) {
  if (!exactKeys(body, [...recordFields, 'version']) || !Number.isSafeInteger(body.version) ||
    body.version < 1 || !validateRecord(Object.fromEntries(recordFields.map((key) => [key, body[key]])))) {
    return [400, { error: 'invalid_discovery' }];
  }
  const payload = Object.fromEntries(recordFields.map((key) => [key, body[key]]));
  return transaction(async (client) => {
    if (!await isModerator(client, userId)) return [403, { error: 'moderator_permission_required' }];
    const current = await client.query('SELECT * FROM gosie_week_ahead_discoveries WHERE id=$1 FOR UPDATE', [id]);
    if (!current.rowCount) return [404, { error: 'discovery_not_found' }];
    const row = current.rows[0];
    if (row.status === 'withdrawn') return [409, { error: 'withdrawn_discovery_cannot_be_edited' }];
    if (row.version !== body.version) return [409, { error: 'discovery_changed_refresh_required' }];
    const nextVersion = row.version + 1;
    const result = await client.query(`UPDATE gosie_week_ahead_discoveries
      SET payload=$1::jsonb,status='draft',version=$2,updated_by=$3,updated_at=NOW(),
          approved_by=NULL,approved_at=NULL,withdrawn_by=NULL,withdrawn_at=NULL
      WHERE id=$4 RETURNING *`,
    [JSON.stringify(payload), nextVersion, userId, id]);
    await addHistory(client, id, userId, 'edited', nextVersion, payload);
    return [200, { entry: privateEntry(result.rows[0], userId) }];
  });
}

async function changeStatus(userId, id, body, action) {
  if (!exactKeys(body, ['version']) || !Number.isSafeInteger(body.version) || body.version < 1) {
    return [400, { error: 'invalid_version' }];
  }
  return transaction(async (client) => {
    if (!await isModerator(client, userId)) return [403, { error: 'moderator_permission_required' }];
    const current = await client.query('SELECT * FROM gosie_week_ahead_discoveries WHERE id=$1 FOR UPDATE', [id]);
    if (!current.rowCount) return [404, { error: 'discovery_not_found' }];
    const row = current.rows[0];
    if (row.version !== body.version) return [409, { error: 'discovery_changed_refresh_required' }];
    const nextVersion = row.version + 1;
    if (action === 'approve') {
      if (row.status !== 'draft') return [409, { error: 'only_drafts_can_be_approved' }];
      if (row.updated_by === userId) return [403, { error: 'independent_moderator_required' }];
      const result = await client.query(`UPDATE gosie_week_ahead_discoveries
        SET status='approved',version=$1,updated_by=$2,approved_by=$2,approved_at=NOW(),updated_at=NOW()
        WHERE id=$3 RETURNING *`, [nextVersion, userId, id]);
      await addHistory(client, id, userId, 'approved', nextVersion, row.payload);
      return [200, { entry: privateEntry(result.rows[0], userId) }];
    }
    if (row.status === 'withdrawn') return [409, { error: 'discovery_already_withdrawn' }];
    const result = await client.query(`UPDATE gosie_week_ahead_discoveries
      SET status='withdrawn',version=$1,updated_by=$2,updated_at=NOW(),
          approved_by=NULL,approved_at=NULL,withdrawn_by=$2,withdrawn_at=NOW()
      WHERE id=$3 RETURNING *`, [nextVersion, userId, id]);
    await addHistory(client, id, userId, 'withdrawn', nextVersion, row.payload);
    return [200, { entry: privateEntry(result.rows[0], userId) }];
  });
}

async function handleWeekAheadDiscoveries({ req, res, path, body, session, send }) {
  if (path === base && req.method === 'GET') {
    const result = await pool.query(`SELECT payload FROM gosie_week_ahead_discoveries
      WHERE status='approved' ORDER BY (payload->>'startsAt') NULLS LAST, updated_at DESC LIMIT 101`);
    return reply(send, res, 200, {
      schemaVersion: 1,
      entries: result.rows.slice(0, 100).map(publicEntry),
      truncated: result.rowCount > 100,
    });
  }
  if (path !== reviewPath && !path.startsWith(`${reviewPath}/`)) return false;
  if (!session) return reply(send, res, 401, { error: 'unauthorized' });
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !hasCsrf(req, session.session)) {
    return reply(send, res, 403, { error: 'csrf_required' });
  }
  const userId = session.user.id;
  if (!await isModerator(pool, userId)) return reply(send, res, 403, { error: 'moderator_permission_required' });
  if (req.method === 'GET' && path === reviewPath) {
    const result = await pool.query(`SELECT * FROM gosie_week_ahead_discoveries
      ORDER BY CASE status WHEN 'draft' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      updated_at DESC,id LIMIT 101`);
    return reply(send, res, 200, {
      entries: result.rows.slice(0, 100).map((row) => privateEntry(row, userId)),
      truncated: result.rowCount > 100,
    });
  }
  if (req.method === 'POST' && path === reviewPath) {
    const [status, payload] = await createDraft(userId, body);
    return reply(send, res, status, payload);
  }
  const match = path.match(/^\/week-ahead\/discoveries\/review\/([^/]+)(?:\/(approve|withdraw))?$/);
  if (!match) return reply(send, res, 404, { error: 'not_found' });
  const [, id, action] = match;
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) return reply(send, res, 404, { error: 'discovery_not_found' });
  if (req.method === 'PUT' && !action) {
    const [status, payload] = await editDraft(userId, id, body);
    return reply(send, res, status, payload);
  }
  if (req.method === 'POST' && (action === 'approve' || action === 'withdraw')) {
    const [status, payload] = await changeStatus(userId, id, body, action);
    return reply(send, res, status, payload);
  }
  return reply(send, res, 404, { error: 'not_found' });
}

module.exports = { handleWeekAheadDiscoveries, validateRecord, safePublicUrl };
