// Explicit opt-in is required. Tests create uniquely named synthetic users and
// remove their rows even if a request assertion fails. Never run in production.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { randomUUID, createHmac } = require('node:crypto');
const { createHash } = require('node:crypto');
if (process.env.GOSIE_DB_ENV !== 'test' || process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production') {
  throw new Error('API tests require GOSIE_DB_ENV=test on a non-production database.');
}
const { pool: testPool } = require('./db');
const testRateSecret = randomUUID();
const registeredIds = new Set();

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function call(port, method, route, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const body = options.raw !== undefined ? options.raw : options.body !== undefined ? JSON.stringify(options.body) : undefined;
    if (body !== undefined) headers['Content-Length'] = Buffer.byteLength(body);
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.csrf) headers['X-CSRF-Token'] = options.csrf;
    const req = http.request({ host: '127.0.0.1', port, path: route, method, headers }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, json, text });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function start(extraEnv = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: {
      ...process.env,
      API_PORT: String(port),
      PORT: String(port),
      AUTH_RATE_LIMIT: '1000',
      PILOT_SIGNUPS_ENABLED: '1',
      SESSION_SECRET: testRateSecret,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (data) => { logs += data; });
  child.stderr.on('data', (data) => { logs += data; });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) break;
    try {
      const response = await call(port, 'GET', '/health');
      if (response.status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) {
    child.kill('SIGTERM');
    throw new Error(`API server failed to start: ${logs}`);
  }
  return { port, child, logs: () => logs };
}

function stop(server) {
  if (!server || server.child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    server.child.once('exit', resolve);
    server.child.kill('SIGTERM');
  });
}

const users = [];
let primary;

async function register(port, email, password = 'Gosie-Test-Pass-123') {
  const response = await call(port, 'POST', '/auth/register', {
    body: { email, password, pilotConsent: true },
  });
  if (response.status === 201) registeredIds.add(response.json.id);
  return response;
}

async function login(port, email, password = 'Gosie-Test-Pass-123') {
  const created = await register(port, email, password);
  assert.equal(created.status, 201, `register failed: ${JSON.stringify(created.json)}`);
  const response = await call(port, 'POST', '/auth/login', { body: { email, password } });
  assert.equal(response.status, 200, `login failed: ${JSON.stringify(response.json)}`);
  const user = {
    id: response.json.user.id,
    email,
    password,
    cookie: response.headers['set-cookie'][0].split(';')[0],
    csrf: response.json.csrfToken,
  };
  users.push(user);
  return user;
}

async function makeUser(port) {
  return login(port, `gosie-${randomUUID()}@example.invalid`);
}

const config = (overrides = {}) => ({
  schemaVersion: '1.0.0-draft',
  balance: 'balanced',
  weekGrouping: 'chronological',
  budgetPerActivity: 50,
  budgetHard: false,
  maxTravelMinutes: 40,
  exceptionTravelMinutes: 70,
  allowExceptions: true,
  transportModes: ['walking', 'transit'],
  homeBase: 'Sample neighborhood',
  weekendInterests: ['music', 'food'],
  customInterests: [],
  socialContexts: ['solo', 'friends'],
  surpriseMe: false,
  balancedPriorities: ['balanced'],
  customSections: [],
  ...overrides,
});

async function createProfile(port, user, cfg = config(), title = 'Test profile') {
  const result = await call(port, 'POST', '/profiles', {
    cookie: user.cookie,
    csrf: user.csrf,
    body: { title, config: cfg },
  });
  assert.equal(result.status, 201, `profile creation failed: ${JSON.stringify(result.json)}`);
  return result.json;
}

before(async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must point to a disposable Postgres database');
  primary = await start();
});

after(async () => {
  try {
    await stop(primary);
    for (const id of registeredIds) await testPool.query('DELETE FROM gosie_users WHERE id=$1', [id]);
    for (const ip of ['127.0.0.1', '::ffff:127.0.0.1', '198.51.100.81', '198.51.100.82']) {
      const fingerprint = createHmac('sha256', testRateSecret).update(ip).digest('hex');
      await testPool.query('DELETE FROM gosie_auth_rate_limits WHERE ip_hash=$1', [fingerprint]);
    }
  } finally {
    await testPool.end();
  }
});

