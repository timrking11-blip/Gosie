const fs = require('node:fs/promises');
const path = require('node:path');
const { validateCatalog, lifecycle } = require('../../research/gosie/contract.cjs');
const catalogPath = path.resolve(__dirname, '../../research/gosie/approved.json');

function createCatalogReader(readFile = fs.readFile) {
  let lastGood = null;
  return async function readApprovedCatalog(now = new Date()) {
    let warning = null;
    try {
      const raw = await readFile(catalogPath, 'utf8');
      if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw new Error('catalog_too_large');
      const parsed = JSON.parse(raw);
      if (!validateCatalog(parsed)) throw new Error('invalid_catalog');
      lastGood = parsed;
    } catch {
      warning = lastGood ? 'The latest catalog could not be validated. Showing the last valid catalog loaded by this server.' :
        'The approved catalog is unavailable. No researched discoveries are being substituted.';
    }
    return catalogResponse(lastGood, now, warning);
  };
}

function catalogResponse(catalog, now, warning = null) {
  if (!catalog) return { schemaVersion: 1, revision: null, checkedAt: now.toISOString(), warning, records: [] };
  const records = catalog.records.map((record) => lifecycle(record, now, 14))
    .filter((record) => !record.flags.some((flag) => ['expired', 'closed', 'conflicting', 'delayed', 'date-review'].includes(flag)));
  return {
    schemaVersion: 1, revision: catalog.revision, checkedAt: now.toISOString(), warning,
    records: records.map((record) => ({
      id: record.id, title: record.title, venue: record.venue, region: record.region,
      category: record.category, why: record.why, status: record.status,
      verification: record.verification, sourceType: 'reviewed-public-research',
      firstSeenAt: record.firstSeenAt, lastCheckedAt: record.lastCheckedAt,
      dates: record.dates, flags: record.flags,
      sources: record.evidence.map((item) => ({
        url: item.url, publisher: item.publisher, excerpt: item.excerpt,
        publicationDate: item.publicationDate, checkedAt: item.checkedAt,
      })),
      // Never send unknown values as zeros into numeric hard-constraint logic.
      price: null, travelMinutes: null, accessibility: null, hours: null, availability: null,
      constraintStatus: 'not-evaluated',
    })),
  };
}
const readApprovedCatalog = createCatalogReader();
module.exports = { readApprovedCatalog, createCatalogReader, catalogResponse };
