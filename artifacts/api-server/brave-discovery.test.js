const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSearch, reserveUserSearch, mapResults, searchForUser, clearSearchLimitsForTests } = require('./brave-discovery');
const now = new Date('2026-11-18T12:00:00Z');
const request = { region: 'Brooklyn, NY', startDate: '2026-11-20', endDate: '2026-11-30', category: 'news', termsAccepted: true };

test('requires an explicit coarse region, future bounded dates, category and end-user use acceptance', () => {
  assert.deepEqual(validateSearch(request, now), { region: 'Brooklyn, NY', startDate: request.startDate, endDate: request.endDate, category: 'news' });
  for (const invalid of [
    { ...request, region: '12 Main St, Brooklyn' }, { ...request, startDate: '2026-11-17' },
    { ...request, endDate: '2026-12-21' }, { ...request, endDate: '2026-11-19' },
    { ...request, termsAccepted: false }, { ...request, arbitrary: 'personal profile data' },
  ]) assert.equal(validateSearch(invalid, now), null);
});
test('rate limits one search per minute and five per day per authenticated user', () => {
  clearSearchLimitsForTests();
  assert.equal(reserveUserSearch('synthetic-user', 1000000), true);
  assert.equal(reserveUserSearch('synthetic-user', 1059999), false);
  for (let i = 1; i < 5; i++) assert.equal(reserveUserSearch('synthetic-user', 1000000 + i * 60000), true);
  assert.equal(reserveUserSearch('synthetic-user', 1000000 + 5 * 60000), false);
  assert.equal(reserveUserSearch('other-user', 1000001), true);
  clearSearchLimitsForTests();
});
test('provider mapping accepts safe HTTPS sources, limits count and length, and excludes untrusted fields', () => {
  const results = mapResults({ results: [
    { title: 'Safe headline', url: 'https://news.example.org/story', description: 'A result',
      age: '2 days ago', meta_url: { hostname: 'news.example.org' }, private: 'ignored' },
    { title: 'HTTP link', url: 'http://news.example.org/story' },
    { title: 'Credential link', url: 'https://user:password@news.example.org/story' },
    ...Array.from({ length: 10 }, (_, i) => ({ title: `Headline ${i}`, url: `https://example.org/${i}` })),
  ] }, 'news');
  assert.equal(results.length, 8);
  assert.equal(results[0].title, 'Safe headline');
  assert.equal('private' in results[0], false);
  assert.ok(results.every((item) => item.url.startsWith('https://') && !('private' in item)));
});
test('provider disabled state does not consume request allowance or make network calls', async () => {
  clearSearchLimitsForTests();
  const before = process.env.BRAVE_SEARCH_ENABLED;
  delete process.env.BRAVE_SEARCH_ENABLED;
  try {
    assert.deepEqual(await searchForUser('disabled-user', request, now),
      { status: 503, payload: { error: 'discovery_search_not_enabled' } });
    assert.equal(reserveUserSearch('disabled-user', now.getTime()), true);
  } finally {
    if (before === undefined) delete process.env.BRAVE_SEARCH_ENABLED;
    else process.env.BRAVE_SEARCH_ENABLED = before;
    clearSearchLimitsForTests();
  }
});
