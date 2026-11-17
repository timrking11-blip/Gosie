const http = require('node:http');
const { pool } = require('./db');
const { handleCommunity } = require('./community');
const { demoProfiles, makeDemoWeek, currentWeekStart, addDays } = require('./demo-data');
const { rankWeekend, validSocial } = require('./weekend-engine');
const {
  clearSessionCookie,
  hash,
  hashPassword,
  hasCsrf,
  rateLimited,
  safeEqual,
  sessionOf,
  setSessionCookie,
  token,
} = require('./security');

const MAX_BODY = 1024 * 1024;
const MAX_PROFILES_PER_USER = 50;
const PILOT_NOTICE_VERSION = '2026-11-17-v1';
const INVITED_EMAIL_HASHES = new Set(
  String(process.env.PILOT_INVITED_EMAIL_HASHES || '').split(',').map((value) => value.trim()).filter((value) => /^[a-f0-9]{64}$/.test(value)),
);
const ALLOWED_ORIGINS = new Set(String(process.env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean));
const VALID_GROUPINGS = new Set(['company', 'category', 'chronological']);
const VALID_DOMAINS = new Set(['professional', 'personal']);
const VALID_PRIORITIES = new Set(['High', 'Medium', 'Low']);
const CONFIG_KEYS = new Set([
  'schemaVersion', 'balance', 'weekGrouping', 'weekNested', 'budgetPerActivity', 'budgetHard',
  'maxTravelMinutes', 'exceptionTravelMinutes', 'allowExceptions', 'transportModes', 'homeBase',
  'weekendInterests', 'customInterests', 'socialContexts', 'surpriseMe', 'balancedPriorities', 'customSections',
]);

function log(event) {
  console.log(JSON.stringify({ at: new Date().toISOString(), ...event }));
}

function send(res, status, payload, headers = {}) {
  if (res.headersSent) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (!req.headers['content-length'] && !req.headers['transfer-encoding']) return {};
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY) {
      const error = new Error('payload_too_large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!length) return {};
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
    const error = new Error('json_required');
    error.status = 415;
    throw error;
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_json');
    return parsed;
  } catch {
    const error = new Error('invalid_json');
    error.status = 400;
    throw error;
  }
}

function normalizedPath(pathname) {
  if (pathname === '/api') return '/';
  return pathname.startsWith('/api/') ? pathname.slice(4) : pathname;
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (origin === 'null') return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === req.headers.host || ALLOWED_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

function configError(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return 'config_must_be_object';
  if (config.schemaVersion !== '1.0.0-draft') return 'version_mismatch';
  if (Object.keys(config).some((key) => !CONFIG_KEYS.has(key))) return 'unsupported_config_field';
  for (const key of ['budgetPerActivity', 'maxTravelMinutes', 'exceptionTravelMinutes']) {
    if (key in config && (!Number.isFinite(config[key]) || config[key] < 0 || config[key] > 100000)) return `${key}_invalid`;
  }
  for (const key of ['budgetHard', 'allowExceptions', 'surpriseMe']) {
    if (key in config && typeof config[key] !== 'boolean') return `${key}_invalid`;
  }
  if (config.weekGrouping !== undefined && !VALID_GROUPINGS.has(config.weekGrouping)) return 'weekGrouping_invalid';
  if ('balance' in config && config.balance !== null && !['professional', 'personal', 'balanced'].includes(config.balance)) return 'balance_invalid';
  for (const key of ['transportModes', 'weekendInterests', 'socialContexts', 'balancedPriorities']) {
    if (key in config && (!Array.isArray(config[key]) || config[key].length > 50 || !config[key].every((value) => typeof value === 'string' && value.length <= 200))) return `${key}_invalid`;
  }
  if ('customInterests' in config && (
    !Array.isArray(config.customInterests) ||
    config.customInterests.length > 50 ||
    !config.customInterests.every((item) => item && typeof item === 'object' && !Array.isArray(item) &&
      Object.values(item).every((value) => typeof value === 'number' || (typeof value === 'string' && value.length <= 500)))
  )) return 'customInterests_invalid';
  if ('customSections' in config && (!Array.isArray(config.customSections) || config.customSections.length > 50)) return 'customSections_invalid';
  if ('homeBase' in config && config.homeBase !== null && (typeof config.homeBase !== 'string' || config.homeBase.length > 200)) return 'homeBase_invalid';
  return null;
}

function normalizeConfig(config) {
  return {
    schemaVersion: '1.0.0-draft', balance: 'balanced', weekGrouping: 'chronological',
    budgetPerActivity: 50, budgetHard: true, maxTravelMinutes: 30, exceptionTravelMinutes: 30,
    allowExceptions: false, transportModes: ['walking', 'transit'], homeBase: '',
    weekendInterests: [], customInterests: [], socialContexts: [], surpriseMe: false,
    balancedPriorities: [], customSections: [], ...config,
  };
}

function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validWeekItem(item, partial = false) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  if (!partial || 'title' in item) if (!text(item.title, 200)) return false;
  if (!partial || 'day' in item) if (!validDay(item.day)) return false;
  if ('timeLabel' in item && item.timeLabel !== null && item.timeLabel !== '' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.timeLabel)) return false;
  if (!partial || 'category' in item) if (!text(item.category, 80)) return false;
  if ('company' in item && item.company !== null && !text(item.company, 120)) return false;
  if ('domain' in item && !VALID_DOMAINS.has(item.domain)) return false;
  if ('priority' in item && !VALID_PRIORITIES.has(item.priority)) return false;
  if ('completed' in item && typeof item.completed !== 'boolean') return false;
  if ('sourceType' in item && !['user-entered', 'fictional-demo'].includes(item.sourceType)) return false;
  return true;
}

