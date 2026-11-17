#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { configErrors, validateRecord, validateCatalog, isDue } = require('./contract.cjs');
const { safeFetch } = require('./safe-fetch.cjs');
const { runResearch, promote } = require('./pipeline.cjs');
const root = __dirname;
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
function atomicWrite(file, value) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  fs.renameSync(temporary, file);
}
async function main() {
  const command = process.argv[2] || 'check';
  const config = read('config.json');
  const state = read('state.json');
  const catalog = read('approved.json');
  if (state.schemaVersion !== 1 || !Array.isArray(state.candidates) ||
    !state.candidates.every((record) => validateRecord(record)) || !validateCatalog(catalog)) {
    throw new Error('Invalid state/catalog; nothing was written.');
  }
  if (command === 'check') {
    console.log(JSON.stringify({
      enabled: config.enabled, scheduleEnabled: config.scheduleEnabled,
      setup: configErrors(config), candidates: state.candidates.length, approved: catalog.records.length,
      lastSuccessfulAt: state.lastSuccessfulAt,
    }, null, 2));
    return;
  }
  if (!['run', 'promote'].includes(command)) throw new Error('Use check, run, or promote <id> <public-reviewer-label> --reviewed');
  const lock = path.join(root, '.run-lock');
  const handle = fs.openSync(lock, 'wx');
  try {
    if (command === 'promote') {
      if (!process.argv.includes('--reviewed')) throw new Error('Human review confirmation --reviewed required');
      const next = promote(state, catalog, process.argv[3], process.argv[4]);
      if (!validateCatalog(next)) throw new Error('Invalid approved catalog');
      atomicWrite(path.join(root, 'approved.json'), next);
      console.log('Promoted locally for repository review. Commit/PR approval is still required; nothing was published.');
      return;
    }
    const scheduled = process.argv.includes('--scheduled');
    if (scheduled && (!config.scheduleEnabled || !isDue(config, state.lastSuccessfulAt))) {
      console.log('Schedule disabled or not due in the configured timezone. No external calls or writes.');
      return;
    }
    const activated = process.env.GOSIE_RESEARCH_ACTIVATED === '1';
    // This environment variable is reserved for the approved repository runner,
    // never a VITE_ variable or a browser credential. No credential is logged.
    const search = process.env.BRAVE_SEARCH_API_KEY ? async (query, maxBytes) => {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query); url.searchParams.set('count', '8');
      const result = await safeFetch(url.href, {
        maxBytes, headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY, Accept: 'application/json' },
      });
      const data = JSON.parse(result.text);
      return Array.isArray(data.web?.results) ? data.web.results : [];
    } : null;
    const result = await runResearch(config, state, { activated, search });
    console.log(JSON.stringify(result.summary, null, 2));
    const output = path.resolve('generated-artifacts/gosie-research');
    fs.mkdirSync(output, { recursive: true });
    atomicWrite(path.join(output, 'summary.json'), result.summary);
    // A disabled/misconfigured command never alters the candidate pool.
    if (['success', 'partial', 'failed'].includes(result.summary.status)) {
      atomicWrite(path.join(root, 'state.json'), result.state);
    }
    if (['setup-required', 'failed'].includes(result.summary.status)) process.exitCode = 1;
  } finally {
    fs.closeSync(handle);
    fs.unlinkSync(lock);
  }
}
if (require.main === module) main().catch(() => {
  // Do not print untrusted content, URLs, query parameters, or credential-bearing errors.
  console.error('Research command refused or failed. Check configuration, catalog validation, review confirmation, and the local run lock. No automatic promotion occurred.');
  process.exitCode = 1;
});
module.exports = { atomicWrite };
