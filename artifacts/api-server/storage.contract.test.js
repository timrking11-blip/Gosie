// Storage contract: every store must behave identically. Run: node --test artifacts/api-server/storage.contract.test.js
// Postgres is exercised with pg-mem (in-process) always, and with a real database when TEST_DATABASE_URL is set.
const { test } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { createMemoryStore, createSqliteStore, createPostgresStore } = require('./storage');
const { runMigrations } = require('./storage/postgres');

// pg-mem lacks advisory locks; stub them (a real Postgres is covered via TEST_DATABASE_URL / CI).
function memPool() {
  const { newDb, DataType } = require('pg-mem');
  const db = newDb();
  for (const name of ['pg_advisory_lock', 'pg_advisory_unlock']) db.public.registerFunction({ name, args: [DataType.integer], returns: DataType.bool, implementation: () => true });
  return new (db.adapters.createPg().Pool)();
}
const factories = {
  memory: async () => createMemoryStore(),
  sqlite: async () => createSqliteStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gosie-st-')), 't.db')),
  'postgres (pg-mem)': async () => {
    return createPostgresStore({ pool: memPool() });
  },
};
if (process.env.TEST_DATABASE_URL) {
  factories['postgres (TEST_DATABASE_URL)'] = async () => {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    return createPostgresStore({ pool });
  };
}

const now = () => new Date().toISOString();
const user = (n) => ({ id: 'user-' + n, email: n + '@example.com', pass_hash: 'h' + n, pass_salt: 's' + n, created_at: now() });
const prof = (id, userId, extra) => Object.assign({ id, user_id: userId, is_demo: false, title: 'T ' + id, config: { schemaVersion: '1.0.0-draft', transportModes: ['walking'], n: { a: [1, 2] } }, created_at: now() }, extra);

for (const [name, make] of Object.entries(factories)) {
  test(`${name}: users, sessions`, async () => {
    const s = await make(); await s.init();
    try {
      assert.strictEqual(await s.createUser(user('a')), true);
      assert.strictEqual(await s.createUser(Object.assign(user('b'), { email: 'a@example.com' })), false, 'duplicate email rejected');
      assert.strictEqual((await s.getUserByEmail('a@example.com')).id, 'user-a');
      assert.strictEqual((await s.getUserById('user-a')).email, 'a@example.com');
      assert.strictEqual(await s.getUserByEmail('nobody@example.com'), null);
      const exp = Date.now() + 1000;
      await s.createSession({ id: 'sid1', user_id: 'user-a', csrf: 'c', expires_at: exp, created_at: now() });
      await s.createSession({ id: 'sid2', user_id: 'user-a', csrf: 'c', expires_at: 5, created_at: now() });
      const got = await s.getSession('sid1');
      assert.strictEqual(typeof got.expires_at, 'number'); assert.strictEqual(got.expires_at, exp);
      await s.deleteExpiredSessions(Date.now());
      assert.strictEqual(await s.getSession('sid2'), null);
      await s.deleteSession('sid1');
      assert.strictEqual(await s.getSession('sid1'), null);
    } finally { await s.close(); }
  });

  test(`${name}: profiles are isolated per user and round-trip config`, async () => {
    const s = await make(); await s.init();
    try {
      await s.createUser(user('a')); await s.createUser(user('b'));
      assert.strictEqual(await s.hasDemoProfiles(), false);
      await s.createProfile(prof('demo-1', 'system-demo', { is_demo: true }));
      assert.strictEqual(await s.hasDemoProfiles(), true);
      await s.createProfile(prof('p-a', 'user-a'));
      assert.deepStrictEqual((await s.getOwnProfile('user-a', 'p-a')).config, prof('x', 'y').config);
      assert.strictEqual(await s.getOwnProfile('user-b', 'p-a'), null, 'other user cannot read');
      assert.strictEqual(await s.countProfiles('user-a'), 1);
      assert.strictEqual((await s.listProfiles('user-b')).length, 0);
      assert.strictEqual((await s.listDemoProfiles()).length, 1);
      await s.updateProfile('p-a', { schemaVersion: '1.0.0-draft', changed: true }, 'New');
      const upd = await s.getOwnProfile('user-a', 'p-a'); assert.strictEqual(upd.title, 'New'); assert.strictEqual(upd.config.changed, true);
      assert.strictEqual(upd.is_demo, false);
      await s.deleteProfile('user-b', 'p-a');
      assert.ok(await s.getOwnProfile('user-a', 'p-a'), 'other user cannot delete');
      await s.deleteProfile('user-a', 'p-a');
      assert.strictEqual(await s.getOwnProfile('user-a', 'p-a'), null);
    } finally { await s.close(); }
  });

  test(`${name}: feedback is per user and removed with its profile`, async () => {
    const s = await make(); await s.init();
    try {
      await s.createProfile(prof('p-a', 'user-a'));
      const id1 = await s.addFeedback({ user_id: 'user-a', profile_id: 'p-a', item_id: 'e1', action: 'saved', rating: null, created_at: now() });
      const id2 = await s.addFeedback({ user_id: 'user-a', profile_id: 'p-a', item_id: 'e2', action: 'rating', rating: 5, created_at: now() });
      await s.addFeedback({ user_id: 'user-b', profile_id: 'p-b', item_id: 'e1', action: 'dismissed', rating: null, created_at: now() });
      assert.ok(typeof id1 === 'number' && id2 > id1);
      const mine = await s.listFeedback('user-a');
      assert.deepStrictEqual(mine.map((f) => [f.item_id, f.action, f.rating]), [['e1', 'saved', null], ['e2', 'rating', 5]]);
      assert.strictEqual((await s.listFeedbackForProfile('user-a', 'p-a')).length, 2);
      assert.strictEqual((await s.listFeedbackForProfile('user-b', 'p-a')).length, 0);
      await s.deleteProfile('user-a', 'p-a');
      assert.strictEqual((await s.listFeedback('user-a')).length, 0);
      assert.strictEqual((await s.listFeedback('user-b')).length, 1, 'other users untouched');
    } finally { await s.close(); }
  });
}

test('postgres migrations are idempotent and ordered', async () => {
  const pool = memPool();
  const first = await runMigrations(pool);
  assert.deepStrictEqual(first, ['001_init.sql']);
  assert.deepStrictEqual(await runMigrations(pool), []);
  await pool.end();
});

test('postgres migration failure rolls back and reports the file', async () => {
  const pool = memPool();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosie-mig-'));
  fs.writeFileSync(path.join(dir, '001_ok.sql'), 'CREATE TABLE a (id INT);');
  fs.writeFileSync(path.join(dir, '002_bad.sql'), 'CREATE TABLE b (id INT); THIS IS NOT SQL;');
  await assert.rejects(() => runMigrations(pool, dir), /002_bad\.sql/);
  const applied = (await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name);
  assert.deepStrictEqual(applied, ['001_ok.sql']);
  await pool.end();
});