function validFeedback(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  return (
    (
      typeof item.itemId === 'string' && item.itemId.length > 0 && item.itemId.length <= 100 &&
      ['saved', 'dismissed'].includes(item.action)
    ) ||
    (
      typeof item.itemId === 'string' && item.itemId.length > 0 &&
      item.itemId.length <= 100 && item.action === 'rating' &&
      Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5
    )
  );
}

function mapWeekItem(row) {
  return {
    id: row.id,
    day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10),
    timeLabel: row.time_label,
    title: row.title,
    category: row.category,
    company: row.company,
    domain: row.domain,
    priority: row.priority,
    completed: row.completed,
    sourceType: row.source_type,
    carriedFromId: row.carried_from_id,
    createdAt: row.created_at,
  };
}

function groupWeek(items, grouping) {
  const groups = {};
  for (const item of items) {
    const key = grouping === 'category'
      ? item.category
      : grouping === 'company'
        ? item.company || 'Personal'
        : item.day;
    (groups[key] ||= []).push(item);
  }
  return groups;
}

async function ownProfile(userId, profileId, client = pool) {
  const result = await client.query(
    'SELECT id, user_id, is_demo, title, config, created_at FROM gosie_profiles WHERE id = $1 AND user_id = $2',
    [profileId, userId],
  );
  return result.rows[0] || null;
}

async function insertProfile(client, userId, title, config) {
  const id = `profile-${token(12)}`;
  const result = await client.query(
    'INSERT INTO gosie_profiles (id, user_id, is_demo, title, config) VALUES ($1, $2, FALSE, $3, $4::jsonb) RETURNING id, title, config, created_at',
    [id, userId, title, JSON.stringify(config)],
  );
  return result.rows[0];
}

