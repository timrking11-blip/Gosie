const ideas = [
  { id: 'e1', name: 'Riverside Jazz Quartet', category: 'Live Music', price: 35, travelMinutes: 20, transport: 'transit', social: ['solo', 'date', 'friends', 'flexible'], interests: [], text: 'riverside jazz quartet live music' },
  { id: 'e2', name: 'Night Market & Street Food Row', category: 'Food & Drink', price: 25, travelMinutes: 15, transport: 'walking', social: ['friends', 'date', 'family', 'group', 'flexible'], interests: ['Restaurants and food', 'Hidden gems'], text: 'night market street food restaurants hidden gems' },
  { id: 'e3', name: 'Modern Photography Exhibition', category: 'Arts & Museums', price: 18, travelMinutes: 25, transport: 'transit', social: ['solo', 'date', 'flexible'], interests: ['Arts, museums, and theater'], text: 'modern photography exhibition arts museums photography' },
  { id: 'e4', name: 'Hilltop Trail Hike & Picnic', category: 'Outdoors', price: 0, travelMinutes: 35, transport: 'driving', social: ['solo', 'friends', 'family', 'flexible'], interests: [], text: 'hilltop trail hike picnic outdoors' },
  { id: 'e5', name: 'Arena Rock Show', category: 'Live Music', price: 85, travelMinutes: 55, transport: 'transit', social: ['friends', 'date', 'group', 'flexible'], interests: [], text: 'arena rock show live music' },
  { id: 'e6', name: 'Beginner Pottery Workshop', category: 'Learning', price: 45, travelMinutes: 18, transport: 'cycling', social: ['solo', 'date', 'friends', 'flexible'], interests: ['Learning and workshops', 'Hidden gems'], text: 'beginner pottery workshop learning hidden gems' },
  { id: 'e7', name: 'Rooftop Cinema: Classic Films', category: 'Movies & Cinema', price: 22, travelMinutes: 28, transport: 'transit', social: ['date', 'friends', 'flexible'], interests: ['Arts, museums, and theater'], text: 'rooftop cinema classic films arts museums' },
  { id: 'e8', name: 'Community 5K Fun Run', category: 'Fitness', price: 15, travelMinutes: 22, transport: 'cycling', social: ['solo', 'friends', 'family', 'group', 'flexible'], interests: [], text: 'community 5k fun run fitness' },
  { id: 'e9', name: 'Faraway Vineyard Day Trip', category: 'Day Trips', price: 60, travelMinutes: 95, transport: 'driving', social: ['date', 'friends', 'flexible'], interests: ['Restaurants and food'], text: 'faraway vineyard day trip restaurants food' },
  { id: 'e10', name: 'Neighborhood Bookshop Reading', category: 'Learning', price: 0, travelMinutes: 8, transport: 'walking', social: ['solo', 'flexible'], interests: ['Learning and workshops'], text: 'neighborhood bookshop reading learning' },
  { id: 'e11', name: 'Marvel Premiere Night Screening', category: 'Movies & Cinema', price: 24, travelMinutes: 26, transport: 'transit', social: ['friends', 'date', 'group', 'flexible'], interests: [], text: 'marvel premiere night screening marvel cinematic universe movies cinema' },
  { id: 'e12', name: 'Independent Cinema: Director Q&A', category: 'Movies & Cinema', price: 16, travelMinutes: 24, transport: 'transit', social: ['solo', 'date', 'flexible'], interests: ['Arts, museums, and theater'], text: 'independent cinema director q&a movies cinema' },
  { id: 'e13', name: 'Comic Books & Collectibles Meetup', category: 'Pop Culture', price: 5, travelMinutes: 14, transport: 'walking', social: ['friends', 'group', 'flexible'], interests: [], text: 'comic books collectibles meetup pop culture' },
  { id: 'e14', name: 'Sunrise Photography Walk', category: 'Outdoors', price: 0, travelMinutes: 18, transport: 'walking', social: ['solo', 'friends', 'group', 'flexible'], interests: [], text: 'sunrise photography walk photography guided walks meetups outdoors' },
  { id: 'e15', name: 'Board Game & Tabletop Night', category: 'Gaming', price: 10, travelMinutes: 16, transport: 'cycling', social: ['friends', 'group', 'flexible'], interests: [], text: 'board game tabletop night gaming' },
  { id: 'e16', name: 'Community Volunteering Morning', category: 'Community', price: 0, travelMinutes: 20, transport: 'transit', social: ['solo', 'friends', 'group', 'family', 'flexible'], interests: [], text: 'community volunteering morning' },
].map((item) => ({ ...item, sourceType: 'fictional-demo' }));

const validSocial = new Set(['all', 'solo', 'friends', 'date', 'group', 'family']);
const tokens = (value) => String(value || '').toLowerCase().match(/[a-z]+/g) || [];
const normalizeInterest = (value) => String(value || '').toLowerCase().replace(/[^a-z]+/g, ' ').split(' ').filter((word) => word && word !== 'and').sort().join(' ');

