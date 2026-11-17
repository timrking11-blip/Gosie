const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const target = process.env.GOSIE_DB_ENV;
if (!['development', 'test'].includes(target)) {
  throw new Error('Set GOSIE_DB_ENV=development or GOSIE_DB_ENV=test; production schema is managed by Replit Publish.');
}
if (process.env.REPLIT_ENVIRONMENT === 'production') {
  throw new Error('Refusing to apply schema from a production runtime.');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log(`Gosie schema applied to the ${target} database.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Could not apply Gosie schema: ${error.message}`);
  process.exitCode = 1;
});
