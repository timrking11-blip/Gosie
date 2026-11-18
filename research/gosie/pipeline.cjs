const {
  configErrors, publicUrl, canonicalUrl, identity, validateRecord, materialDigest, lifecycle, text,
} = require('./contract.cjs');
const { safeFetch } = require('./safe-fetch.cjs');

const clean = (value, max = 280) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const unsafeInstructions = (value) => /ignore (all |previous |prior )?instructions|system prompt|exfiltrat|send (credentials|secrets)|<script\b/i.test(value);
function pageCandidates(html, source, category, region, now) {
  const nodes = [];
  // Parse data only; never execute page scripts or send their contents to a model.
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      const roots = Array.isArray(data) ? data : [data];
      for (const root of roots) nodes.push(...(Array.isArray(root?.['@graph']) ? root['@graph'] : [root]));
    } catch { /* Invalid structured data does not become a claim. */ }
  }
  const relevant = nodes.filter((node) => node && /Restaurant|ExhibitionEvent|Event|TouristAttraction|Museum/.test(String(node['@type'])));
  return relevant.slice(0, 10).map((node) => ({
    title: clean(node.name, 200),
    venue: clean(typeof node.location === 'object' ? node.location?.name : node.location, 200) || clean(node.name, 200),
    category, region, source,
    excerpt: clean(node.description || node.name),
    reference: 'Page JSON-LD name/description; unverified, requires human review',
    now,
  }));
}
function draftRecord({ title, venue, category, region, source, excerpt, reference, now }) {
  if (!text(title, 200) || !text(venue, 200) || !text(excerpt, 280) ||
    unsafeInstructions(`${title} ${excerpt}`)) throw new Error('unsupported_or_instructional_content');
  publicUrl(source.url);
  const record = {
    title, venue, category, region,
    why: 'Potential public experience found in the configured research scope. A reviewer must establish why it is worth considering.',
    status: 'unknown', verification: 'unverified',
    firstSeenAt: now.toISOString(), lastCheckedAt: now.toISOString(),
    dates: { publication: null, announcedOpening: null, confirmedOpening: null, exhibitStart: null, exhibitEnd: null },
    claimEvidence: {},
    evidence: [{
      url: canonicalUrl(source.url), publisher: source.publisher, sourceType: source.type,
      excerpt, reference, publicationDate: null, checkedAt: now.toISOString(),
    }],
    flags: [], review: null,
  };
  record.id = identity(record);
  return record;
}
function mergeCandidates(previous, incoming) {
  const records = new Map(previous.map((record) => [record.id, { ...record }]));
  let added = 0; let updated = 0;
  for (const next of incoming) {
    const same = records.get(next.id);
    if (!same) {
      records.set(next.id, next);
      added++;
      continue;
    }
    // Keep reviewer-established dates/status; observed text changes invalidate
    // review and raise a conflict instead of guessing which evidence is correct.
    const evidence = [...same.evidence];
    let changed = false;
    for (const item of next.evidence) {
      const index = evidence.findIndex((old) => canonicalUrl(old.url) === canonicalUrl(item.url));
      if (index >= 0) {
        if (evidence[index].excerpt !== item.excerpt) changed = true;
        evidence[index] = { ...evidence[index], excerpt: item.excerpt, checkedAt: item.checkedAt };
      } else if (evidence.length < 12) { evidence.push(item); changed = true; }
    }
    const merged = {
      ...same, evidence, lastCheckedAt: next.lastCheckedAt,
      ...(changed ? { review: null, verification: 'unverified', flags: [...new Set([...same.flags, 'conflicting'])] } : {}),
    };
    records.set(same.id, merged);
    updated++;
  }
  return { candidates: [...records.values()], added, updated };
}