function customMatch(record, interest) {
  const recordTokens = new Set(tokens(record.text));
  const specificTokens = tokens(interest.specific || interest.specificInterest || interest.originalText);
  if (specificTokens.some((token) => recordTokens.has(token))) return true;
  const descriptiveTokens = new Set([
    ...tokens(interest.category),
    ...tokens(interest.label || interest.originalText),
    ...tokens(interest.desiredExperience || interest.experience),
  ]);
  let matches = 0;
  for (const token of descriptiveTokens) if (recordTokens.has(token)) matches++;
  return matches >= 3;
}

function rankWeekend(config, feedbackRows, socialInput = 'all') {
  const social = validSocial.has(socialInput) ? socialInput : 'all';
  const feedback = new Map();
  for (const row of feedbackRows) feedback.set(`${row.item_id}:${row.action}`, row);
  const transportModes = Array.isArray(config.transportModes) ? config.transportModes : [];
  const interests = new Set((config.weekendInterests || []).map(normalizeInterest));
  const included = [];
  const exceptions = [];
  const excluded = [];
  const dismissed = [];

  for (const idea of ideas) {
    const reasons = [];
    if (!transportModes.includes(idea.transport)) reasons.push(`Needs ${idea.transport}, which is not in this profile's travel modes.`);
    if (idea.travelMinutes > config.maxTravelMinutes) {
      if (!(config.allowExceptions && idea.travelMinutes <= config.exceptionTravelMinutes)) {
        reasons.push(`${idea.travelMinutes} min exceeds the ${config.maxTravelMinutes} min travel limit.`);
      }
    }
    if (config.budgetHard && idea.price > config.budgetPerActivity) {
      reasons.push(`$${idea.price} exceeds the $${config.budgetPerActivity} hard budget.`);
    }
    const saved = feedback.get(`${idea.id}:saved`);
    const dismissedFeedback = feedback.get(`${idea.id}:dismissed`);
    const rating = feedback.get(`${idea.id}:rating`);
    const status = dismissedFeedback ? 'dismissed' : reasons.length ? 'excluded' : (
      idea.travelMinutes > config.maxTravelMinutes || (!config.budgetHard && idea.price > config.budgetPerActivity)
    ) ? 'exception' : 'included';
    const why = [
      'Fictional example only. Listing, price, availability, and travel time are not verified.',
    ];
    const matchedCustom = (config.customInterests || []).filter((interest) => customMatch(idea, interest));
    const matchedInterest = [idea.category, ...idea.interests].some((interest) => interests.has(normalizeInterest(interest)));
    if (matchedInterest) why.push(`Matches a selected interest: ${idea.interests.join(', ')}.`);
    else why.push('No selected-interest match; soft preference only, not an exclusion.');
    if (matchedCustom.length) why.push(`Matches sample interest: ${matchedCustom.map((interest) => interest.label || 'custom interest').join(', ')}.`);
    if (social !== 'all') {
      if (idea.social.includes(social)) why.push(`Social context match: ${social}.`);
      else if (idea.social.includes('flexible')) why.push('Shown as a flexible fit for this context.');
      else why.push(`Lower fit for ${social}; this context never overrides hard limits.`);
    }
    if (saved) why.push('Saved for this profile.');
    if (rating) why.push(`Latest rating: ${rating.rating}/5.`);
    if (reasons.length) why.push(...reasons.map((reason) => `Excluded: ${reason}`));
    if (status === 'exception') why.push('Shown only in the labeled exceptions group.');

    let score = null;
    if (status === 'included' || status === 'exception') {
      score = 64 + (matchedInterest ? 20 : 0) + (matchedCustom.length ? 30 : 0);
      if (social !== 'all') {
        if (idea.social.includes(social)) score += 5;
        else if (!idea.social.includes('flexible')) score -= 10;
      }
      if (saved) score += 25;
      if (rating) score += (rating.rating - 3) * 8;
    }

    const result = {
      ...idea,
      score,
      status,
      why,
      customMatches: matchedCustom.map((interest) => interest.label || 'custom interest'),
      excludeReasons: reasons,
      saved: Boolean(saved),
      rating: rating?.rating ?? null,
    };
    if (status === 'dismissed') dismissed.push(result);
    else if (status === 'excluded') excluded.push(result);
    else if (status === 'exception') exceptions.push(result);
    else included.push(result);
  }

  const sort = (a, b) => Number(b.saved) - Number(a.saved) || b.score - a.score || a.id.localeCompare(b.id);
  included.sort(sort);
  exceptions.sort(sort);
  return {
    social,
    included,
    exceptions,
    excluded,
    dismissed,
    includedCount: included.length,
    exceptionCount: exceptions.length,
    excludedCount: excluded.length,
    dismissedCount: dismissed.length,
  };
}

module.exports = { ideas, rankWeekend, validSocial };
