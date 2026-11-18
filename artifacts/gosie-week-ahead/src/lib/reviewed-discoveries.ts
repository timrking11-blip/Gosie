export type EvidenceStatus = 'verified' | 'estimated' | 'unknown';
export type EvidenceField = { label: string; value: string | null; status: EvidenceStatus };
export type ReviewedDiscovery = {
  id: string;
  title: string;
  venue: string;
  region: string;
  startsAt: string | null;
  price: EvidenceField;
  travel: EvidenceField;
  accessibility: EvidenceField;
  availability: EvidenceField;
  publisher: string;
  sourceUrl: string;
  retrievedAt: string;
  whyIncluded: string;
  approval: 'reviewed';
};
const text = (v: unknown, max = 300): v is string =>
  typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u001f]/.test(v);
const timestamp = (v: unknown): v is string => text(v, 40) && Number.isFinite(Date.parse(v));
function field(value: unknown): value is EvidenceField {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).every((k) => ['label', 'value', 'status'].includes(k)) &&
    text(v.label, 50) && (v.value === null || text(v.value, 180)) &&
    ['verified', 'estimated', 'unknown'].includes(String(v.status)) &&
    ((v.status === 'unknown') === (v.value === null));
}
export function parseReviewedDiscoveries(value: unknown): ReviewedDiscovery[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const result: ReviewedDiscovery[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const r = item as Record<string, unknown>;
    const allowed = ['id', 'title', 'venue', 'region', 'startsAt', 'price', 'travel',
      'accessibility', 'availability', 'publisher', 'sourceUrl', 'retrievedAt', 'whyIncluded', 'approval'];
    if (Object.keys(r).some((key) => !allowed.includes(key)) ||
      !text(r.id, 100) || ids.has(r.id) || !text(r.title, 180) || !text(r.venue, 140) ||
      !text(r.region, 120) || !(r.startsAt === null || timestamp(r.startsAt)) ||
      !field(r.price) || !field(r.travel) || !field(r.accessibility) || !field(r.availability) ||
      !text(r.publisher, 120) || !text(r.sourceUrl, 2048) || !timestamp(r.retrievedAt) ||
      !text(r.whyIncluded, 400) || r.approval !== 'reviewed') return null;
    try {
      const url = new URL(r.sourceUrl);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
    } catch { return null; }
    ids.add(r.id);
    result.push(r as unknown as ReviewedDiscovery);
  }
  return result;
}
