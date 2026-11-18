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
const createdDiscoveryIds = new Set();

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
      BRAVE_SEARCH_ENABLED: '1',
      GOSIE_BRAVE_SEARCH_MOCK: '1',
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
    for (const id of createdDiscoveryIds) {
      await testPool.query('DELETE FROM gosie_week_ahead_discoveries WHERE id=$1', [id]);
    }
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

test('Week Ahead reviewed leads require moderator access, CSRF, and a second reviewer', async () => {
  const creator = await makeUser(primary.port);
  const reviewer = await makeUser(primary.port);
  const visitor = await makeUser(primary.port);
  await testPool.query(
    "INSERT INTO gosie_community_roles(user_id,role) VALUES ($1,'moderator'),($2,'moderator')",
    [creator.id, reviewer.id],
  );
  const base = '/week-ahead/discoveries';
  const review = `${base}/review`;
  const publicList = () => call(primary.port, 'GET', base);
  const draft = {
    title: 'Synthetic automated-test discovery lead',
    venue: 'Synthetic fixture venue',
    region: 'Synthetic test region',
    startsAt: null,
    price: { label: 'Price', value: null, status: 'unknown' },
    travel: { label: 'Travel', value: 'About 20 minutes', status: 'estimated' },
    accessibility: { label: 'Accessibility', value: null, status: 'unknown' },
    availability: { label: 'Availability', value: null, status: 'unknown' },
    publisher: 'Synthetic test source',
    sourceUrl: 'https://www.metmuseum.org/events',
    retrievedAt: '2026-11-18T12:00:00.000Z',
    whyIncluded: 'Synthetic record used only to verify the private moderator workflow.',
  };
  const auth = (user) => ({ cookie: user.cookie, csrf: user.csrf });
  assert.equal((await call(primary.port, 'GET', review)).status, 401);
  assert.equal((await call(primary.port, 'GET', review, { cookie: visitor.cookie })).status, 403);
  assert.equal((await call(primary.port, 'POST', review, { cookie: creator.cookie, body: draft })).status, 403);
  assert.equal((await call(primary.port, 'POST', review, { ...auth(visitor), body: draft })).status, 403);
  assert.equal((await call(primary.port, 'POST', review, {
    ...auth(creator), headers: { Origin: 'https://untrusted.invalid' }, body: draft,
  })).status, 403);
  assert.equal((await call(primary.port, 'POST', review, { ...auth(creator), body: {
    ...draft, sourceUrl: 'http://127.0.0.1/private',
  } })).status, 400);
  assert.equal((await call(primary.port, 'POST', review, { ...auth(creator), body: {
    ...draft, price: { label: 'Price', value: '$10', status: 'unknown' },
  } })).status, 400);

  const created = await call(primary.port, 'POST', review, { ...auth(creator), body: draft });
  assert.equal(created.status, 201);
  const id = created.json.entry.id;
  createdDiscoveryIds.add(id);
  assert.equal(created.json.entry.status, 'draft');
  assert.equal(created.json.entry.canApprove, false);
  assert.equal((await publicList()).json.entries.length, 0);
  assert.equal((await call(primary.port, 'GET', review, { cookie: visitor.cookie })).status, 403);
  assert.equal((await call(primary.port, 'POST', `${review}/${id}/approve`, {
    ...auth(creator), body: { version: created.json.entry.version },
  })).status, 403);

  const approved = await call(primary.port, 'POST', `${review}/${id}/approve`, {
    ...auth(reviewer), body: { version: created.json.entry.version },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.json.entry.status, 'approved');
  const publicApproved = await publicList();
  assert.equal(publicApproved.status, 200);
  assert.equal(publicApproved.json.entries.length, 1);
  assert.equal(publicApproved.json.entries[0].title, draft.title);
  assert.deepEqual(Object.keys(publicApproved.json.entries[0]).sort(), [
    'id', ...Object.keys(draft), 'approval',
  ].sort());
  assert.equal((await publicList()).headers['cache-control'], 'no-store');

  const edited = await call(primary.port, 'PUT', `${review}/${id}`, {
    ...auth(reviewer), body: { ...draft, title: 'Edited synthetic test lead', version: approved.json.entry.version },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.json.entry.status, 'draft');
  assert.equal((await publicList()).json.entries.length, 0);
  assert.equal((await call(primary.port, 'POST', `${review}/${id}/approve`, {
    ...auth(reviewer), body: { version: edited.json.entry.version },
  })).status, 403);
  assert.equal((await call(primary.port, 'PUT', `${review}/${id}`, {
    ...auth(creator), body: { ...draft, version: approved.json.entry.version },
  })).status, 409);
  const reapproved = await call(primary.port, 'POST', `${review}/${id}/approve`, {
    ...auth(creator), body: { version: edited.json.entry.version },
  });
  assert.equal(reapproved.status, 200);
  assert.equal((await publicList()).json.entries[0].title, 'Edited synthetic test lead');

  const withdrawn = await call(primary.port, 'POST', `${review}/${id}/withdraw`, {
    ...auth(reviewer), body: { version: reapproved.json.entry.version },
  });
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.json.entry.status, 'withdrawn');
  assert.equal((await publicList()).json.entries.length, 0);
  const history = await testPool.query(
    'SELECT action FROM gosie_week_ahead_discovery_history WHERE discovery_id=$1 ORDER BY id', [id],
  );
  assert.deepEqual(history.rows.map((row) => row.action), ['created', 'approved', 'edited', 'approved', 'withdrawn']);
  await testPool.query('DELETE FROM gosie_users WHERE id=$1', [reviewer.id]);
  const retained = await testPool.query('SELECT status,withdrawn_by FROM gosie_week_ahead_discoveries WHERE id=$1', [id]);
  assert.equal(retained.rows[0].status, 'withdrawn');
  assert.equal(retained.rows[0].withdrawn_by, null);
  await testPool.query('DELETE FROM gosie_week_ahead_discoveries WHERE id=$1', [id]);
  for (const user of [creator, reviewer, visitor]) await testPool.query('DELETE FROM gosie_users WHERE id=$1', [user.id]);
});

test('research catalog requires a session and exposes only the approved contract', async () => {
  assert.equal((await call(primary.port, 'GET', '/discoveries')).status, 401);
  const user = await makeUser(primary.port);
  try {
    const result = await call(primary.port, 'GET', '/discoveries', { cookie: user.cookie });
    assert.equal(result.status, 200);
    assert.equal(result.json.schemaVersion, 1);
    assert.ok(Array.isArray(result.json.records));
    assert.equal(result.json.candidates, undefined);
  } finally {
    // Do not occupy a place in the existing five-account enrollment test.
    await testPool.query('DELETE FROM gosie_users WHERE id=$1', [user.id]);
  }
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

test('organization access requires reviewed operator decisions and safe revocation', async (t) => {
  const operator = await makeUser(primary.port);
  const moderator = await makeUser(primary.port);
  const reader = await makeUser(primary.port);
  const organization = await makeUser(primary.port);
  await testPool.query('INSERT INTO gosie_community_operators(user_id) VALUES ($1)', [operator.id]);
  await testPool.query("INSERT INTO gosie_community_roles(user_id,role) VALUES ($1,'moderator')", [moderator.id]);
  const base = '/community/organization-access';
  const auth = (user) => ({ cookie: user.cookie, csrf: user.csrf });
  const get = (user) => call(primary.port, 'GET', base, user ? auth(user) : {});
  const post = (body, user = operator, route = base) => call(primary.port, 'POST', route, { ...auth(user), body });
  const draft = { userId: organization.id, organizationType: 'venue', publicIdentity: 'Synthetic community venue',
    reason: 'Synthetic manual representation review; not a real grant.' };
  let grant;
  let pending;
  await t.test('only explicit operators see access history; moderator status is insufficient', async () => {
    assert.equal((await get()).status, 401);
    for (const user of [reader, moderator, organization]) {
      assert.equal((await get(user)).status, 403);
      assert.equal((await post(draft, user)).status, 403);
    }
    assert.equal((await get(operator)).status, 200);
    const mine = (user) => call(primary.port, 'GET', '/community/mine', auth(user));
    assert.equal((await mine(operator)).json.isOperator, true);
    assert.equal((await mine(moderator)).json.isOperator, false);
    assert.equal((await call(primary.port, 'GET', '/community/moderation', auth(operator))).status, 403);
  });
  await t.test('CSRF, self-grants, unsupported privileges and incomplete reviews are rejected', async () => {
    for (const route of [base, `${base}/revoke`]) {
      assert.equal((await call(primary.port, 'POST', route, { cookie: operator.cookie, body: draft })).status, 403);
      assert.equal((await call(primary.port, 'POST', route, { cookie: operator.cookie, csrf: 'wrong', body: draft })).status, 403);
    }
    assert.equal((await post({ ...draft, userId: operator.id })).status, 403);
    for (const override of [{ organizationType: 'moderator' }, { organizationType: 'operator' }, { reason: '' },
      { publicIdentity: ' ' }, { reason: 'x'.repeat(1001) }, { approved: true }, { isOperator: true }]) {
      assert.equal((await post({ ...draft, ...override })).status, 400);
    }
    assert.equal((await post({ ...draft, userId: `absent-${randomUUID()}` })).status, 404);
  });
  await t.test('reviewed access records the identity and reason without enabling self-publication', async () => {
    assert.equal((await post(draft)).status, 201);
    const list = (await get(operator)).json;
    grant = list.grants.find((row) => row.userId === organization.id);
    assert.equal(grant.publicIdentity, draft.publicIdentity);
    assert.equal(grant.legacy, false);
    const review = list.reviews.find((row) => row.userId === organization.id);
    assert.equal(review.action, 'grant');
    assert.equal(review.reason, draft.reason);
    assert.equal(review.reviewedBy, operator.id);
    assert.equal((await post({ ...draft, organizationType: 'nonprofit' })).status, 409);
    const result = await post({ kind: 'gem', title: 'Synthetic organization gem', description: 'Synthetic, not a real discovery.',
      location: 'Fictional location', attribution: 'Forged client identity' }, organization, '/community/items');
    assert.equal(result.status, 201);
    pending = result.json.item;
    assert.equal(pending.attribution, draft.publicIdentity);
    assert.equal(pending.status, 'pending');
    assert.equal((await call(primary.port, 'GET', '/community/items')).json.items.some((item) => item.id === pending.id), false);
    assert.equal((await call(primary.port, 'GET', '/community/moderation', auth(operator))).status, 403);
    assert.equal((await post({ decision: 'approved' }, organization, `/community/moderation/items/${pending.id}`)).status, 403);
  });
  await t.test('revocation requires the current version and an operator review reason', async () => {
    const revocation = { userId: organization.id, organizationType: 'venue', accessVersion: grant.accessVersion, reason: 'Synthetic access revocation after manual review.' };
    assert.equal((await post(revocation, moderator, `${base}/revoke`)).status, 403);
    assert.equal((await post({ ...revocation, reason: 'short' }, operator, `${base}/revoke`)).status, 400);
    assert.equal((await post({ ...revocation, accessVersion: 'stale' }, operator, `${base}/revoke`)).status, 409);
    assert.equal((await post(revocation, operator, `${base}/revoke`)).status, 200);
    assert.equal((await post(revocation, operator, `${base}/revoke`)).status, 409);
    const list = (await get(operator)).json;
    assert.equal(list.grants.some((row) => row.userId === organization.id), false);
    assert.equal(list.reviews.find((row) => row.userId === organization.id && row.action === 'revoke').reason, revocation.reason);
    assert.equal((await post({ kind: 'gem', title: 'Blocked', description: 'Synthetic denied attempt.', location: 'Fictional', attribution: 'Fake' }, organization, '/community/items')).status, 403);
    assert.equal((await post({ text: 'Blocked note' }, organization, '/community/items/unknown/comments')).status, 403);
    const mine = (await call(primary.port, 'GET', '/community/mine', auth(organization))).json;
    assert.equal(mine.items.find((row) => row.id === pending.id).status, 'pending');
    assert.equal((await call(primary.port, 'GET', '/community/mine', auth(reader))).json.items.some((item) => item.id === pending.id), false);
    assert.equal((await call(primary.port, 'GET', '/community/items')).json.items.some((item) => item.id === pending.id), false);
    assert.equal((await post(draft)).status, 201);
    assert.equal((await post(revocation, operator, `${base}/revoke`)).status, 409, 'stale revoke cannot undo a new grant');
    const current = (await get(operator)).json.grants.find((row) => row.userId === organization.id);
    assert.notEqual(current.accessVersion, grant.accessVersion);
  });
  await t.test('each organization type can be granted and revoked without granting moderation or retaining account data', async () => {
    const target = await makeUser(primary.port);
    for (const organizationType of ['venue', 'municipality', 'nonprofit', 'restaurant-owner']) {
      assert.equal((await post({ ...draft, userId: target.id, organizationType })).status, 201);
      const current = (await get(operator)).json.grants.find((row) => row.userId === target.id);
      assert.equal(current.publicIdentity, draft.publicIdentity);
      const mine = (await call(primary.port, 'GET', '/community/mine', auth(target))).json;
      assert.deepEqual(mine.roles, [organizationType]);
      assert.equal(mine.isOperator, false);
      assert.equal((await post({ userId: target.id, organizationType, accessVersion: current.accessVersion,
        reason: 'Synthetic reviewed removal for lifecycle coverage.' }, operator, `${base}/revoke`)).status, 200);
    }
    assert.equal((await get(operator)).json.reviews.filter((row) => row.userId === target.id).length, 8);
    await testPool.query('DELETE FROM gosie_users WHERE id=$1', [target.id]);
    assert.equal((await testPool.query('SELECT id FROM gosie_organization_access_reviews WHERE user_id=$1', [target.id])).rowCount, 0);
  });
  await t.test('competing grants serialize and explicit operator removal takes effect on the next request', async () => {
    const next = await makeUser(primary.port);
    const results = await Promise.all(['municipality', 'nonprofit'].map((organizationType) => post({ ...draft, userId: next.id, organizationType })));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    const role = (await get(operator)).json.grants.find((row) => row.userId === next.id).organizationType;
    assert.ok(['municipality', 'nonprofit'].includes(role));
    await testPool.query('DELETE FROM gosie_community_operators WHERE user_id=$1', [operator.id]);
    assert.equal((await get(operator)).status, 403);
    assert.equal((await post(draft)).status, 403);
  });
});

test('Communities enforce grants, privacy, moderation, expiry, and owner attribution', async (t) => {
  const reader = await makeUser(primary.port);
  const contributor = await makeUser(primary.port);
  const owner = await makeUser(primary.port);
  const moderator = await makeUser(primary.port);
  const auth = (user) => ({ cookie: user.cookie, csrf: user.csrf });
  const get = (route, user) => call(primary.port, 'GET', route, user ? auth(user) : {});
  const post = (route, body, user = contributor) => call(primary.port, 'POST', route, { ...auth(user), body });
  const future = new Date(Date.now() + 86400000 * 3);
  const draft = {
    kind: 'event', title: 'Synthetic community event', description: 'Synthetic automated test, not a real listing.',
    location: 'Fictional test neighborhood', attribution: 'Synthetic contributor', sourceUrl: 'https://example.invalid/event',
    startsAt: future.toISOString(), endsAt: new Date(future.getTime() + 3600000).toISOString(),
  };
  let item, gem, comment, rejected;
  const moderate = (type, id, decision = 'approved', user = moderator) =>
    post(`/community/moderation/${type}/${id}`, {
      decision, decisionReason: decision === 'approved'
        ? 'Useful practical local information, with contributor-supplied details.'
        : 'Please add practical local details rather than advertising-only claims.',
    }, user);
  await t.test('unassigned users cannot submit, self-grant, or enter moderator queue', async () => {
    assert.equal((await post('/community/items', draft, reader)).status, 403);
    assert.equal((await post('/community/roles', { role: 'moderator' }, reader)).status, 404);
    assert.equal((await get('/community/moderation', reader)).status, 403);
    assert.equal((await get('/community/mine', reader)).json.roles.length, 0);
    assert.equal((await post('/community/items', draft, { ...reader, csrf: 'wrong' })).status, 403);
    assert.equal((await call(primary.port, 'POST', '/community/items', { body: draft })).status, 401);
    await testPool.query("INSERT INTO gosie_community_roles (user_id,role) VALUES ($1,'contributor'),($2,'moderator')", [contributor.id, moderator.id]);
    await testPool.query("INSERT INTO gosie_community_roles (user_id,role,restaurant_name) VALUES ($1,'restaurant-owner','Synthetic restaurant')", [owner.id]);
    assert.equal((await post('/community/items', { ...draft, status: 'approved', role: 'moderator' })).status, 400);
  });
  await t.test('new items are private pending, including from another contributor', async () => {
    const result = await post('/community/items', draft);
    assert.equal(result.status, 201);
    item = result.json.item;
    assert.equal(item.status, 'pending');
    assert.equal((await get('/community/mine', contributor)).json.items.some((row) => row.id === item.id), true);
    assert.equal((await get('/community/mine', owner)).json.items.some((row) => row.id === item.id), false);
    assert.equal((await get('/community/items')).json.items.some((row) => row.id === item.id), false);
    assert.equal((await get(`/community/items/${item.id}`, owner)).status, 404);
    assert.equal((await get('/community/moderation', moderator)).json.items.some((row) => row.id === item.id), true);
    assert.equal((await post(`/community/items/${item.id}/comments`, { text: 'No private comments allowed' }, owner)).status, 404);
  });
  await t.test('decisions require a bounded reason and cannot bypass moderator or CSRF checks', async () => {
    const route = `/community/moderation/items/${item.id}`;
    for (const decision of ['approved', 'rejected']) {
      for (const decisionReason of [undefined, null, 123, '', '         ', 'too short', 'x'.repeat(1001)]) {
        const response = await post(route, { decision, decisionReason }, moderator);
        assert.equal(response.status, 400);
        assert.equal(response.json.error, 'decision_reason_required_10_to_1000_characters');
      }
    }
    const body = { decision: 'approved', decisionReason: 'Useful practical local details.' };
    assert.equal((await post(route, { ...body, reviewed_by: reader.id }, moderator)).status, 400);
    assert.equal((await post(route, body, reader)).status, 403);
    assert.equal((await post(route, body, { ...moderator, csrf: 'wrong' })).status, 403);
    assert.equal((await call(primary.port, 'POST', route, { body })).status, 401);
    assert.equal((await get('/community/mine', contributor)).json.items.find((row) => row.id === item.id).status, 'pending');
  });
  await t.test('moderators approve others, not themselves; stale transitions fail', async () => {
    await testPool.query("INSERT INTO gosie_community_roles (user_id,role) VALUES ($1,'moderator')", [contributor.id]);
    const selfQueueItem = (await get('/community/moderation', contributor)).json.items.find((row) => row.id === item.id);
    assert.equal(selfQueueItem.canReview, false);
    const otherQueueItem = (await get('/community/moderation', moderator)).json.items.find((row) => row.id === item.id);
    assert.equal(otherQueueItem.canReview, true);
    for (const decision of ['approved', 'rejected']) {
      assert.equal((await moderate('items', item.id, decision, contributor)).status, 403);
    }
    assert.equal((await moderate('items', item.id)).status, 200);
    assert.equal((await moderate('items', item.id, 'rejected')).status, 409);
    const publicItem = (await get('/community/items')).json.items.find((row) => row.id === item.id);
    assert.equal(publicItem.attribution, draft.attribution);
    assert.ok(publicItem.reviewedAt);
    assert.equal('user_id' in publicItem, false);
    assert.equal(publicItem.expired, false);
    assert.match(publicItem.why, /contributor-supplied/);
    assert.equal(Object.hasOwn(publicItem, 'decisionReason'), false);
    assert.equal(Object.hasOwn(publicItem, 'decision_reason'), false);
    assert.equal(Object.hasOwn(publicItem, 'canReview'), false);
    const privateItem = (await get('/community/mine', contributor)).json.items.find((row) => row.id === item.id);
    assert.match(privateItem.decisionReason, /Useful practical local information/);
    assert.equal(Object.hasOwn(privateItem, 'reviewed_by'), false);
  });
  await t.test('only designated owners comment and comments stay private until separately approved', async () => {
    assert.equal((await post(`/community/items/${item.id}/comments`, { text: 'Not an owner' }, reader)).status, 403);
    assert.equal((await post(`/community/items/${item.id}/comments`, { text: 'Forged', attribution: 'Fake restaurant' }, owner)).status, 400);
    const result = await post(`/community/items/${item.id}/comments`, { text: 'Synthetic special event note' }, owner);
    assert.equal(result.status, 201);
    comment = result.json.comment;
    assert.equal(comment.attribution, 'Synthetic restaurant');
    assert.equal((await get('/community/items')).json.items.find((row) => row.id === item.id).comments.length, 0);
    assert.equal((await get('/community/mine', reader)).json.comments.some((row) => row.id === comment.id), false);
    assert.equal((await get('/community/mine', owner)).json.comments.some((row) => row.id === comment.id), true);
    const invalid = await post(`/community/moderation/comments/${comment.id}`, { decision: 'rejected', decisionReason: 'short' }, moderator);
    assert.equal(invalid.status, 400);
    assert.equal((await moderate('comments', comment.id)).status, 200);
    assert.equal((await get('/community/items')).json.items.find((row) => row.id === item.id).comments[0].id, comment.id);
    assert.match((await get('/community/mine', owner)).json.comments.find((row) => row.id === comment.id).decisionReason, /Useful practical/);
  });
  await t.test('evergreen gems have no schedule and reject dates, invalid events and unsafe links', async () => {
    for (const bad of [
      { ...draft, endsAt: draft.startsAt },
      { ...draft, startsAt: '2030-02-30T10:00:00Z' },
      { ...draft, startsAt: '2030-12-01T10:00' },
      { ...draft, sourceUrl: 'javascript:alert(1)' },
      { ...draft, sourceUrl: 'https://user:password@example.invalid/' },
      { ...draft, kind: 'gem' },
    ]) assert.equal((await post('/community/items', bad)).status, 400);
    const result = await post('/community/items', { ...draft, kind: 'gem', startsAt: null, endsAt: null });
    assert.equal(result.status, 201);
    gem = result.json.item;
    assert.equal((await moderate('items', gem.id)).status, 200);
    const publishedGem = (await get('/community/items')).json.items.find((row) => row.id === gem.id);
    assert.equal(publishedGem.startsAt, null);
    assert.equal(publishedGem.endsAt, null);
    assert.match(publishedGem.why, /not a scheduled event/);
    assert.equal((await post(`/community/items/${gem.id}/comments`, { text: 'Not an event' }, owner)).status, 404);
  });
  await t.test('venues, municipalities and nonprofits share under assigned identities and remain moderated', async () => {
    for (const role of ['venue', 'municipality', 'nonprofit']) {
      const organization = await makeUser(primary.port);
      const name = `Synthetic ${role}`;
      await assert.rejects(testPool.query(
        'INSERT INTO gosie_community_roles (user_id,role) VALUES ($1,$2)', [organization.id, role],
      ), /check constraint/);
      await testPool.query(
        'INSERT INTO gosie_community_roles (user_id,role,organization_name) VALUES ($1,$2,$3)',
        [organization.id, role, name],
      );
      const submitted = await post('/community/items', { ...draft, attribution: 'Spoofed credit', kind: 'gem', startsAt: null, endsAt: null }, organization);
      assert.equal(submitted.status, 201);
      assert.equal(submitted.json.item.status, 'pending');
      assert.equal(submitted.json.item.attribution, name);
      assert.equal((await get('/community/items')).json.items.some((row) => row.id === submitted.json.item.id), false);
      assert.equal((await get('/community/mine', reader)).json.items.some((row) => row.id === submitted.json.item.id), false);
      assert.equal((await get('/community/moderation', organization)).status, 403);
      assert.equal((await post(`/community/items/${item.id}/comments`, { text: 'Useful organization detail', attribution: 'Spoofed' }, organization)).status, 400);
      const note = await post(`/community/items/${item.id}/comments`, { text: 'Useful organization detail' }, organization);
      assert.equal(note.status, 201);
      assert.equal(note.json.comment.attribution, name);
      assert.equal(note.json.comment.status, 'pending');
      assert.equal((await get('/community/items')).json.items.find((row) => row.id === item.id).comments.some((row) => row.id === note.json.comment.id), false);
      await testPool.query("INSERT INTO gosie_community_roles (user_id,role) VALUES ($1,'moderator')", [organization.id]);
      assert.equal((await moderate('items', submitted.json.item.id, 'approved', organization)).status, 403);
      assert.equal((await moderate('comments', note.json.comment.id, 'approved', organization)).status, 403);
      assert.equal((await moderate('comments', note.json.comment.id, 'rejected', organization)).status, 403);
      assert.equal((await moderate('items', submitted.json.item.id)).status, 200);
      assert.equal((await moderate('comments', note.json.comment.id)).status, 200);
    }
  });
  await t.test('public and archived feeds omit private reasons on every item and nested comment, even for a moderator', async () => {
    for (const actor of [undefined, reader, owner, contributor, moderator]) {
      for (const route of ['/community/items', '/community/items?includeExpired=true']) {
        const result = await get(route, actor);
        assert.equal(result.status, 200);
        const approved = result.json.items.find((row) => row.id === item.id);
        assert.ok(approved.comments.length >= 4, 'exercise multiple nested comments, not only the first');
        for (const row of result.json.items.flatMap((entry) => [entry, ...entry.comments])) {
          for (const field of ['decisionReason', 'decision_reason', 'reviewed_by', 'canReview', 'user_id']) {
            assert.equal(Object.hasOwn(row, field), false, `public response leaked ${field}`);
          }
        }
      }
    }
  });
  await t.test('rejected submissions and comments remain private and never enter public reads', async () => {
    rejected = (await post('/community/items', { ...draft, title: 'Rejected synthetic submission' })).json.item;
    assert.equal((await moderate('items', rejected.id, 'rejected')).status, 200);
    const pendingComment = (await post(`/community/items/${item.id}/comments`, { text: 'Rejected synthetic note' }, owner)).json.comment;
    assert.equal((await moderate('comments', pendingComment.id, 'rejected')).status, 200);
    const publicFeed = (await get('/community/items?includeExpired=true')).json.items;
    assert.equal(publicFeed.some((row) => row.id === rejected.id), false);
    assert.equal(publicFeed.find((row) => row.id === item.id).comments.some((row) => row.id === pendingComment.id), false);
    assert.equal((await get('/community/mine', contributor)).json.items.find((row) => row.id === rejected.id).status, 'rejected');
    assert.match((await get('/community/mine', contributor)).json.items.find((row) => row.id === rejected.id).decisionReason, /rather than advertising/);
    assert.match((await get('/community/mine', owner)).json.comments.find((row) => row.id === pendingComment.id).decisionReason, /rather than advertising/);
    assert.equal((await get('/community/mine', reader)).json.items.some((row) => row.id === rejected.id), false);
    assert.equal((await get('/community/mine', reader)).json.comments.some((row) => row.id === pendingComment.id), false);
  });
  await t.test('trimmed reasons are stored atomically and a later stale decision cannot overwrite them', async () => {
    const target = (await post('/community/items', { ...draft, kind: 'gem', startsAt: null, endsAt: null })).json.item;
    const reason = 'Please include public opening hours or a source for your claims.';
    const route = `/community/moderation/items/${target.id}`;
    assert.equal((await post(route, { decision: 'rejected', decisionReason: `  ${reason}  ` }, moderator)).status, 200);
    assert.equal((await moderate('items', target.id)).status, 409);
    const own = (await get('/community/mine', contributor)).json.items.find((row) => row.id === target.id);
    assert.equal(own.decisionReason, reason);
    assert.equal(own.status, 'rejected');
    assert.ok(own.reviewedAt);
    const stored = (await testPool.query('SELECT status,decision_reason,reviewed_by FROM gosie_community_items WHERE id=$1', [target.id])).rows[0];
    assert.equal(stored.decision_reason, reason);
    assert.equal(stored.reviewed_by, moderator.id);
  });
  await t.test('legacy reviewed records have no invented reason', async () => {
    const target = (await post('/community/items', { ...draft, kind: 'gem', startsAt: null, endsAt: null })).json.item;
    await testPool.query("UPDATE gosie_community_items SET status='rejected',reviewed_at=NOW() WHERE id=$1", [target.id]);
    const own = (await get('/community/mine', contributor)).json.items.find((row) => row.id === target.id);
    assert.equal(own.decisionReason, null);
  });
  await t.test('competing moderators cannot overwrite the winning status or private reason', async () => {
    const target = (await post('/community/items', { ...draft, kind: 'gem', startsAt: null, endsAt: null })).json.item;
    const decisions = [
      { decision: 'approved', decisionReason: 'Practical local details with a credible public source.' },
      { decision: 'rejected', decisionReason: 'Please clarify the source before sharing this publicly.' },
    ];
    const results = await Promise.all(decisions.map((body) =>
      post(`/community/moderation/items/${target.id}`, body, moderator)));
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    const winner = decisions[results.findIndex((result) => result.status === 200)];
    const own = (await get('/community/mine', contributor)).json.items.find((row) => row.id === target.id);
    assert.equal(own.status, winner.decision);
    assert.equal(own.decisionReason, winner.decisionReason);
  });
  await t.test('expired events are omitted by default, explicitly labeled in archive and cannot receive new notes', async () => {
    await testPool.query("UPDATE gosie_community_items SET starts_at=NOW()-INTERVAL '2 hours',ends_at=NOW()-INTERVAL '1 hour' WHERE id=$1", [item.id]);
    assert.equal((await get('/community/items')).json.items.some((row) => row.id === item.id), false);
    const archived = (await get('/community/items?includeExpired=true')).json.items.find((row) => row.id === item.id);
    assert.equal(archived.expired, true);
    assert.equal(archived.comments[0].id, comment.id);
    assert.equal((await post(`/community/items/${item.id}/comments`, { text: 'Too late' }, owner)).status, 404);
    const pendingExpired = (await post('/community/items', draft)).json.item;
    await testPool.query("UPDATE gosie_community_items SET starts_at=NOW()-INTERVAL '2 hours',ends_at=NOW()-INTERVAL '1 hour' WHERE id=$1", [pendingExpired.id]);
    assert.equal((await moderate('items', pendingExpired.id)).status, 409);
    assert.equal((await moderate('items', pendingExpired.id, 'rejected')).status, 200);
  });
  await t.test('community records and grants follow account deletion', async () => {
    assert.equal((await call(primary.port, 'DELETE', '/auth/account', { ...auth(contributor), body: {} })).status, 200);
    for (const table of ['gosie_community_roles', 'gosie_community_items', 'gosie_community_comments']) {
      assert.equal((await testPool.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE user_id=$1`, [contributor.id])).rows[0].count, 0);
    }
    assert.equal((await get('/community/items?includeExpired=true')).json.items.some((row) => row.id === gem.id || row.id === item.id), false);
  });
});

test('revoked organization contributions get private, reasoned, non-publishing re-review', async (t) => {
  const operator = await makeUser(primary.port), organization = await makeUser(primary.port);
  const moderator = await makeUser(primary.port), reader = await makeUser(primary.port);
  const person = await makeUser(primary.port);
  const auth = (u) => ({ cookie: u.cookie, csrf: u.csrf });
  const get = (route, u) => call(primary.port, 'GET', route, u ? auth(u) : {});
  const post = (route, body, u = moderator) => call(primary.port, 'POST', route, { ...auth(u), body });
  const name = 'Synthetic re-review organization';
  await testPool.query('INSERT INTO gosie_community_operators(user_id) VALUES ($1)', [operator.id]);
  await testPool.query("INSERT INTO gosie_community_roles(user_id,role) VALUES ($1,'moderator'),($2,'contributor'),($2,'moderator'),($3,'contributor')",
    [moderator.id, organization.id, person.id]);
  const draft = { kind: 'gem', title: 'Synthetic local resource', description: 'Synthetic useful local details.',
    location: 'Fictional test area', attribution: name };
  const submit = async (u = organization, extra = {}) => {
    const result = await post('/community/items', { ...draft, ...extra }, u);
    assert.equal(result.status, 201); return result.json.item;
  };
  const approve = (kind, id) => post(`/community/moderation/${kind}/${id}`,
    { decision: 'approved', decisionReason: 'Practical local details are useful to people.' });
  const individual = await submit();
  assert.equal((await post('/community/organization-access', { userId: organization.id, organizationType: 'venue',
    publicIdentity: name, reason: 'Synthetic authorized representation review.' }, operator)).status, 201);
  const approved = await submit(), pending = await submit(), legacy = await submit();
  assert.equal((await approve('items', approved.id)).status, 200);
  await testPool.query('UPDATE gosie_community_items SET organization_role=NULL,organization_access_version=NULL WHERE id=$1', [legacy.id]);
  const future = new Date(Date.now() + 86400000 * 2);
  const event = await submit(person, { kind: 'event', startsAt: future.toISOString(),
    endsAt: new Date(future.getTime() + 3600000).toISOString() });
  assert.equal((await approve('items', event.id)).status, 200);
  const note = (await post(`/community/items/${event.id}/comments`, { text: 'Synthetic practical organization note.' }, organization)).json.comment;
  const pendingNote = (await post(`/community/items/${event.id}/comments`, { text: 'Synthetic pending organization note.' }, organization)).json.comment;
  assert.equal((await approve('comments', note.id)).status, 200);
  const grants = (await get('/community/organization-access', operator)).json.grants;
  const grant = grants.find((row) => row.userId === organization.id);
  assert.equal((await post('/community/organization-access/revoke', { userId: organization.id,
    organizationType: 'venue', accessVersion: grant.accessVersion, reason: 'PRIVATE synthetic operator revocation explanation.' }, operator)).status, 200);
  let reviews = (await get('/community/organization-reviews', moderator)).json.reviews;
  const reviewOf = (id) => reviews.find((row) => row.content.id === id);
  const decide = (review, action, u = moderator, extra = {}) =>
    post(`/community/organization-reviews/${review.revocationId}/${review.contentType}/${review.content.id}`,
      { action, expectedStatus: review.content.status, reason: 'Useful local information evaluated independently of access.', ...extra }, u);

  await t.test('revocation preserves attribution and visibility, blocks future organization writes, and identifies legacy uncertainty', async () => {
    for (const id of [approved.id, pending.id, legacy.id, note.id, pendingNote.id]) assert.ok(reviewOf(id));
    assert.equal(reviewOf(approved.id).basis, 'recorded-grant');
    assert.equal(reviewOf(legacy.id).basis, 'legacy-attribution');
    assert.equal(reviewOf(note.id).parent.id, event.id);
    assert.equal(Object.hasOwn(reviewOf(note.id).parent, 'user_id'), false);
    assert.equal(reviewOf(individual.id), undefined, 'new individually attributed posts must not be inferred as organization posts');
    assert.equal(reviewOf(approved.id).content.attribution, name);
    assert.equal(reviewOf(approved.id).content.status, 'approved');
    assert.equal(reviewOf(pending.id).content.status, 'pending');
    assert.equal(JSON.stringify(reviews).includes('PRIVATE synthetic'), false);
    const own = (await get('/community/organization-reviews', organization)).json.reviews;
    assert.equal(own.find((row) => row.content.id === approved.id).canReview, false);
    const feed = (await get('/community/items')).json.items;
    assert.equal(feed.some((row) => row.id === approved.id), true);
    assert.equal(feed.some((row) => row.id === pending.id), false);
    assert.equal(feed.find((row) => row.id === event.id).comments.some((row) => row.id === note.id), true);
    assert.equal((await post(`/community/items/${event.id}/comments`, { text: 'No longer permitted.' }, organization)).status, 403);
    const newPersonal = await submit();
    assert.equal((await testPool.query('SELECT organization_role FROM gosie_community_items WHERE id=$1', [newPersonal.id])).rows[0].organization_role, 'individual');
  });
  await t.test('only another moderator with CSRF and a valid reason can act; pending approval cannot bypass re-review', async () => {
    const review = reviewOf(pending.id);
    assert.equal((await get('/community/organization-reviews')).status, 401);
    for (const actor of [reader, operator]) {
      assert.equal((await get('/community/organization-reviews', actor)).status, 403);
      assert.equal((await decide(review, 'retain', actor)).status, 403);
    }
    for (const action of ['retain', 'hide', 'dismiss']) assert.equal((await decide(review, action, organization)).status, 403);
    assert.equal((await decide(review, 'retain', { ...moderator, csrf: 'wrong' })).status, 403);
    assert.equal((await decide(review, 'retain', moderator, { reason: 'short' })).status, 400);
    assert.equal((await decide(review, 'retain', moderator, { reason: 'x'.repeat(1001) })).status, 400);
    assert.equal((await decide(review, 'retain', moderator, { arbitrary: true })).status, 400);
    assert.equal((await approve('items', pending.id)).status, 409);
    assert.equal((await approve('comments', pendingNote.id)).status, 409);
    assert.equal((await decide(review, 'dismiss')).status, 400);
  });
  await t.test('retain never approves pending content, stale decisions fail, and separate ordinary moderation is still required', async () => {
    const review = reviewOf(pending.id);
    assert.equal((await decide(review, 'retain', moderator, { expectedStatus: 'approved' })).status, 409);
    const result = await decide(review, 'retain');
    assert.equal(result.status, 200); assert.equal(result.json.status, 'pending');
    assert.equal((await decide(review, 'hide')).status, 409);
    assert.equal((await get('/community/items')).json.items.some((row) => row.id === pending.id), false);
    assert.equal((await approve('items', pending.id)).status, 200);
    assert.equal((await decide(reviewOf(pendingNote.id), 'retain')).json.status, 'pending');
    assert.equal((await approve('comments', pendingNote.id)).status, 200);
  });
  await t.test('re-granting does not erase old review flags; explicit hide removes approved items and notes without deletion', async () => {
    assert.equal((await post('/community/organization-access', { userId: organization.id, organizationType: 'nonprofit',
      publicIdentity: 'Synthetic new identity', reason: 'Synthetic independent new organization approval.' }, operator)).status, 201);
    reviews = (await get('/community/organization-reviews', moderator)).json.reviews;
    assert.ok(reviewOf(approved.id)); assert.ok(reviewOf(note.id));
    const reason = 'Outdated local details need a reliable current source.';
    assert.equal((await decide(reviewOf(approved.id), 'hide', moderator, { reason })).status, 200);
    assert.equal((await decide(reviewOf(note.id), 'hide', moderator, { reason })).status, 200);
    const feed = (await get('/community/items?includeExpired=true')).json.items;
    assert.equal(feed.some((row) => row.id === approved.id), false);
    assert.equal(feed.find((row) => row.id === event.id).comments.some((row) => row.id === note.id), false);
    const own = (await get('/community/mine', organization)).json;
    assert.equal(own.items.find((row) => row.id === approved.id).decisionReason, reason);
    assert.equal(own.comments.find((row) => row.id === note.id).decisionReason, reason);
    assert.equal(own.items.find((row) => row.id === approved.id).attribution, name);
    const stored = (await testPool.query('SELECT * FROM gosie_organization_content_reviews WHERE item_id=$1', [approved.id])).rows[0];
    assert.equal(stored.before_status, 'approved');
    assert.match(stored.before_decision_reason, /Practical local details/);
  });
  await t.test('legacy mismatch dismissal preserves pending privacy; no review or provenance fields enter public feeds', async () => {
    assert.equal((await decide(reviewOf(legacy.id), 'dismiss')).json.status, 'pending');
    assert.equal((await get('/community/organization-reviews', moderator)).json.reviews.some((row) => row.content.id === legacy.id), false);
    const response = await get('/community/items?includeExpired=true');
    assert.equal(response.json.items.some((row) => row.id === legacy.id), false);
    for (const field of ['revocationId', 'basis', 'organization_role', 'organization_access_version', 'reviewed_by', 'decisionReason']) {
      assert.equal(response.text.includes(`\"${field}\"`), false);
    }
    assert.equal(response.text.includes('PRIVATE synthetic'), false);
  });
});

test('Brave searches require an authenticated CSRF-protected, explicit, bounded transient request', async (t) => {
  const api = await start({ GOSIE_BRAVE_SEARCH_MOCK: '1' });
  const user = await makeUser(primary.port);
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const body = { region: 'Brooklyn, NY', startDate: date, endDate: end, category: 'arts', termsAccepted: true };
  try {
    await t.test('no account or CSRF means no provider request', async () => {
      assert.equal((await call(api.port, 'POST', '/discoveries/search', { body })).status, 401);
      assert.equal((await call(api.port, 'POST', '/discoveries/search', { cookie: user.cookie, body })).status, 403);
    });
    await t.test('only coarse, allowed, consented input reaches the mocked provider', async () => {
      for (const invalid of [
        { ...body, termsAccepted: false }, { ...body, region: '123 Main Street, Brooklyn' },
        { ...body, region: 'Brooklyn, NY', unexpected: 'profile data' },
        { ...body, startDate: 'not-a-date' }, { ...body, category: 'other' },
      ]) assert.equal((await call(api.port, 'POST', '/discoveries/search', { cookie: user.cookie, csrf: user.csrf, body: invalid })).status, 400);
      const result = await call(api.port, 'POST', '/discoveries/search', { cookie: user.cookie, csrf: user.csrf, body });
      assert.equal(result.status, 200);
      assert.equal(result.json.category, 'arts');
      assert.match(result.json.retrievedAt, /^\d{4}-\d\d-\d\dT/);
      assert.deepEqual(result.json.results, [{
        id: 'brave-1', title: 'Synthetic local event result', url: 'https://example.org/synthetic-event',
        description: 'Synthetic fixture only. Not a real event.', publisher: 'example.org', age: null,
      }]);
      for (const field of ['region', 'startDate', 'endDate', 'query', 'profileId', 'preferences']) assert.equal(field in result.json, false);
    });
    await t.test('per-user limits reject repeated billable requests', async () => {
      assert.equal((await call(api.port, 'POST', '/discoveries/search', { cookie: user.cookie, csrf: user.csrf, body })).status, 429);
    });
  } finally { await stop(api); }
});
