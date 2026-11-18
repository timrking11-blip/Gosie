import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReviewedDiscoveries, type ReviewedDiscovery } from './reviewed-discoveries.ts';

const base: ReviewedDiscovery = {
  id: 'fixture-1', title: 'Synthetic community festival', venue: 'Synthetic park', region: 'Fictional region',
  startsAt: null,
  price: { label: 'Price', value: null, status: 'unknown' },
  travel: { label: 'Travel', value: 'About 15 minutes', status: 'estimated' },
  accessibility: { label: 'Accessibility', value: null, status: 'unknown' },
  availability: { label: 'Availability', value: 'Tickets available at retrieval', status: 'verified' },
  publisher: 'Synthetic source', sourceUrl: 'https://www.nycgovparks.org/events', retrievedAt: '2026-11-18T12:00:00Z',
  whyIncluded: 'Synthetic fixture for tests only.', approval: 'reviewed',
};
test('empty offline registry is valid and no fake listing is required', () => {
  assert.deepEqual(parseReviewedDiscoveries([]), []);
  assert.equal(parseReviewedDiscoveries(null), null);
  assert.deepEqual(parseReviewedDiscoveries([base]), [base]);
});
test('reviewed records require source, approval, freshness timestamp and explicit fact confidence', () => {
  for (const [field, value] of [
    ['approval', 'pending'], ['sourceUrl', 'http://example.org/event'],
    ['sourceUrl', 'https://user:pass@example.org/event'], ['publisher', ''],
    ['sourceUrl', 'https://localhost/private'], ['sourceUrl', 'https://127.0.0.1/event'],
    ['retrievedAt', 'not-a-date'], ['startsAt', 'tomorrow'],
    ['price', { label: 'Ticket price', value: null, status: 'unknown' }],
    ['price', { label: 'Price', value: '$15', status: 'unknown' }],
    ['travel', { label: 'Travel', value: null, status: 'estimated' }],
  ] as const) {
    assert.equal(parseReviewedDiscoveries([{ ...base, [field]: value }]), null, String(field));
  }
});
test('rejects duplicate identities, unknown fields and oversized lists rather than displaying unreviewed data', () => {
  assert.equal(parseReviewedDiscoveries([base, base]), null);
  assert.equal(parseReviewedDiscoveries([{ ...base, providerRaw: 'unreviewed' }]), null);
  assert.equal(parseReviewedDiscoveries(Array.from({ length: 101 }, (_, i) => ({ ...base, id: `fixture-${i}` }))), null);
});