async function insertWeekItem(client, userId, profileId, item, carriedFromId = null) {
  const id = `week-${token(12)}`;
  const result = await client.query(
    `INSERT INTO gosie_week_items
       (id, user_id, profile_id, day, time_label, title, category, company, domain, priority, completed, carried_from_id, source_type)
     VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      id, userId, profileId, item.day, item.timeLabel || null, item.title, item.category,
      item.company || null, item.domain || 'personal', item.priority || 'Medium',
      item.completed === true, carriedFromId, item.sourceType || 'user-entered',
    ],
  );
  return mapWeekItem(result.rows[0]);
}

function profileFromRow(row) {
  return { id: row.id, title: row.title, isDemo: row.is_demo, config: row.config, createdAt: row.created_at };
}

async function getProfileCounts(userId) {
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM gosie_profiles WHERE user_id = $1', [userId]);
  return result.rows[0].count;
}

async function exportProfile(userId, profileId) {
  const profile = await ownProfile(userId, profileId);
  if (!profile) return null;
  const [week, feedback] = await Promise.all([
    pool.query('SELECT * FROM gosie_week_items WHERE user_id = $1 AND profile_id = $2 ORDER BY day, time_label NULLS LAST, created_at', [userId, profileId]),
    pool.query('SELECT item_id, action, rating, created_at FROM gosie_feedback WHERE user_id = $1 AND profile_id = $2 ORDER BY item_id, action', [userId, profileId]),
  ]);
  return {
    schemaVersion: '1.0.0-draft',
    title: profile.title,
    config: profile.config,
    weekItems: week.rows.map(mapWeekItem),
    feedback: feedback.rows.map((row) => ({
      itemId: row.item_id,
      action: row.action,
      rating: row.rating,
      createdAt: row.created_at,
    })),
  };
}

function createApiHandler() {
  return async function apiHandler(req, res) {
    const started = Date.now();
    let parsedUrl;
    try {
      parsedUrl = new URL(req.url, 'http://localhost');
    } catch {
      return send(res, 400, { error: 'bad_request' });
    }
    const path = normalizedPath(parsedUrl.pathname);
    res.on('finish', () => log({ method: req.method, path, status: res.statusCode, ms: Date.now() - started }));

    try {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !originAllowed(req)) {
        return send(res, 403, { error: 'origin_not_allowed' });
      }
      let body = {};
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        body = await readBody(req);
      }

      if (req.method === 'GET' && path === '/health') {
        await pool.query('SELECT 1');
        return send(res, 200, { ok: true, app: 'gosie', database: 'postgres' });
      }

      if (req.method === 'POST' && (path === '/auth/register' || path === '/auth/login')) {
        if (await rateLimited(req)) return send(res, 429, { error: 'rate_limited' });
      }

      if (req.method === 'POST' && path === '/auth/register') {
        if (process.env.PILOT_SIGNUPS_ENABLED !== '1') return send(res, 403, { error: 'pilot_registration_closed' });
        if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.pilotConsent !== true) {
          return send(res, 400, { error: 'email_password_and_pilot_consent_required' });
        }
        const email = body.email.trim().toLowerCase();
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'invalid_email' });
        if (body.password.length < 8 || body.password.length > 200) return send(res, 400, { error: 'password_length_invalid' });
        const productionEnrollment = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';
        if (productionEnrollment && (INVITED_EMAIL_HASHES.size > 5 || !INVITED_EMAIL_HASHES.has(hash(email)))) {
          return send(res, 403, { error: 'pilot_invitation_required' });
        }
        const userId = `user-${token(12)}`;
        const password = await hashPassword(body.password);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          if (productionEnrollment) {
            // Serialize the count and insert so simultaneous signups cannot exceed five.
            await client.query("SELECT pg_advisory_xact_lock(hashtext('gosie-pilot-enrollment'))");
            const count = await client.query('SELECT COUNT(*)::int AS count FROM gosie_users');
            if (count.rows[0].count >= 5) {
              await client.query('ROLLBACK');
              return send(res, 403, { error: 'pilot_capacity_reached' });
            }
          }
          await client.query(
            `INSERT INTO gosie_users (id, email, pass_hash, pass_salt, pilot_notice_version, consent_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [userId, email, password.hash, password.salt, PILOT_NOTICE_VERSION],
          );
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          if (error.code === '23505') return send(res, 409, { error: 'email_exists' });
          throw error;
        } finally {
          client.release();
        }
        return send(res, 201, { id: userId, email });
      }

      if (req.method === 'POST' && path === '/auth/login') {
        if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.password.length > 200) {
          return send(res, 401, { error: 'unauthorized' });
        }
        const email = body.email.trim().toLowerCase();
        const result = await pool.query('SELECT id, email, pass_hash, pass_salt FROM gosie_users WHERE email = $1', [email]);
        const user = result.rows[0];
        const password = await hashPassword(body.password, user?.pass_salt || 'gosie-dummy-salt');
        if (!user || !safeEqual(password.hash, user.pass_hash)) return send(res, 401, { error: 'unauthorized' });
        const sessionId = token();
        const csrfToken = token();
        const expiresAt = new Date(Date.now() + 86400 * 1000);
        await pool.query(
          'INSERT INTO gosie_sessions (id_hash, user_id, csrf_token, expires_at) VALUES ($1, $2, $3, $4)',
          [hash(sessionId), user.id, csrfToken, expiresAt],
        );
        setSessionCookie(res, sessionId);
        return send(res, 200, {
          user: { id: user.id, email: user.email },
          csrfToken,
          expiresAt: expiresAt.toISOString(),
        });
      }

      const session = await sessionOf(req);
      if (await handleCommunity({ req, res, path, url: parsedUrl, body, session, send })) return;
      if (req.method === 'GET' && path === '/auth/session') {
        if (!session) return send(res, 200, { authenticated: false });
        return send(res, 200, {
          authenticated: true,
          user: session.user,
          csrfToken: session.session.csrf_token,
          expiresAt: session.session.expires_at,
        });
      }
      if (!session) return send(res, 401, { error: 'unauthorized' });

      const requireCsrf = () => hasCsrf(req, session.session);
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && path !== '/auth/register' && path !== '/auth/login' && !requireCsrf()) {
        return send(res, 403, { error: 'csrf_required' });
      }

      if (req.method === 'POST' && path === '/auth/logout') {
        await pool.query('DELETE FROM gosie_sessions WHERE id_hash = $1', [session.session.id_hash]);
        clearSessionCookie(res);
        return send(res, 200, { status: 'logged_out' });
      }
      if (req.method === 'DELETE' && path === '/auth/account') {
        await pool.query('DELETE FROM gosie_users WHERE id = $1', [session.user.id]);
        clearSessionCookie(res);
        return send(res, 200, { status: 'account_deleted' });
      }

      if (req.method === 'GET' && path === '/profiles') {
        const result = await pool.query(
          'SELECT id, title, is_demo, config, created_at FROM gosie_profiles WHERE user_id = $1 ORDER BY created_at',
          [session.user.id],
        );
        return send(res, 200, { profiles: result.rows.map(profileFromRow) });
      }
      if (req.method === 'GET' && path === '/demo-profiles') {
        return send(res, 200, { profiles: demoProfiles.map((profile) => ({ ...profile, isDemo: true })) });
      }
      if (req.method === 'POST' && path === '/profiles') {
        if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200) return send(res, 400, { error: 'invalid_title' });
        const error = configError(body.config);
        if (error) return send(res, 400, { error: 'invalid_config', detail: error });
        if (await getProfileCounts(session.user.id) >= MAX_PROFILES_PER_USER) return send(res, 409, { error: 'profile_limit_reached' });
        const profile = await insertProfile(pool, session.user.id, body.title.trim(), normalizeConfig(body.config));
        return send(res, 201, { id: profile.id, title: profile.title, config: profile.config });
      }
      if (req.method === 'POST' && path === '/profiles/copy-demo') {
        const demo = demoProfiles.find((profile) => profile.id === body.demoId);
        if (!demo) return send(res, 404, { error: 'demo_not_found' });
        if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200)) {
          return send(res, 400, { error: 'invalid_title' });
        }
        if (await getProfileCounts(session.user.id) >= MAX_PROFILES_PER_USER) return send(res, 409, { error: 'profile_limit_reached' });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const profile = await insertProfile(client, session.user.id, (body.title || demo.title).trim(), demo.config);
          const weekItems = makeDemoWeek(currentWeekStart());
          for (const item of weekItems) await insertWeekItem(client, session.user.id, profile.id, item);
          await client.query('COMMIT');
          return send(res, 201, { id: profile.id, title: profile.title, config: profile.config, sampleWeekAdded: true });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }
      if (req.method === 'POST' && path === '/profiles/import') {
        if (body.schemaVersion !== undefined && body.schemaVersion !== '1.0.0-draft') {
          return send(res, 400, { error: 'version_mismatch' });
        }
        const config = body.config && typeof body.config === 'object' && !Array.isArray(body.config)
          ? normalizeConfig(body.config) : body.config;
        const configProblem = configError(config);
        if (configProblem) return send(res, 400, { error: 'invalid_config', detail: configProblem });
        if ('weekItems' in body && !Array.isArray(body.weekItems)) return send(res, 400, { error: 'invalid_week_items' });
        if ('feedback' in body && !Array.isArray(body.feedback)) return send(res, 400, { error: 'invalid_feedback' });
        const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : 'Imported profile';
        const weekItems = Array.isArray(body.weekItems) ? body.weekItems : [];
        const feedback = Array.isArray(body.feedback) ? body.feedback : [];
        if (weekItems.length > 500 || !weekItems.every((item) => validWeekItem(item))) return send(res, 400, { error: 'invalid_week_items' });
        if (feedback.length > 1000 || !feedback.every(validFeedback)) return send(res, 400, { error: 'invalid_feedback' });
        if (await getProfileCounts(session.user.id) >= MAX_PROFILES_PER_USER) return send(res, 409, { error: 'profile_limit_reached' });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const profile = await insertProfile(client, session.user.id, title, config);
          // Imported references may only point at records created within this import.
          // Never attach an imported row to an existing (possibly other user's) ID.
          const importedIds = new Map();
          const importedItems = [];
          for (const item of weekItems) {
            const inserted = await insertWeekItem(client, session.user.id, profile.id, item);
            if (typeof item.id === 'string') importedIds.set(item.id, inserted.id);
            importedItems.push({ original: item, inserted });
          }
          for (const { original, inserted } of importedItems) {
            const parent = importedIds.get(original.carriedFromId);
            if (parent && parent !== inserted.id) {
              await client.query('UPDATE gosie_week_items SET carried_from_id=$1 WHERE id=$2 AND user_id=$3 AND profile_id=$4',
                [parent, inserted.id, session.user.id, profile.id]);
            }
          }
          for (const item of feedback) {
            await client.query(
              `INSERT INTO gosie_feedback (user_id, profile_id, item_id, action, rating)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (user_id, profile_id, item_id, action) DO UPDATE
                 SET rating = EXCLUDED.rating, created_at = NOW()`,
              [session.user.id, profile.id, item.itemId, item.action, item.action === 'rating' ? item.rating : null],
            );
          }
          await client.query('COMMIT');
          return send(res, 201, { id: profile.id, title });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }

      const profileMatch = path.match(/^\/profiles\/([^/]+)(\/export)?$/);
      if (profileMatch) {
        let profileId;
        try {
          profileId = decodeURIComponent(profileMatch[1]);
        } catch {
          return send(res, 400, { error: 'bad_request' });
        }
        if (req.method === 'GET' && profileMatch[2] === '/export') {
          const data = await exportProfile(session.user.id, profileId);
          return data ? send(res, 200, data) : send(res, 404, { error: 'not_found' });
        }
        if (req.method === 'GET') {
          const profile = await ownProfile(session.user.id, profileId);
          return profile ? send(res, 200, profileFromRow(profile)) : send(res, 404, { error: 'not_found' });
        }
        if (req.method === 'PUT') {
          const profile = await ownProfile(session.user.id, profileId);
          if (!profile) return send(res, 404, { error: 'not_found' });
          if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200) return send(res, 400, { error: 'invalid_title' });
          const error = configError(body.config);
          if (error) return send(res, 400, { error: 'invalid_config', detail: error });
          await pool.query('UPDATE gosie_profiles SET title = $1, config = $2::jsonb WHERE id = $3 AND user_id = $4', [
            body.title.trim(), JSON.stringify(normalizeConfig(body.config)), profileId, session.user.id,
          ]);
          return send(res, 200, { id: profileId });
        }
        if (req.method === 'DELETE') {
          const deleted = await pool.query('DELETE FROM gosie_profiles WHERE id = $1 AND user_id = $2', [profileId, session.user.id]);
          return deleted.rowCount ? send(res, 200, { status: 'deleted' }) : send(res, 404, { error: 'not_found' });
        }
      }

      if (req.method === 'GET' && path === '/week') {
        const profileId = parsedUrl.searchParams.get('profile_id');
        const profile = profileId && await ownProfile(session.user.id, profileId);
        if (!profile) return send(res, 404, { error: 'not_found' });
        const weekStart = parsedUrl.searchParams.get('week_start') || currentWeekStart();
        if (!validDay(weekStart)) return send(res, 400, { error: 'invalid_week_start' });
        const weekEnd = addDays(weekStart, 7);
        const result = await pool.query(
          `SELECT * FROM gosie_week_items
           WHERE user_id = $1 AND profile_id = $2 AND day >= $3::date AND day < $4::date
           ORDER BY day, time_label NULLS LAST, created_at`,
          [session.user.id, profileId, weekStart, weekEnd],
        );
        const items = result.rows.map(mapWeekItem);
        const grouping = VALID_GROUPINGS.has(profile.config.weekGrouping) ? profile.config.weekGrouping : 'chronological';
        return send(res, 200, {
          profileId,
          weekStart,
          grouping,
          items,
          groups: groupWeek(items, grouping),
          why: ['Only plans saved to this profile are shown. Gosie is not connected to a calendar.'],
        });
      }
      if (req.method === 'POST' && path === '/week/copy-demo') {
        const profileId = parsedUrl.searchParams.get('profile_id') || body.profileId;
        const profile = profileId && await ownProfile(session.user.id, profileId);
        if (!profile) return send(res, 404, { error: 'not_found' });
        const currentCount = await pool.query('SELECT COUNT(*)::int AS count FROM gosie_week_items WHERE user_id=$1 AND profile_id=$2', [session.user.id, profileId]);
        if (currentCount.rows[0].count > 0) return send(res, 409, { error: 'week_already_has_items' });
        const weekStart = parsedUrl.searchParams.get('week_start') || currentWeekStart();
        if (!validDay(weekStart)) return send(res, 400, { error: 'invalid_week_start' });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const items = [];
          for (const item of makeDemoWeek(weekStart)) items.push(await insertWeekItem(client, session.user.id, profileId, item));
          await client.query('COMMIT');
          return send(res, 201, { items });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }
      if (req.method === 'POST' && path === '/week') {
        const profileId = parsedUrl.searchParams.get('profile_id') || body.profileId;
        const profile = profileId && await ownProfile(session.user.id, profileId);
        if (!profile) return send(res, 404, { error: 'not_found' });
        if (!validWeekItem(body)) return send(res, 400, { error: 'invalid_week_item' });
        const item = await insertWeekItem(pool, session.user.id, profileId, body);
        return send(res, 201, { item });
      }

      const weekMatch = path.match(/^\/week\/([^/]+)(\/carry-forward)?$/);
      if (weekMatch) {
        let itemId;
        try {
          itemId = decodeURIComponent(weekMatch[1]);
        } catch {
          return send(res, 400, { error: 'bad_request' });
        }
        const profileId = parsedUrl.searchParams.get('profile_id') || body.profileId;
        const profile = profileId && await ownProfile(session.user.id, profileId);
        if (!profile) return send(res, 404, { error: 'not_found' });
        if (req.method === 'POST' && weekMatch[2] === '/carry-forward') {
          const source = await pool.query(
            'SELECT * FROM gosie_week_items WHERE id=$1 AND user_id=$2 AND profile_id=$3',
            [itemId, session.user.id, profileId],
          );
          if (!source.rowCount) return send(res, 404, { error: 'not_found' });
          const previous = mapWeekItem(source.rows[0]);
          const item = await insertWeekItem(pool, session.user.id, profileId, {
            ...previous,
            day: addDays(previous.day, 7),
            completed: false,
          }, previous.id);
          return send(res, 201, { item });
        }
        if (weekMatch[2]) return send(res, 404, { error: 'not_found' });
        if (req.method === 'PATCH') {
          const source = await pool.query(
            'SELECT * FROM gosie_week_items WHERE id=$1 AND user_id=$2 AND profile_id=$3',
            [itemId, session.user.id, profileId],
          );
          if (!source.rowCount) return send(res, 404, { error: 'not_found' });
          const previous = mapWeekItem(source.rows[0]);
          const merged = { ...previous, ...body };
          if (!validWeekItem(merged)) return send(res, 400, { error: 'invalid_week_item' });
          const updated = await pool.query(
            `UPDATE gosie_week_items SET day=$1::date, time_label=$2, title=$3, category=$4, company=$5,
             domain=$6, priority=$7, completed=$8, updated_at=NOW()
             WHERE id=$9 AND user_id=$10 AND profile_id=$11 RETURNING *`,
            [merged.day, merged.timeLabel || null, merged.title, merged.category, merged.company || null, merged.domain, merged.priority, merged.completed, itemId, session.user.id, profileId],
          );
          return send(res, 200, { item: mapWeekItem(updated.rows[0]) });
        }
        if (req.method === 'DELETE') {
          const deleted = await pool.query(
            'DELETE FROM gosie_week_items WHERE id=$1 AND user_id=$2 AND profile_id=$3',
            [itemId, session.user.id, profileId],
          );
          return deleted.rowCount ? send(res, 200, { status: 'deleted' }) : send(res, 404, { error: 'not_found' });
        }
      }

      if (req.method === 'GET' && path === '/weekend') {
        const profileId = parsedUrl.searchParams.get('profile_id');
        const profile = profileId && await ownProfile(session.user.id, profileId);
        if (!profile) return send(res, 404, { error: 'not_found' });
        const social = parsedUrl.searchParams.get('social') || 'all';
        if (!validSocial.has(social)) return send(res, 400, { error: 'invalid_social_context' });
        const feedback = await pool.query(
          'SELECT item_id, action, rating, created_at FROM gosie_feedback WHERE user_id=$1 AND profile_id=$2 ORDER BY created_at',
          [session.user.id, profileId],
        );
        return send(res, 200, {
          profileId,
          ...rankWeekend(profile.config, feedback.rows, social),
        });
      }
      if (req.method === 'GET' && path === '/feedback') {
        const profileId = parsedUrl.searchParams.get('profile_id');
        if (!profileId || !await ownProfile(session.user.id, profileId)) return send(res, 404, { error: 'not_found' });
        const result = await pool.query(
          'SELECT item_id, action, rating, created_at FROM gosie_feedback WHERE user_id=$1 AND profile_id=$2 ORDER BY created_at DESC',
          [session.user.id, profileId],
        );
        return send(res, 200, {
          feedback: result.rows.map((row) => ({ itemId: row.item_id, action: row.action, rating: row.rating, createdAt: row.created_at })),
        });
      }
      if (req.method === 'POST' && path === '/feedback') {
        if (typeof body.profileId !== 'string' || !await ownProfile(session.user.id, body.profileId)) return send(res, 404, { error: 'not_found' });
        if (typeof body.itemId !== 'string' || !body.itemId || body.itemId.length > 100 || !['saved', 'dismissed', 'rating'].includes(body.action)) {
          return send(res, 400, { error: 'invalid_feedback' });
        }
        if (body.action === 'rating' && (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)) {
          return send(res, 400, { error: 'invalid_feedback' });
        }
        if (body.action !== 'rating' && body.value === false) {
          await pool.query(
            'DELETE FROM gosie_feedback WHERE user_id=$1 AND profile_id=$2 AND item_id=$3 AND action=$4',
            [session.user.id, body.profileId, body.itemId, body.action],
          );
          return send(res, 200, { status: 'removed' });
        }
        const result = await pool.query(
          `INSERT INTO gosie_feedback (user_id, profile_id, item_id, action, rating)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, profile_id, item_id, action) DO UPDATE
             SET rating = EXCLUDED.rating, created_at = NOW()
           RETURNING id, item_id, action, rating, created_at`,
          [session.user.id, body.profileId, body.itemId, body.action, body.action === 'rating' ? body.rating : null],
        );
        const row = result.rows[0];
        return send(res, 200, { feedback: { id: row.id, itemId: row.item_id, action: row.action, rating: row.rating, createdAt: row.created_at } });
      }

      return send(res, 404, { error: 'not_found' });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      if (status === 500) log({ level: 'error', event: 'request_failed', path, code: error.code || 'internal_error' });
      return send(res, status, { error: status === 500 ? 'internal_error' : error.message });
    }
  };
}

function listen(port = Number(process.env.API_PORT || process.env.PORT || 8791), host = '127.0.0.1') {
  const apiHandler = createApiHandler();
  const server = http.createServer(apiHandler);
  server.timeout = 10000;
  server.headersTimeout = 10000;
  server.requestTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.listen(port, host, () => log({ event: 'api_listening', port }));
  const stop = async () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  return server;
}

if (require.main === module) listen();

module.exports = { createApiHandler, listen, pool, PILOT_NOTICE_VERSION };
