const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { Client } = require('pg');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

if (
  process.env.GOSIE_DB_ENV !== 'test' ||
  process.env.REPLIT_DEPLOYMENT === '1' ||
  process.env.NODE_ENV === 'production'
) {
  throw new Error('Restart persistence tests require GOSIE_DB_ENV=test on a non-production database.');
}
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must point to a disposable Postgres database');

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
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    if (body !== undefined) headers['Content-Length'] = Buffer.byteLength(body);
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.csrf) headers['X-CSRF-Token'] = options.csrf;
    const request = http.request({ host: '127.0.0.1', port, path: route, method, headers }, (response) => {
      let text = '';
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: response.statusCode, headers: response.headers, json, text });
      });
    });
    request.on('error', reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

async function start(databaseUrl, sessionSecret) {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      GOSIE_DB_ENV: 'test',
      API_PORT: String(port),
      PORT: String(port),
      AUTH_RATE_LIMIT: '1000',
      PILOT_SIGNUPS_ENABLED: '1',
      SESSION_SECRET: sessionSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (data) => { logs += data; });
  child.stderr.on('data', (data) => { logs += data; });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) break;
    try {
      const response = await call(port, 'GET', '/health');
      if (response.status === 200) return { child, port, logs: () => logs };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await stop({ child });
  throw new Error(`API failed to start against the isolated test schema: ${logs}`);
}

function stop(server) {
  if (!server || server.child.exitCode !== null || server.child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    server.child.once('exit', resolve);
    server.child.kill('SIGTERM');
  });
}

test('user-owned profiles and feedback survive an API process restart', async () => {
  const schema = `gosie_restart_${randomUUID().replaceAll('-', '')}`;
  const sessionSecret = randomUUID();
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  let schemaCreated = false;
  let server;

  try {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;

    const isolatedUrl = new URL(process.env.DATABASE_URL);
    isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
    const isolatedDatabaseUrl = isolatedUrl.toString();
    const schemaClient = new Client({ connectionString: isolatedDatabaseUrl });
    await schemaClient.connect();
    try {
      await schemaClient.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    } finally {
      await schemaClient.end();
    }

    server = await start(isolatedDatabaseUrl, sessionSecret);
    const email = `restart-${randomUUID()}@example.invalid`;
    const password = 'Gosie-Restart-Test-123';
    const registered = await call(server.port, 'POST', '/auth/register', {
      body: { email, password, pilotConsent: true },
    });
    assert.equal(registered.status, 201, `registration failed: ${registered.text}`);

    const login = await call(server.port, 'POST', '/auth/login', { body: { email, password } });
    assert.equal(login.status, 200, `login failed: ${login.text}`);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const csrf = login.json.csrfToken;

    const createdProfile = await call(server.port, 'POST', '/profiles', {
      cookie,
      csrf,
      body: { title: 'Restart persistence profile', config: { schemaVersion: '1.0.0-draft' } },
    });
    assert.equal(createdProfile.status, 201, `profile creation failed: ${createdProfile.text}`);
    const profileId = createdProfile.json.id;

    for (const feedback of [
      { profileId, itemId: 'restart-saved-idea', action: 'saved', value: true },
      { profileId, itemId: 'restart-rated-idea', action: 'rating', rating: 5 },
    ]) {
      const saved = await call(server.port, 'POST', '/feedback', { cookie, csrf, body: feedback });
      assert.equal(saved.status, 200, `feedback creation failed: ${saved.text}`);
    }

    const profilesBeforeRestart = await call(server.port, 'GET', '/profiles', { cookie });
    const feedbackBeforeRestart = await call(server.port, 'GET', `/feedback?profile_id=${profileId}`, { cookie });
    assert.equal(profilesBeforeRestart.status, 200);
    assert.equal(feedbackBeforeRestart.status, 200);
    assert.equal(profilesBeforeRestart.json.profiles[0].id, profileId);
    assert.equal(feedbackBeforeRestart.json.feedback.length, 2);

    await stop(server);
    server = await start(isolatedDatabaseUrl, sessionSecret);

    const profilesAfterRestart = await call(server.port, 'GET', '/profiles', { cookie });
    const profileAfterRestart = await call(server.port, 'GET', `/profiles/${profileId}`, { cookie });
    const feedbackAfterRestart = await call(server.port, 'GET', `/feedback?profile_id=${profileId}`, { cookie });
    assert.equal(profilesAfterRestart.status, 200, `profile list after restart failed: ${profilesAfterRestart.text}`);
    assert.equal(profileAfterRestart.status, 200, `profile after restart failed: ${profileAfterRestart.text}`);
    assert.equal(feedbackAfterRestart.status, 200, `feedback after restart failed: ${feedbackAfterRestart.text}`);
    assert.equal(profilesAfterRestart.json.profiles[0].id, profileId);
    assert.equal(profileAfterRestart.json.title, 'Restart persistence profile');
    assert.deepEqual(
      feedbackAfterRestart.json.feedback
        .map(({ itemId, action, rating }) => ({ itemId, action, rating }))
        .sort((a, b) => a.itemId.localeCompare(b.itemId)),
      [
        { itemId: 'restart-rated-idea', action: 'rating', rating: 5 },
        { itemId: 'restart-saved-idea', action: 'saved', rating: null },
      ],
    );
  } finally {
    await stop(server);
    if (schemaCreated) {
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    }
    await admin.end();
  }
});
