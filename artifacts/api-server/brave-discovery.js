const categoryQueries = Object.freeze({
  arts: 'art, museums, theater, exhibitions and live performances',
  community: 'community gatherings and neighborhood activities',
  food: 'food events, pop-ups, tastings and dining events',
  festivals: 'festivals and fairs',
  markets: 'farmers markets and neighborhood markets',
  learning: 'public workshops, classes and learning events',
  music: 'live music and local concerts',
  news: 'local news and community event calendars',
  outdoors: 'outdoor activities and nature events',
  sports: 'local sports and recreational events',
});
const recentByUser = new Map();
const DAY_MS = 86400000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value) {
  return typeof value === 'string' && DAY_RE.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}
function validateSearch(body, now = new Date()) {
  const allowed = ['region', 'startDate', 'endDate', 'category', 'termsAccepted'];
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !allowed.includes(key)) ||
      typeof body.region !== 'string' || body.region.trim().length < 2 || body.region.length > 100 ||
      /\d/.test(body.region) || /(?:street|st\.|avenue|ave\.|road|rd\.|apartment|apt\.|unit)\b/i.test(body.region) ||
      !validDate(body.startDate) || !validDate(body.endDate) ||
      !Object.hasOwn(categoryQueries, body.category) || body.termsAccepted !== true) return null;
  const start = Date.parse(`${body.startDate}T00:00:00.000Z`);
  const end = Date.parse(`${body.endDate}T00:00:00.000Z`);
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  if (start < today || start > today + 90 * DAY_MS || end < start || end > start + 30 * DAY_MS) return null;
  return { region: body.region.trim(), startDate: body.startDate, endDate: body.endDate, category: body.category };
}
function reserveUserSearch(userId, nowMs = Date.now()) {
  for (const [key, searches] of recentByUser) {
    const recent = searches.filter((time) => nowMs - time < DAY_MS);
    if (recent.length) recentByUser.set(key, recent);
    else recentByUser.delete(key);
  }
  const searches = recentByUser.get(userId) || [];
  if (searches.length >= 5 || (searches.length && nowMs - searches[searches.length - 1] < 60000)) return false;
  recentByUser.set(userId, [...searches, nowMs]);
  return true;
}
function clearSearchLimitsForTests() { recentByUser.clear(); }
function safeSource(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}
function mapResults(payload, kind) {
  const rows = kind === 'news' ? payload?.results : payload?.web?.results;
  if (!Array.isArray(rows)) return [];
  const results = [];
  for (const row of rows) {
    const url = safeSource(row?.url);
    const title = typeof row?.title === 'string' ? row.title.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    const descriptionValue = row?.description ?? row?.snippet;
    const description = typeof descriptionValue === 'string' ? descriptionValue.replace(/\s+/g, ' ').trim().slice(0, 500) : '';
    const publisher = typeof row?.meta_url?.hostname === 'string' ? row.meta_url.hostname.slice(0, 120)
      : typeof row?.meta_url?.netloc === 'string' ? row.meta_url.netloc.slice(0, 120) : 'Public web source';
    const age = typeof row?.age === 'string' ? row.age.slice(0, 80) : null;
    if (!url || !title || results.some((result) => result.url === url)) continue;
    results.push({ id: `brave-${results.length + 1}`, title, url, description, publisher, age });
    if (results.length >= 8) break;
  }
  return results;
}
async function callBrave({ region, startDate, endDate, category }) {
  if (process.env.BRAVE_SEARCH_ENABLED !== '1') {
    const error = new Error('discovery_search_not_enabled');
    error.status = 503;
    throw error;
  }
  const type = category === 'news' ? 'news' : 'web';
  const q = `${categoryQueries[category]} in ${region} between ${startDate} and ${endDate}`;
  if (process.env.GOSIE_DB_ENV === 'test' && process.env.GOSIE_BRAVE_SEARCH_MOCK === '1') {
    return mapResults({
      web: { results: [{ title: 'Synthetic local event result', url: 'https://example.org/synthetic-event',
        description: 'Synthetic fixture only. Not a real event.', meta_url: { hostname: 'example.org' } }] },
      results: [{ title: 'Synthetic local news result', url: 'https://example.org/synthetic-news',
        description: 'Synthetic fixture only. Not a real news story.', meta_url: { hostname: 'example.org' } }],
    }, type);
  }
  const { ReplitConnectors } = await import('@replit/connectors-sdk');
  const connectors = new ReplitConnectors();
  const params = new URLSearchParams({ q, count: '8', country: 'US', search_lang: 'en', ui_lang: 'en-US', safesearch: 'moderate' });
  const response = await connectors.proxy('brave', `/res/v1/${type}/search?${params.toString()}`, { method: 'GET' });
  if (!response.ok) {
    const error = new Error('discovery_provider_unavailable');
    error.status = response.status === 429 ? 429 : 503;
    throw error;
  }
  const payload = await response.json();
  return mapResults(payload, type);
}
async function searchForUser(userId, input, now = new Date()) {
  const valid = validateSearch(input, now);
  if (!valid) return { status: 400, payload: { error: 'invalid_discovery_search' } };
  if (process.env.BRAVE_SEARCH_ENABLED !== '1' &&
      !(process.env.GOSIE_DB_ENV === 'test' && process.env.GOSIE_BRAVE_SEARCH_MOCK === '1')) {
    return { status: 503, payload: { error: 'discovery_search_not_enabled' } };
  }
  if (!reserveUserSearch(userId, now.getTime())) return { status: 429, payload: { error: 'search_rate_limited' } };
  try {
    const results = await callBrave(valid);
    // Do not log, cache, persist, or return the search query. Provider data exists
    // only in this request/response and the caller's transient page state.
    return { status: 200, payload: { retrievedAt: now.toISOString(), category: valid.category, results } };
  } catch (error) {
    return { status: error.status === 429 ? 429 : error.status === 503 ? 503 : 503,
      payload: { error: error.status === 429 ? 'search_rate_limited' : 'discovery_provider_unavailable' } };
  }
}
module.exports = { validateSearch, reserveUserSearch, mapResults, searchForUser, clearSearchLimitsForTests };