test('health and security headers are available over the API', async () => {
  const response = await call(primary.port, 'GET', '/health');
  assert.equal(response.status, 200);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.equal(response.json.database, 'postgres');
});

test('registration is closed unless explicitly enabled and requires consent', async () => {
  const closed = await start({ PILOT_SIGNUPS_ENABLED: '0' });
  try {
    const result = await call(closed.port, 'POST', '/auth/register', {
      body: { email: `closed-${randomUUID()}@example.invalid`, password: 'Gosie-Test-Pass-123', pilotConsent: true },
    });
    assert.equal(result.status, 403);
    assert.equal(result.json.error, 'pilot_registration_closed');
  } finally {
    await stop(closed);
  }
  const noConsent = await call(primary.port, 'POST', '/auth/register', {
    body: { email: `consent-${randomUUID()}@example.invalid`, password: 'Gosie-Test-Pass-123' },
  });
  assert.equal(noConsent.status, 400);
});

test('production enrollment requires an invitation and cannot exceed five accounts', async () => {
  const emails = Array.from({ length: 5 }, () => `invited-${randomUUID()}@example.invalid`);
  const server = await start({
    NODE_ENV: 'production', COOKIE_SECURE: '1',
    PILOT_INVITED_EMAIL_HASHES: emails.map((email) => createHash('sha256').update(email).digest('hex')).join(','),
  });
  try {
    assert.equal((await register(server.port, `uninvited-${randomUUID()}@example.invalid`)).status, 403);
    // This test runs before other accounts are created; only its own users are added.
    for (const email of emails) assert.equal((await register(server.port, email)).status, 201);
    assert.equal((await register(server.port, emails[0])).json.error, 'pilot_capacity_reached');
  } finally {
    await stop(server);
    for (const email of emails) {
      await testPool.query('DELETE FROM gosie_users WHERE email=$1 AND id=ANY($2::text[])', [email, [...registeredIds]]);
    }
  }
});

test('email is normalized and duplicate accounts are rejected', async () => {
  const email = `case-${randomUUID()}@example.invalid`;
  assert.equal((await register(primary.port, email.toUpperCase())).status, 201);
  assert.equal((await register(primary.port, ` ${email} `)).status, 409);
  const response = await call(primary.port, 'POST', '/auth/login', {
    body: { email: email.toUpperCase(), password: 'Gosie-Test-Pass-123' },
  });
  assert.equal(response.status, 200);
});

test('malformed JSON and oversized request bodies are rejected', async () => {
  for (const raw of ['null', '[1]', '{bad']) {
    assert.equal((await call(primary.port, 'POST', '/auth/login', { raw })).status, 400);
  }
  assert.equal((await call(primary.port, 'POST', '/auth/login', {
    raw: JSON.stringify({ email: 'oversize@example.invalid', password: 'x'.repeat(1024 * 1024 + 1) }),
  })).status, 413);
});

