// Postgres store (Replit Postgres or any Postgres). Reads DATABASE_URL from the environment; never commit it.
// Migrations in ../migrations/*.sql run once each, in filename order, under an advisory lock.
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function runMigrations(pool, dir = MIGRATIONS_DIR) {
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    const has = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schema_migrations'");
    if (!has.rows.length) await client.query('CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const applied = [];
    for (const f of files) {
      if (done.has(f)) continue;
      try {
        await client.query('BEGIN');
        await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
        await client.query('INSERT INTO schema_migrations(name, applied_at) VALUES ($1,$2)', [f, new Date().toISOString()]);
        await client.query('COMMIT');
        applied.push(f);
      } catch (e) { await client.query('ROLLBACK'); throw new Error(`migration ${f} failed: ${e.message}`); }
    }
    return applied;
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(727001)'); } catch { /* connection may be gone */ }
    client.release();
  }
}

// `pool` is injectable so tests can use an in-process Postgres emulator.
function createPostgresStore({ connectionString, pool: injected } = {}) {
  let pool = injected;
  const q = async (text, params) => (await pool.query(text, params)).rows;
  const prof = (r) => (r ? { id: r.id, user_id: r.user_id, is_demo: !!r.is_demo, title: r.title, config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config } : null);
  const sess = (r) => (r ? Object.assign({}, r, { expires_at: Number(r.expires_at) }) : null);
  return {
    kind: 'postgres',
    async init() {
      if (!pool) { const { Pool } = require('pg'); pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 }); }
      return runMigrations(pool);
    },
    async close() { if (pool) { const p = pool; pool = null; await p.end(); } },
    async deleteExpiredSessions(now) { await q('DELETE FROM sessions WHERE expires_at<$1', [now]); },
    async getSession(id) { return sess((await q('SELECT * FROM sessions WHERE id=$1', [id]))[0]) || null; },
    async createSession(s) { await q('INSERT INTO sessions(id,user_id,csrf,expires_at,created_at) VALUES ($1,$2,$3,$4,$5)', [s.id, s.user_id, s.csrf, s.expires_at, s.created_at]); },
    async deleteSession(id) { await q('DELETE FROM sessions WHERE id=$1', [id]); },
    async getUserById(id) { return (await q('SELECT * FROM users WHERE id=$1', [id]))[0] || null; },
    async getUserByEmail(email) { return (await q('SELECT * FROM users WHERE email=$1', [email]))[0] || null; },
    async createUser(u) {
      try { await q('INSERT INTO users(id,email,pass_hash,pass_salt,created_at) VALUES ($1,$2,$3,$4,$5)', [u.id, u.email, u.pass_hash, u.pass_salt, u.created_at]); return true; }
      catch (e) { if (e && e.code === '23505') return false; throw e; }
    },
    async hasDemoProfiles() { return Number((await q('SELECT COUNT(*) AS c FROM profiles WHERE is_demo=TRUE'))[0].c) > 0; },
    async listProfiles(userId) { return (await q('SELECT * FROM profiles WHERE user_id=$1 ORDER BY created_at', [userId])).map(prof); },
    async listDemoProfiles() { return (await q('SELECT * FROM profiles WHERE is_demo=TRUE ORDER BY id')).map(prof); },
    async countProfiles(userId) { return Number((await q('SELECT COUNT(*) AS c FROM profiles WHERE user_id=$1', [userId]))[0].c); },
    async createProfile(p) { await q('INSERT INTO profiles(id,user_id,is_demo,title,config,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [p.id, p.user_id, !!p.is_demo, p.title, JSON.stringify(p.config), p.created_at]); },
    async getOwnProfile(userId, pid) { return prof((await q('SELECT * FROM profiles WHERE id=$1 AND user_id=$2', [pid, userId]))[0]); },
    async updateProfile(pid, config, title) { await q('UPDATE profiles SET config=$1, title=$2 WHERE id=$3', [JSON.stringify(config), title, pid]); },
    async deleteProfile(userId, pid) {
      await q('DELETE FROM profiles WHERE id=$1 AND user_id=$2', [pid, userId]);
      await q('DELETE FROM feedback WHERE profile_id=$1 AND user_id=$2', [pid, userId]);
    },
    async addFeedback(f) {
      const r = await q('INSERT INTO feedback(user_id,profile_id,item_id,action,rating,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [f.user_id, f.profile_id, f.item_id, f.action, f.rating ?? null, f.created_at]);
      return Number(r[0].id);
    },
    async listFeedback(userId) { return (await q('SELECT id,user_id,profile_id,item_id,action,rating FROM feedback WHERE user_id=$1 ORDER BY id', [userId])).map((r) => Object.assign({}, r, { id: Number(r.id) })); },
    async listFeedbackForProfile(userId, pid) { return (await q('SELECT id,user_id,profile_id,item_id,action,rating FROM feedback WHERE user_id=$1 AND profile_id=$2 ORDER BY id', [userId, pid])).map((r) => Object.assign({}, r, { id: Number(r.id) })); },
  };
}
module.exports = { createPostgresStore, runMigrations };
