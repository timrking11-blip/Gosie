const { createHash } = require('node:crypto');
const net = require('node:net');

const VERSION = 1;
const CATEGORIES = ['restaurant', 'exhibit', 'experience'];
const SOURCE_TYPES = ['official', 'publisher', 'tourism', 'community'];
const STATUSES = ['unknown', 'announced', 'open', 'scheduled', 'ongoing', 'delayed', 'closed', 'conflicting'];
const text = (value, limit = 600) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const timestamp = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const onlyKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every((key) => keys.includes(key));
function date(value) {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
function publicUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('invalid_public_url');
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
    net.isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') ||
    /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host) ||
    host.endsWith('.example.com') || ['example.com', 'example.org', 'example.net'].includes(host)) {
    throw new Error('invalid_public_url');
  }
  url.hash = '';
  return url;
}
function canonicalUrl(value) {
  const url = publicUrl(value);
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.href.replace(/\/$/, '');
}
function key(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function identity(record) {
  return `experience-${createHash('sha256').update([
    key(record.region), record.category, key(record.venue), key(record.title),
  ].join('|')).digest('hex').slice(0, 24)}`;
}
function validEvidence(evidence) {
  if (!onlyKeys(evidence, ['url', 'publisher', 'sourceType', 'reference', 'excerpt', 'checkedAt', 'publicationDate']) ||
    !text(evidence.publisher, 120) || !SOURCE_TYPES.includes(evidence.sourceType) ||
    !text(evidence.reference, 300) || !text(evidence.excerpt, 280) ||
    !timestamp(evidence.checkedAt) || !(evidence.publicationDate === null || date(evidence.publicationDate))) return false;
  try { publicUrl(evidence.url); return true; } catch { return false; }
}
function validateRecord(record, approved = false) {
  if (!onlyKeys(record, ['id', 'title', 'venue', 'region', 'category', 'why', 'status', 'verification',
    'firstSeenAt', 'lastCheckedAt', 'dates', 'claimEvidence', 'evidence', 'flags', 'review']) ||
    !text(record.title, 200) || !text(record.venue, 200) || !text(record.region, 120) ||
    !CATEGORIES.includes(record.category) || record.id !== identity(record) ||
    !text(record.why, 600) || !STATUSES.includes(record.status) ||
    !timestamp(record.firstSeenAt) || !timestamp(record.lastCheckedAt) ||
    Date.parse(record.firstSeenAt) > Date.parse(record.lastCheckedAt) ||
    !Array.isArray(record.evidence) || !record.evidence.length || record.evidence.length > 12 ||
    !record.evidence.every(validEvidence) || !Array.isArray(record.flags) || record.flags.length > 12 ||
    !record.flags.every((flag) => ['stale', 'expired', 'closed', 'delayed', 'conflicting', 'date-review'].includes(flag)) ||
    !onlyKeys(record.dates, ['publication', 'announcedOpening', 'confirmedOpening', 'exhibitStart', 'exhibitEnd']) ||
    !['publication', 'announcedOpening', 'confirmedOpening', 'exhibitStart', 'exhibitEnd'].every(
      (field) => record.dates[field] === null || date(record.dates[field]),
    ) || !['unverified', 'source-supported'].includes(record.verification)) return false;
  if (record.dates.exhibitStart && record.dates.exhibitEnd && record.dates.exhibitStart > record.dates.exhibitEnd) return false;
  if (!record.claimEvidence || !Object.entries(record.claimEvidence).every(([claim, index]) =>
    ['status', 'announcedOpening', 'confirmedOpening', 'exhibitStart', 'exhibitEnd'].includes(claim) &&
    Number.isInteger(index) && index >= 0 && index < record.evidence.length)) return false;
  if (record.status !== 'unknown' && record.claimEvidence.status === undefined) return false;
  for (const field of ['announcedOpening', 'confirmedOpening', 'exhibitStart', 'exhibitEnd']) {
    if (record.dates[field] && record.claimEvidence[field] === undefined) return false;
  }
  if (record.status === 'announced' && record.dates.confirmedOpening) return false;
  if (record.status === 'open' && record.category === 'restaurant' && record.claimEvidence.status === undefined) return false;
  if (approved && (!onlyKeys(record.review, ['by', 'at', 'digest']) || !text(record.review.by, 80) || !timestamp(record.review.at) ||
    record.review.digest !== materialDigest(record) || record.verification !== 'source-supported')) return false;
  return true;
}
function materialDigest(record) {
  const { title, venue, region, category, why, status, dates, claimEvidence } = record;
  return createHash('sha256').update(JSON.stringify({
    title, venue, region, category, why, status, dates, claimEvidence,
    evidence: record.evidence.map(({ url, excerpt, publicationDate }) => ({ url, excerpt, publicationDate })),
  })).digest('hex');
}
function lifecycle(record, now, freshDays, timezone = 'UTC') {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const flags = new Set(record.flags.filter((flag) => !['stale', 'expired', 'closed', 'delayed'].includes(flag)));
  if (now.getTime() - Date.parse(record.lastCheckedAt) > freshDays * 86400000) flags.add('stale');
  if (record.dates.exhibitEnd && record.dates.exhibitEnd < today) flags.add('expired');
  if (record.status === 'closed') flags.add('closed');
  if (record.status === 'delayed') flags.add('delayed');
  if (record.status === 'conflicting') flags.add('conflicting');
  return { ...record, flags: [...flags] };
}
function validateCatalog(value) {
  return onlyKeys(value, ['schemaVersion', 'revision', 'records']) && value.schemaVersion === VERSION && text(value.revision, 120) &&
    Array.isArray(value.records) && value.records.length <= 500 &&
    value.records.every((record) => validateRecord(record, true)) &&
    new Set(value.records.map((record) => record.id)).size === value.records.length;
}
function configErrors(config) {
  const errors = [];
  if (config?.schemaVersion !== VERSION || config.repository !== 'timrking11-blip/Gosie') errors.push('unsupported configuration');
  if (!text(config?.region, 120)) errors.push('configure a coarse city/region');
  if (config?.provider !== 'brave') errors.push('configure an approved public-search provider (brave)');
  if (!Array.isArray(config?.categories) || !config.categories.length || !config.categories.every((c) => CATEGORIES.includes(c))) errors.push('configure categories');
  if (!Array.isArray(config?.sources) || !config.sources.length || config.sources.length > 30) errors.push('configure approved seed sources');
  else for (const source of config.sources) {
    try {
      publicUrl(source.url);
      if (!text(source.publisher, 120) || !SOURCE_TYPES.includes(source.type) ||
        source.allowed !== true || !text(source.permissionNote, 300)) throw new Error();
    } catch { errors.push('source requires a public HTTPS URL, publisher, type, and permission note'); }
  }
  if (!Number.isInteger(config?.maxRequests) || config.maxRequests < 1 || config.maxRequests > 30) errors.push('maxRequests must be 1–30');
  if (!Number.isInteger(config?.maxRunSeconds) || config.maxRunSeconds < 1 || config.maxRunSeconds > 180) errors.push('maxRunSeconds must be 1–180');
  if (!Number.isInteger(config?.maxResponseBytes) || config.maxResponseBytes < 1024 || config.maxResponseBytes > 1048576) errors.push('invalid response byte limit');
  if (!Number.isInteger(config?.maxCandidates) || config.maxCandidates < 1 || config.maxCandidates > 100) errors.push('invalid candidate limit');
  if (!Number.isInteger(config?.freshDays) || config.freshDays < 1 || config.freshDays > 90) errors.push('freshDays must be 1–90');
  if (!Number.isFinite(config?.approvedCostPerSearchUsd) || config.approvedCostPerSearchUsd <= 0 ||
    !Number.isFinite(config?.maxCostUsd) || config.maxCostUsd <= 0 || config.maxCostUsd > 10) errors.push('approve a positive per-call cost and maximum budget');
  try {
    new Intl.DateTimeFormat('en', { timeZone: config.cadence.timezone });
    if (!Number.isInteger(config.cadence.weekday) || config.cadence.weekday < 0 || config.cadence.weekday > 6 ||
      !Number.isInteger(config.cadence.hour) || config.cadence.hour < 0 || config.cadence.hour > 23) throw new Error();
  } catch { errors.push('configure a valid weekly weekday, hour and IANA timezone'); }
  return errors;
}
function isDue(config, lastSuccessfulAt, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: config.cadence.timezone, weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][config.cadence.weekday] === parts.weekday &&
    Number(parts.hour) === config.cadence.hour &&
    (!lastSuccessfulAt || now.getTime() - Date.parse(lastSuccessfulAt) > 6 * 86400000);
}
module.exports = {
  VERSION, CATEGORIES, SOURCE_TYPES, publicUrl, canonicalUrl, identity, text, timestamp, date,
  validateRecord, validateCatalog, materialDigest, lifecycle, configErrors, isDue,
};