test('cross-origin, non-JSON, and missing-CSRF mutations are rejected', async () => {
  const user = await makeUser(primary.port);
  const body = { email: user.email, password: user.password };
  const crossOrigin = await call(primary.port, 'POST', '/auth/login', {
    body,
    headers: { Origin: 'https://evil.example' },
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal(crossOrigin.json.error, 'origin_not_allowed');
  const nullOrigin = await call(primary.port, 'POST', '/auth/login', { body, headers: { Origin: 'null' } });
  assert.equal(nullOrigin.status, 403);
  const form = await call(primary.port, 'POST', '/auth/login', {
    raw: 'email=a&password=b',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(form.status, 415);
  const missingCsrf = await call(primary.port, 'POST', '/profiles', {
    cookie: user.cookie,
    body: { title: 'No CSRF', config: config() },
  });
  assert.equal(missingCsrf.status, 403);
});

test('malformed encoded paths return 400 without crashing the API', async () => {
  const user = await makeUser(primary.port);
  const response = await call(primary.port, 'GET', '/profiles/%E0%A4%A', { cookie: user.cookie });
  assert.equal(response.status, 400);
  assert.equal((await call(primary.port, 'GET', '/health')).status, 200);
});

test('profile data is isolated between users and export is owner-only', async () => {
  const a = await makeUser(primary.port);
  const b = await makeUser(primary.port);
  const profile = await createProfile(primary.port, a);
  assert.equal((await call(primary.port, 'GET', `/profiles/${profile.id}`, { cookie: b.cookie })).status, 404);
  const bList = await call(primary.port, 'GET', '/profiles', { cookie: b.cookie });
  assert.ok(!JSON.stringify(bList.json).includes(profile.id));
  assert.equal((await call(primary.port, 'PUT', `/profiles/${profile.id}`, {
    cookie: b.cookie, csrf: b.csrf, body: { title: 'Changed', config: config() },
  })).status, 404);
  assert.equal((await call(primary.port, 'DELETE', `/profiles/${profile.id}`, {
    cookie: b.cookie, csrf: b.csrf, body: {},
  })).status, 404);
  assert.equal((await call(primary.port, 'GET', `/profiles/${profile.id}/export`, { cookie: b.cookie })).status, 404);
  assert.equal((await call(primary.port, 'GET', `/profiles/${profile.id}/export`, { cookie: a.cookie })).status, 200);
});

test('profile inputs are validated and imports require a supported schema', async () => {
  const user = await makeUser(primary.port);
  const badConfig = await call(primary.port, 'POST', '/profiles', {
    cookie: user.cookie, csrf: user.csrf,
    body: { title: 'Bad', config: config({ transportModes: 'walking' }) },
  });
  assert.equal(badConfig.status, 400);
  const badTitle = await call(primary.port, 'POST', '/profiles', {
    cookie: user.cookie, csrf: user.csrf,
    body: { title: { value: 'bad' }, config: config() },
  });
  assert.equal(badTitle.status, 400);
  const badImport = await call(primary.port, 'POST', '/profiles/import', {
    cookie: user.cookie, csrf: user.csrf,
    body: { schemaVersion: '9.9.9', config: { ...config(), schemaVersion: '9.9.9' } },
  });
  assert.equal(badImport.status, 400);
  const legacy = await call(primary.port, 'POST', '/profiles/import', {
    cookie: user.cookie, csrf: user.csrf,
    body: { title: 'Legacy import', config: { balance: 'personal' } },
  });
  assert.equal(legacy.status, 201);
  const read = await call(primary.port, 'GET', `/profiles/${legacy.json.id}`, { cookie: user.cookie });
  assert.equal(read.json.config.schemaVersion, '1.0.0-draft');
});

test('Week Ahead demo copies five weekdays and grouping changes preserve all events', async () => {
  const user = await makeUser(primary.port);
  const profile = await createProfile(primary.port, user);
  const copied = await call(primary.port, 'POST', `/week/copy-demo?profile_id=${profile.id}`, {
    cookie: user.cookie, csrf: user.csrf, body: {},
  });
  assert.equal(copied.status, 201);
  const week = await call(primary.port, 'GET', `/week?profile_id=${profile.id}&week_start=${copied.json.items[0].day}`, {
    cookie: user.cookie,
  });
  const weekdays = new Set(week.json.items.map((item) => new Date(`${item.day}T00:00:00Z`).getUTCDay()));
  assert.deepEqual([...weekdays].sort(), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(week.json.items.length, 8);
  assert.ok(week.json.items.every((item) => item.sourceType === 'fictional-demo'));
  const originalIds = week.json.items.map((item) => item.id).sort();
  const updatedConfig = config({ weekGrouping: 'category' });
  const updatedProfile = await call(primary.port, 'PUT', `/profiles/${profile.id}`, {
    cookie: user.cookie, csrf: user.csrf, body: { title: profile.title, config: updatedConfig },
  });
  assert.equal(updatedProfile.status, 200);
  const grouped = await call(primary.port, 'GET', `/week?profile_id=${profile.id}&week_start=${copied.json.items[0].day}`, {
    cookie: user.cookie,
  });
  assert.equal(grouped.json.grouping, 'category');
  assert.deepEqual(grouped.json.items.map((item) => item.id).sort(), originalIds);
  assert.equal((await call(primary.port, 'POST', `/week/copy-demo?profile_id=${profile.id}`, {
    cookie: user.cookie, csrf: user.csrf, body: {},
  })).status, 409);
});

test('Week Ahead supports create, update, carry-forward, and delete', async () => {
  const user = await makeUser(primary.port);
  const profile = await createProfile(primary.port, user);
  const startDate = '2026-11-16';
  const create = await call(primary.port, 'POST', `/week?profile_id=${profile.id}`, {
    cookie: user.cookie, csrf: user.csrf,
    body: { day: startDate, timeLabel: '09:00', title: 'Planning session', category: 'Work', company: 'Studio', domain: 'professional', priority: 'High', completed: false },
  });
  assert.equal(create.status, 201);
  const item = create.json.item;
  const update = await call(primary.port, 'PATCH', `/week/${item.id}?profile_id=${profile.id}`, {
    cookie: user.cookie, csrf: user.csrf,
    body: { title: 'Updated planning session', completed: true },
  });
  assert.equal(update.status, 200);
  assert.equal(update.json.item.title, 'Updated planning session');
  assert.equal(update.json.item.completed, true);
  const carry = await call(primary.port, 'POST', `/week/${item.id}/carry-forward?profile_id=${profile.id}`, {
    cookie: user.cookie, csrf: user.csrf, body: {},
  });
  assert.equal(carry.status, 201);
  assert.equal(carry.json.item.day, '2026-11-23');
  assert.equal(carry.json.item.completed, false);
  assert.equal((await call(primary.port, 'DELETE', `/week/${item.id}?profile_id=${profile.id}`, {
    cookie: user.cookie, csrf: user.csrf, body: {},
  })).status, 200);
});

test('Weekend Ahead labels fictional recommendations and applies feedback updates', async () => {
  const user = await makeUser(primary.port);
  const profile = await createProfile(primary.port, user);
  const initial = await call(primary.port, 'GET', `/weekend?profile_id=${profile.id}&social=all`, { cookie: user.cookie });
  assert.equal(initial.status, 200);
  const all = [...initial.json.included, ...initial.json.exceptions, ...initial.json.excluded, ...initial.json.dismissed];
  assert.ok(all.length > 0);
  assert.ok(all.every((idea) => idea.sourceType === 'fictional-demo'));
  assert.ok(all.every((idea) => Array.isArray(idea.why)));
  const idea = all[0];
  const saved = await call(primary.port, 'POST', '/feedback', {
    cookie: user.cookie, csrf: user.csrf,
    body: { profileId: profile.id, itemId: idea.id, action: 'saved', value: true },
  });
  assert.equal(saved.status, 200);
  const rated = await call(primary.port, 'POST', '/feedback', {
    cookie: user.cookie, csrf: user.csrf,
    body: { profileId: profile.id, itemId: idea.id, action: 'rating', rating: 2 },
  });
  assert.equal(rated.status, 200);
  await call(primary.port, 'POST', '/feedback', {
    cookie: user.cookie, csrf: user.csrf,
    body: { profileId: profile.id, itemId: idea.id, action: 'rating', rating: 5 },
  });
  const next = await call(primary.port, 'GET', `/weekend?profile_id=${profile.id}&social=friends`, { cookie: user.cookie });
  assert.equal(next.json.social, 'friends');
  const updated = [...next.json.included, ...next.json.exceptions, ...next.json.excluded, ...next.json.dismissed]
    .find((entry) => entry.id === idea.id);
  assert.equal(updated.rating, 5);
  assert.equal(updated.saved, true);
  const removed = await call(primary.port, 'POST', '/feedback', {
    cookie: user.cookie, csrf: user.csrf,
    body: { profileId: profile.id, itemId: idea.id, action: 'saved', value: false },
  });
  assert.equal(removed.status, 200);
  const afterRemove = await call(primary.port, 'GET', `/weekend?profile_id=${profile.id}`, { cookie: user.cookie });
  const noLongerSaved = [...afterRemove.json.included, ...afterRemove.json.exceptions, ...afterRemove.json.excluded, ...afterRemove.json.dismissed]
    .find((entry) => entry.id === idea.id);
  assert.equal(noLongerSaved.saved, false);
});

test('hard budget preferences affect recommendation eligibility', async () => {
  const user = await makeUser(primary.port);
  const profile = await createProfile(primary.port, user, config({
    budgetPerActivity: 10,
    budgetHard: true,
    maxTravelMinutes: 15,
    allowExceptions: false,
  }));
  const result = await call(primary.port, 'GET', `/weekend?profile_id=${profile.id}`, { cookie: user.cookie });
  assert.equal(result.status, 200);
  assert.ok(result.json.included.every((idea) => idea.price <= 10 && idea.travelMinutes <= 15));
});

test('feedback validation and profile export/import round trip', async () => {
  const user = await makeUser(primary.port);
  const profile = await createProfile(primary.port, user);
  const invalid = await call(primary.port, 'POST', '/feedback', {
    cookie: user.cookie, csrf: user.csrf,
    body: { profileId: profile.id, itemId: 'idea-1', action: 'rating', rating: 9 },
  });
  assert.equal(invalid.status, 400);
  await call(primary.port, 'POST', '/feedback', {
    cookie: user.cookie, csrf: user.csrf,
    body: { profileId: profile.id, itemId: 'idea-1', action: 'rating', rating: 4 },
  });
  const exported = await call(primary.port, 'GET', `/profiles/${profile.id}/export`, { cookie: user.cookie });
  assert.equal(exported.status, 200);
  assert.equal(exported.json.schemaVersion, '1.0.0-draft');
  assert.equal(exported.json.feedback[0].rating, 4);
  const imported = await call(primary.port, 'POST', '/profiles/import', {
    cookie: user.cookie, csrf: user.csrf,
    body: exported.json,
  });
  assert.equal(imported.status, 201);
});

test('rate limits are persisted and secure cookies are configurable', async () => {
  const limited = await start({ AUTH_RATE_LIMIT: '1', TRUST_PROXY: '1' });
  try {
    const hit = (address) => call(limited.port, 'POST', '/auth/login', {
      headers: { 'X-Forwarded-For': address },
      body: { email: `unknown-${randomUUID()}@example.invalid`, password: 'wrong-password' },
    });
    assert.equal((await hit('198.51.100.81')).status, 401);
    assert.equal((await hit('198.51.100.82')).status, 401);
    assert.equal((await hit('198.51.100.81')).status, 429);
  } finally {
    await stop(limited);
  }
  const secure = await start({ COOKIE_SECURE: '1' });
  try {
    const user = await makeUser(secure.port);
    const response = await call(secure.port, 'POST', '/auth/login', {
      body: { email: user.email, password: user.password },
    });
    assert.match(response.headers['set-cookie'][0], /HttpOnly/);
    assert.match(response.headers['set-cookie'][0], /; Secure/);
  } finally {
    await stop(secure);
  }
});

test('plans, latest feedback, and sessions survive process restart; deletion cascades', async () => {
  const user = await makeUser(primary.port);
  const profile = await createProfile(primary.port, user);
  const plan = await call(primary.port, 'POST', `/week?profile_id=${profile.id}`, {
    cookie: user.cookie, csrf: user.csrf,
    body: { day: '2026-11-16', title: 'Restart regression plan', category: 'Work' },
  });
  assert.equal(plan.status, 201);
  for (const rating of [1, 5]) {
    assert.equal((await call(primary.port, 'POST', '/feedback', {
      cookie: user.cookie, csrf: user.csrf,
      body: { profileId: profile.id, itemId: 'e1', action: 'rating', rating },
    })).status, 200);
  }
  const beforeRestart = await call(primary.port, 'GET', `/weekend?profile_id=${profile.id}`, { cookie: user.cookie });
  await stop(primary);
  primary = await start();
  const profileAfterRestart = await call(primary.port, 'GET', `/profiles/${profile.id}`, { cookie: user.cookie });
  assert.equal(profileAfterRestart.status, 200);
  const afterRestart = await call(primary.port, 'GET', `/weekend?profile_id=${profile.id}`, { cookie: user.cookie });
  assert.deepEqual(afterRestart.json, beforeRestart.json);
  assert.equal(afterRestart.json.included.find((idea) => idea.id === 'e1').rating, 5);
  const plans = await call(primary.port, 'GET', `/week?profile_id=${profile.id}&week_start=2026-11-16`, { cookie: user.cookie });
  assert.equal(plans.json.items[0].id, plan.json.item.id);
  const deleted = await call(primary.port, 'DELETE', '/auth/account', {
    cookie: user.cookie, csrf: user.csrf, body: {},
  });
  assert.equal(deleted.status, 200);
  const afterDelete = await call(primary.port, 'GET', '/profiles', { cookie: user.cookie });
  assert.equal(afterDelete.status, 401);
  for (const table of ['gosie_profiles', 'gosie_sessions', 'gosie_week_items', 'gosie_feedback']) {
    assert.equal((await testPool.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE user_id=$1`, [user.id])).rows[0].count, 0);
  }
});

test('logs are structured and do not include credentials or request bodies', async () => {
  await call(primary.port, 'POST', '/auth/login', {
    body: { email: `log-${randomUUID()}@example.invalid`, password: 'not-a-loggable-secret' },
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.match(primary.logs(), /"path":"\/auth\/login"/);
  assert.doesNotMatch(primary.logs(), /not-a-loggable-secret/);
});

test('SIGTERM shuts down the API server cleanly', async () => {
  const server = await start();
  await stop(server);
  assert.equal(server.child.exitCode, 0);
});

test('imports preserve owned carry-over links and never reference existing users records', async () => {
  const owner = await makeUser(primary.port);
  const other = await makeUser(primary.port);
  const profile = await createProfile(primary.port, owner);
  const request = { cookie: owner.cookie, csrf: owner.csrf };
  const original = await call(primary.port, 'POST', `/week?profile_id=${profile.id}`, {
    ...request, body: { day: '2026-11-16', title: 'Portable plan', category: 'Personal' },
  });
  const carried = await call(primary.port, 'POST', `/week/${original.json.item.id}/carry-forward?profile_id=${profile.id}`, {
    ...request, body: {},
  });
  assert.equal(carried.status, 201);
  const exported = await call(primary.port, 'GET', `/profiles/${profile.id}/export`, request);
  const imported = await call(primary.port, 'POST', '/profiles/import', {
    cookie: other.cookie, csrf: other.csrf, body: exported.json,
  });
  assert.equal(imported.status, 201);
  const roundTrip = await call(primary.port, 'GET', `/profiles/${imported.json.id}/export`, { cookie: other.cookie });
  const [first, next] = roundTrip.json.weekItems;
  assert.notEqual(first.id, original.json.item.id);
  assert.equal(next.carriedFromId, first.id);
  assert.deepEqual(roundTrip.json.config, exported.json.config);
  const foreign = await call(primary.port, 'POST', '/profiles/import', {
    cookie: other.cookie, csrf: other.csrf,
    body: { ...exported.json, weekItems: [{ ...exported.json.weekItems[0], carriedFromId: original.json.item.id }] },
  });
  assert.equal(foreign.status, 201);
  const foreignExport = await call(primary.port, 'GET', `/profiles/${foreign.json.id}/export`, { cookie: other.cookie });
  assert.equal(foreignExport.json.weekItems[0].carriedFromId, null);
  const mismatch = await call(primary.port, 'POST', '/profiles/import', {
    ...request, body: { ...exported.json, schemaVersion: '2.0.0' },
  });
  assert.equal(mismatch.status, 400);
});