async function runResearch(config, previous, {
  activated = false, now = new Date(), fetchPage = safeFetch, search = null,
} = {}) {
  const summary = {
    at: now.toISOString(), status: 'disabled', messages: [], added: 0, updated: 0, rejected: 0,
    sourceFailures: [], requests: 0, searches: 0, budgetReservedUsd: 0,
    lastSuccessfulAt: previous.lastSuccessfulAt || null, discoveredSources: [],
  };
  if (!activated || config.enabled !== true) {
    summary.messages.push('Research is disabled. Owner provider/cost and activation approval is required.');
    return { state: previous, summary };
  }
  const errors = configErrors(config);
  if (!search) errors.push('search provider is not connected');
  if (errors.length) {
    summary.status = 'setup-required'; summary.messages = errors;
    return { state: previous, summary };
  }
  const started = Date.now();
  const incoming = [];
  const requestedUrls = new Set();
  let exhausted = false;
  function reserve(isSearch = false) {
    if (summary.requests >= config.maxRequests || Date.now() - started >= config.maxRunSeconds * 1000 ||
      (isSearch && summary.budgetReservedUsd + config.approvedCostPerSearchUsd > config.maxCostUsd + 1e-9)) {
      exhausted = true; throw new Error('research_budget_exhausted');
    }
    summary.requests++;
    if (isSearch) {
      summary.searches++;
      summary.budgetReservedUsd = Number((summary.searches * config.approvedCostPerSearchUsd).toFixed(6));
    }
  }
  async function inspect(source, category) {
    const url = canonicalUrl(source.url);
    if (requestedUrls.has(url) || incoming.length >= config.maxCandidates) return;
    requestedUrls.add(url);
    reserve();
    const page = await fetchPage(url, {
      maxBytes: config.maxResponseBytes,
      timeoutMs: Math.max(1, Math.min(8000, config.maxRunSeconds * 1000 - (Date.now() - started))),
    });
    if (!/text\/html/i.test(page.contentType)) throw new Error('unsupported_source_content_type');
    const found = pageCandidates(page.text, source, category, config.region, now);
    for (const candidate of found) {
      if (incoming.length >= config.maxCandidates) break;
      try { incoming.push(draftRecord(candidate)); } catch { summary.rejected++; }
    }
  }
  // Recheck existing public evidence first, without changing the approved catalog.
  const targets = [
    ...previous.candidates.filter((record) => config.sources.some((source) =>
      canonicalUrl(source.url) === canonicalUrl(record.evidence[0].url))).map((record) => ({
      source: { ...record.evidence[0], type: record.evidence[0].sourceType, url: record.evidence[0].url },
      category: record.category,
    })),
    ...config.sources.map((source, i) => ({ source, category: config.categories[i % config.categories.length] })),
  ];
  // Reserve at least one search per configured category before page rechecks
  // can consume the request budget.
  for (const { source, category } of targets) {
    if (summary.requests >= config.maxRequests - config.categories.length) break;
    try { await inspect(source, category); }
    catch (error) {
      summary.sourceFailures.push({ source: canonicalUrl(source.url), code: safeError(error) });
      if (exhausted) break;
    }
  }
  for (const category of config.categories) {
    if (exhausted) break;
    const subject = { restaurant: 'restaurant openings announced newly open', exhibit: 'museum exhibition exhibit dates', experience: 'distinctive local culture tourism experiences' }[category];
    try {
      reserve(true);
      const response = await search(`${config.region} ${subject}`, config.maxResponseBytes,
        Math.max(1, Math.min(8000, config.maxRunSeconds * 1000 - (Date.now() - started))));
      for (const item of response.slice(0, 8)) {
        if (incoming.length >= config.maxCandidates) break;
        try {
          const url = publicUrl(item.url);
          const seed = config.sources.find((source) => publicUrl(source.url).hostname === url.hostname);
          if (!seed && !config.allowAdditionalSources) continue;
          const source = seed
            ? { ...seed, url: url.href }
            : { url: url.href, publisher: url.hostname, type: 'publisher' };
          if (!seed) summary.discoveredSources.push({ url: canonicalUrl(item.url), status: 'untrusted-candidate-only' });
          // Search snippets are leads, never verified opening/exhibit facts.
          incoming.push(draftRecord({
            title: clean(item.title, 200), venue: clean(item.title, 200), region: config.region,
            category, source, excerpt: clean(item.description),
            reference: 'Search result snippet; unverified lead, not a verified venue identity', now,
          }));
        } catch { summary.rejected++; }
      }
    } catch (error) { summary.sourceFailures.push({ source: 'search-provider', code: safeError(error) }); }
  }
  const merged = mergeCandidates(previous.candidates, incoming);
  const complete = !exhausted && summary.sourceFailures.length === 0 && summary.rejected === 0;
  summary.status = complete ? 'success' : incoming.length ? 'partial' : 'failed';
  summary.added = merged.added; summary.updated = merged.updated;
  summary.lastSuccessfulAt = complete ? now.toISOString() : previous.lastSuccessfulAt || null;
  if (exhausted) summary.messages.push('Request, time or cost budget exhausted; last approved catalog unchanged.');
  return {
    summary,
    state: {
      schemaVersion: 1, lastSuccessfulAt: summary.lastSuccessfulAt,
      candidates: merged.candidates.map((record) => lifecycle(record, now, config.freshDays, config.cadence.timezone)),
    },
  };
}
function safeError(error) {
  return ['research_budget_exhausted', 'blocked_network_address', 'invalid_public_url', 'redirect_not_followed',
    'source_too_large', 'source_timeout', 'unsupported_source_content_type'].includes(error.message) ||
    /^source_http_\d{3}$/.test(error.message) ? error.message : 'source_failed';
}
function promote(state, catalog, id, reviewer, now = new Date()) {
  const candidate = state.candidates.find((candidate) => candidate.id === id);
  const record = candidate && lifecycle(candidate, now, 14);
  if (!record || !text(reviewer, 80) || !validateRecord(record) || record.verification !== 'source-supported' ||
    record.status === 'unknown' || record.flags.some((flag) => ['conflicting', 'date-review', 'stale'].includes(flag))) {
    throw new Error('review_required: resolve identity, evidence, dates, verification and flags before promotion');
  }
  const approved = {
    ...record, review: { by: reviewer, at: now.toISOString(), digest: materialDigest(record) },
  };
  return {
    schemaVersion: 1, revision: `review-${now.toISOString()}`,
    records: [...catalog.records.filter((item) => item.id !== id), approved],
  };
}
module.exports = { clean, unsafeInstructions, pageCandidates, draftRecord, mergeCandidates, runResearch, promote };
