// Local SQLite store (node:sqlite). Default for local development; ephemeral on Replit deployments.
const fs = require('fs');
const path = require('path');

function createSqliteStore(dbPath) {
  const { DatabaseSync } = require('node:sqlite');
  let db;
  const prof = (r) => (r ? { id: r.id, user_id: r.user_id, is_demo: !!r.is_demo, title: r.title, config: JSON.parse(r.config) } : null);
  return {
    kind: 'sqlite',
    async init() {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      db = new DatabaseSync(dbPath);
      db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL, config TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, profile_id TEXT NOT NULL, item_id TEXT NOT NULL, action TEXT NOT NULL, rating INTEGER, created_at TEXT NOT NULL);`);
    },
    async close() { try { db.close(); } catch { /* already closed */ } },
    async deleteExpiredSessions(now) { db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now); },
    async getSession(id) { return db.prepare('SELECT * FROM sessions WHERE id=?').get(id) || null; },
    async createSession(s) { db.prepare('INSERT INTO sessions(id,user_id,csrf,expires_at,created_at) VALUES (?,?,?,?,?)').run(s.id, s.user_id, s.csrf, s.expires_at, s.created_at); },
    async deleteSession(id) { db.prepare('DELETE FROM sessions WHERE id=?').run(id); },
    async getUserById(id) { return db.prepare('SELECT * FROM users WHERE id=?').get(id) || null; },
    async getUserByEmail(email) { return db.prepare('SELECT * FROM users WHERE email=?').get(email) || null; },
    async createUser(u) {
      try { db.prepare('INSERT INTO users(id,email,pass_hash,pass_salt,created_at) VALUES (?,?,?,?,?)').run(u.id, u.email, u.pass_hash, u.pass_salt, u.created_at); return true; }
      catch { return false; }
    },
    async hasDemoProfiles() { return db.prepare('SELECT COUNT(*) c FROM profiles WHERE is_demo=1').get().c > 0; },
    async listProfiles(userId) { return db.prepare('SELECT * FROM profiles WHERE user_id=?').all(userId).map(prof); },
    async listDemoProfiles() { return db.prepare('SELECT * FROM profiles WHERE is_demo=1').all().map(prof); },
    async countProfiles(userId) { return db.prepare('SELECT COUNT(*) c FROM profiles WHERE user_id=?').get(userId).c; },
    async createProfile(p) { db.prepare('INSERT INTO profiles(id,user_id,is_demo,title,config,created_at) VALUES (?,?,?,?,?,?)').run(p.id, p.user_id, p.is_demo ? 1 : 0, p.title, JSON.stringify(p.config), p.created_at); },
    async getOwnProfile(userId, pid) { return prof(db.prepare('SELECT * FROM profiles WHERE id=? AND user_id=?').get(pid, userId)); },
    async updateProfile(pid, config, title) { db.prepare('UPDATE profiles SET config=?, title=? WHERE id=?').run(JSON.stringify(config), title, pid); },
    async deleteProfile(userId, pid) {
      db.prepare('DELETE FROM profiles WHERE id=? AND user_id=?').run(pid, userId);
      db.prepare('DELETE FROM feedback WHERE profile_id=? AND user_id=?').run(pid, userId);
    },
    async addFeedback(f) {
      const info = db.prepare('INSERT INTO feedback(user_id,profile_id,item_id,action,rating,created_at) VALUES (?,?,?,?,?,?)').run(f.user_id, f.profile_id, f.item_id, f.action, f.rating ?? null, f.created_at);
      return Number(info.lastInsertRowid);
    },
    async listFeedback(userId) { return db.prepare('SELECT id,user_id,profile_id,item_id,action,rating FROM feedback WHERE user_id=?').all(userId); },
    async listFeedbackForProfile(userId, pid) { return db.prepare('SELECT id,user_id,profile_id,item_id,action,rating FROM feedback WHERE user_id=? AND profile_id=?').all(userId, pid); },
  };
}
module.exports = { createSqliteStore };
