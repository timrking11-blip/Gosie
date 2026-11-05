// Picks a store from the environment.
//   DATABASE_URL  -> Postgres (Replit Postgres)
//   STORAGE=memory -> in-memory (tests)
//   otherwise     -> local SQLite at DB_PATH
const path = require('path');
const { createMemoryStore } = require('./memory');
const { createSqliteStore } = require('./sqlite');
const { createPostgresStore } = require('./postgres');

function createStore(env = process.env) {
  if (env.DATABASE_URL) return createPostgresStore({ connectionString: env.DATABASE_URL });
  if (env.STORAGE === 'memory') return createMemoryStore();
  return createSqliteStore(env.DB_PATH || path.join(__dirname, '..', 'data', 'b1.db'));
}
module.exports = { createStore, createMemoryStore, createSqliteStore, createPostgresStore };
