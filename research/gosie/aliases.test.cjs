const { test } = require('node:test');
const assert = require('node:assert/strict');
const { draftRecord, mergeReviewed, mergeCandidates, promote, runResearch } = require('./pipeline.cjs');
const { validateState, validateCatalog, identity } = require('./contract.cjs');
const now = new Date('2026-11-18T12:00:00Z');
const emptyCatalog = { schemaVersion: 1, revision: 'fixture', records: [] };
function lead(title, overrides = {}) {
  const r = draftRecord({ title, venue: 'Synthetic museum', region: 'Synthetic city', category: 'exhibit',
    source: { url: 'https://www.nycgovparks.org/events', publisher: 'Fixture', type: 'official' },
    excerpt: title, reference: 'Offline fixture', now });
  Object.assign(r, overrides); r.id = identity(r); return r;
}
const state = (...candidates) => ({ schemaVersion: 1, lastSuccessfulAt: null, candidates });
const merge = (s, from, to, catalog = emptyCatalog) =>
  mergeReviewed(s, catalog, from.id, to.id, 'fixture-reviewer', 'Reviewed sources establish the same exhibition.', now);

test('renamed headlines require explicit review; repeat ingestion follows the recorded alias', () => {
  const a = lead('Original exhibit', { firstSeenAt: '2026-10-01T12:00:00Z' }), b = lead('New headline');
  assert.equal(mergeCandidates([a], [b]).candidates.length, 2);
  const before = state(a, b), unchanged = structuredClone(before);
  const result = merge(before, b, a);
  assert.deepEqual(before, unchanged);
  assert.ok(validateState(result)); assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].firstSeenAt, a.firstSeenAt);
  assert.deepEqual(result.aliases[0].source, b);
  assert.equal(result.aliases[0].by, 'fixture-reviewer');
  const repeat = mergeCandidates(result.candidates, [b], result.aliases);
  assert.equal(repeat.added, 0); assert.equal(repeat.candidates[0].id, a.id);
  assert.equal(repeat.candidates[0].evidence.length, 2);
});

test('shared venue exhibits stay separate unless a reviewer explicitly merges them', () => {
  const a = lead('Spring paintings'), b = lead('Winter sculpture');
  assert.equal(mergeCandidates([a], [b]).candidates.length, 2);
  assert.throws(() => mergeReviewed(state(a, b), emptyCatalog, a.id, b.id, '', 'x', now));
  assert.throws(() => merge(state(a, b), a, a));
  const otherCity = lead('Other city headline', { region: 'Different city' });
  assert.throws(() => merge(state(a, otherCity), otherCity, a), /incompatible/);
});

test('conflicting sources preserve both excerpts, claim indexes and source snapshot; earliest observation wins', () => {
  const a = lead('Exhibit open', { status: 'open', claimEvidence: { status: 0 } });
  const b = lead('Exhibit closed', { status: 'closed', claimEvidence: { status: 0 },
    firstSeenAt: '2026-09-01T12:00:00Z' });
  const result = merge(state(a, b), b, a);
  const r = result.candidates[0];
  assert.equal(r.firstSeenAt, b.firstSeenAt); assert.equal(r.status, 'open');
  assert.equal(r.evidence[r.claimEvidence.status].excerpt, a.evidence[0].excerpt);
  assert.equal(r.evidence[1].excerpt, b.evidence[0].excerpt);
  assert.equal(result.aliases[0].source.status, 'closed');
  assert.ok(r.flags.includes('conflicting')); assert.equal(r.verification, 'unverified');
  assert.throws(() => promote(result, emptyCatalog, a.id, 'reviewer', now), /review_required/);
});

test('approved IDs and catalog remain unchanged and merged candidate needs renewed approval', () => {
  const a = lead('Approved exhibit', { verification: 'source-supported', status: 'scheduled', claimEvidence: { status: 0 } });
  const b = lead('Renamed story');
  const catalog = promote(state(a), emptyCatalog, a.id, 'fixture', now);
  const original = structuredClone(catalog);
  const result = merge(state(a, b), b, a, catalog);
  assert.deepEqual(catalog, original); assert.ok(validateCatalog(catalog));
  assert.equal(result.candidates[0].id, catalog.records[0].id);
  assert.throws(() => merge(state(a, b), a, b, catalog), /approved_source/);
  b.verification = 'source-supported'; b.status = 'scheduled'; b.claimEvidence.status = 0;
  const both = promote(state(b), catalog, b.id, 'fixture', now);
  assert.throws(() => merge(state(a, b), b, a, both), /approved_source/);
});

test('chains resolve transitively; dangling/cyclic aliases and evidence overflow fail without data loss', () => {
  const a = lead('A'), b = lead('B'), c = lead('C');
  const first = merge(state(a, b, c), b, a);
  const second = merge(first, a, c);
  assert.equal(mergeCandidates(second.candidates, [b], second.aliases).candidates[0].id, c.id);
  const cycle = structuredClone(second); cycle.aliases[1].toId = b.id;
  assert.equal(validateState(cycle), false);
  const dangling = structuredClone(second); dangling.candidates = [];
  assert.equal(validateState(dangling), false);
  const full = lead('Full');
  full.evidence = Array.from({ length: 12 }, (_, i) => ({ ...full.evidence[0], excerpt: `Evidence ${i}` }));
  const original = state(full, b), copy = structuredClone(original);
  assert.throws(() => merge(original, b, full), /capacity/);
  assert.deepEqual(original, copy);
});

test('disabled research preserves aliases and makes no live calls', async () => {
  const a = lead('A'), b = lead('B'), merged = merge(state(a, b), b, a);
  const fail = () => { throw new Error('unexpected live call'); };
  const result = await runResearch(require('./config.json'), merged, { fetchPage: fail, search: fail });
  assert.deepEqual(result.state, merged); assert.equal(result.summary.requests, 0);
});

test('CLI preview leaves files untouched; confirmation writes only candidate state in an isolated directory', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosie-alias-'));
  try {
    for (const file of ['cli.cjs', 'pipeline.cjs', 'contract.cjs', 'safe-fetch.cjs', 'config.json']) {
      fs.copyFileSync(path.join(__dirname, file), path.join(dir, file));
    }
    const a = lead('Original'), b = lead('Renamed');
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state(a, b)));
    fs.writeFileSync(path.join(dir, 'approved.json'), JSON.stringify(emptyCatalog));
    const before = fs.readFileSync(path.join(dir, 'state.json'), 'utf8');
    const catalogBefore = fs.readFileSync(path.join(dir, 'approved.json'), 'utf8');
    const args = [path.join(dir, 'cli.cjs'), 'merge', b.id, a.id, 'fixture', 'Sources refer to the same exhibition.'];
    const preview = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(preview.status, 0, preview.stderr);
    assert.equal(JSON.parse(preview.stdout).dryRun, true);
    assert.equal(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'), before);
    const apply = spawnSync(process.execPath, [...args, '--reviewed'], { encoding: 'utf8' });
    assert.equal(apply.status, 0, apply.stderr);
    assert.ok(validateState(JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'))));
    assert.equal(fs.readFileSync(path.join(dir, 'approved.json'), 'utf8'), catalogBefore);
    assert.equal(fs.existsSync(path.join(dir, '.run-lock')), false);
    const replay = spawnSync(process.execPath, [...args, '--reviewed'], { encoding: 'utf8' });
    assert.notEqual(replay.status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
