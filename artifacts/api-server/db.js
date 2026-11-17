const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Configure the Replit PostgreSQL database before starting Gosie API.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_SIZE) || 8,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (error) => {
  console.error(JSON.stringify({ level: 'error', event: 'postgres_pool_error', message: error.message }));
});

module.exports = { pool };
