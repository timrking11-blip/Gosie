const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogReader, catalogResponse } = require('./research-catalog');
const { draftRecord, promote } = require('../../research/gosie/pipeline.cjs');
const now = new Date('2026-11-18T12:00:00Z');
function catalog() {
  const record = draftRecord({ title: 'Synthetic place', venue: 'Fixture venue', region: 'Fixture region',
    category: 'experience', source: { url: 'https://www.nycgovparks.org/events', publisher: 'Fixture', type: 'official' },
    excerpt: 'Synthetic test only', reference: 'Fixture', now });
  record.status = 'ongoing'; record.verification = 'source-supported'; record.claimEvidence.status = 0;
  return promote({ candidates: [record] }, { records: [] }, record.id, 'fixture-reviewer', now);
}
test('approved catalog exposes unknown limits as null and no personal data', () => {
  const result = catalogResponse(catalog(), now);
  assert.equal(result.records[0].price, null);
  assert.equal(result.records[0].travelMinutes, null);
  assert.equal(result.records[0].constraintStatus, 'not-evaluated');
  assert.equal(result.records[0].sourceType, 'reviewed-public-research');
  assert.equal(result.records[0].review, undefined);
});
test('invalid file keeps last valid catalog only within this server process', async () => {
  let raw = JSON.stringify(catalog());
  const reader = createCatalogReader(async () => raw);
  assert.equal((await reader(now)).records.length, 1);
  raw = '{bad';
  const result = await reader(now);
  assert.equal(result.records.length, 1);
  assert.match(result.warning, /last valid/);
  assert.equal((await createCatalogReader(async () => raw)(now)).records.length, 0);
});
test('unreviewed records cannot load; closed records are not recommended', async () => {
  const c = catalog(); c.records[0].review = null;
  const result = await createCatalogReader(async () => JSON.stringify(c))(now);
  assert.equal(result.records.length, 0);
  const closed = catalog(); closed.records[0].status = 'closed';
  assert.equal(catalogResponse(closed, now).records.length, 0);
});
