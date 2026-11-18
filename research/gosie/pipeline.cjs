const {
  configErrors, publicUrl, canonicalUrl, identity, validateRecord, validateState, validateCatalog, materialDigest, lifecycle, text,
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
function mergeCandidates(previous, incoming, aliases = []) {
  const records = new Map(previous.map((record) => [record.id, { ...record }]));
  if (!validateState({ schemaVersion: 1, lastSuccessfulAt: null, candidates: previous, aliases })) throw new Error('invalid_alias_state');
  const redirects = new Map(aliases.map((a) => [a.fromId, a.toId]));
  let added = 0; let updated = 0;
  for (const next of incoming) {
    let id = next.id;
    while (redirects.has(id)) id = redirects.get(id);
    const same = records.get(id);
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
      const index = evidence.findIndex((old) => canonicalUrl(old.url) === canonicalUrl(item.url) &&
        old.excerpt === item.excerpt && old.publicationDate === item.publicationDate &&
        old.publisher === item.publisher && old.sourceType === item.sourceType && old.reference === item.reference);
      if (index >= 0) {
        evidence[index] = { ...evidence[index], checkedAt: new Date(Math.max(Date.parse(evidence[index].checkedAt), Date.parse(item.checkedAt))).toISOString() };
      } else {
        if (evidence.length >= 12) throw new Error('evidence_capacity_review_required');
        evidence.push({ ...item }); changed = true;
      }
    }
    const merged = {
      ...same, evidence,
      firstSeenAt: Date.parse(same.firstSeenAt) <= Date.parse(next.firstSeenAt) ? same.firstSeenAt : next.firstSeenAt,
      lastCheckedAt: Date.parse(same.lastCheckedAt) >= Date.parse(next.lastCheckedAt) ? same.lastCheckedAt : next.lastCheckedAt,
      ...(changed ? { review: null, verification: 'unverified', flags: [...new Set([...same.flags, 'conflicting'])] } : {}),
    };
    records.set(same.id, merged);
    updated++;
  }
  return { candidates: [...records.values()], added, updated };
}

function mergeReviewed(state, catalog, fromId, toId, reviewer, reason, now = new Date()) {
  if (!validateState(state) || !validateCatalog(catalog) || fromId === toId ||
    !text(reviewer, 80) || !text(reason, 1000) || reason.trim().length < 10) throw new Error('invalid_merge_review');
  const source = state.candidates.find((r) => r.id === fromId);
  const target = state.candidates.find((r) => r.id === toId);
  if (!source || !target) throw new Error('merge_requires_two_current_candidates');
  // Never retire an approved ID or silently rewrite the approved catalog.
  if (catalog.records.some((r) => r.id === fromId)) throw new Error('approved_source_id_cannot_be_retired');
  const alias = { fromId, toId, by: reviewer.trim(), reason: reason.trim(), at: now.toISOString(), source: structuredClone(source) };
  const aliases = [...(state.aliases || []), alias];
  const withoutSource = state.candidates.filter((r) => r.id !== fromId);
  if (!validateState({ ...state, candidates: withoutSource, aliases })) throw new Error('incompatible_merge_scope');
  const merged = mergeCandidates(withoutSource, [source], aliases);
  // Even identical evidence needs explicit renewed claim review after identity reconciliation.
  const candidates = merged.candidates.map((r) => r.id === toId ? {
    ...r, review: null, verification: 'unverified',
    flags: [...new Set([...r.flags, ...source.flags, 'conflicting'])],
  } : r);
  const result = { ...state, candidates, aliases };
  if (!validateState(result)) throw new Error('invalid_merged_state');
  return result;
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
  const merged = mergeCandidates(previous.candidates, incoming, previous.aliases || []);
  const complete = !exhausted && summary.sourceFailures.length === 0 && summary.rejected === 0;
  summary.status = complete ? 'success' : incoming.length ? 'partial' : 'failed';
  summary.added = merged.added; summary.updated = merged.updated;
  summary.lastSuccessfulAt = complete ? now.toISOString() : previous.lastSuccessfulAt || null;
  if (exhausted) summary.messages.push('Request, time or cost budget exhausted; last approved catalog unchanged.');
  return {
    summary,
    state: {
      schemaVersion: 1, lastSuccessfulAt: summary.lastSuccessfulAt,
      ...(previous.aliases ? { aliases: previous.aliases } : {}),
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
module.exports = { clean, unsafeInstructions, pageCandidates, draftRecord, mergeCandidates, mergeReviewed, runResearch, promote };
