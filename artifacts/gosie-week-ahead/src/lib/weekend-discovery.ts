export const PREFERENCES_VERSION = '1.0.0';
export const PREFERENCES_KIND = 'gosie-weekend-preferences';
export const PREFERENCES_STORAGE_KEY = 'gosie-weekend-preferences-v1';

export const activityCategories = [
  'Music', 'Film', 'Food', 'Outdoors', 'Arts', 'Festivals', 'Community',
  'Sports', 'Farmers markets', 'Learning', 'Books', 'Wellbeing', 'Games',
] as const;
export const experienceOptions = ['Relaxed', 'Lively', 'Creative', 'Outdoors', 'Low-cost'] as const;
export const socialContexts = ['All', 'Solo', 'Friends', 'Date', 'Group'] as const;

export type ActivityCategory = (typeof activityCategories)[number];
export type ExperiencePreference = (typeof experienceOptions)[number];
export type SocialContext = (typeof socialContexts)[number];

export type WeekendPreferences = {
  categories: ActivityCategory[];
  interests: string[];
  experiences: ExperiencePreference[];
  context: SocialContext;
  maxBudgetUsd?: number;
  maxTravelMinutes?: number;
};

export type SampleIdea = {
  id: string;
  title: string;
  category: ActivityCategory;
  when: string;
  sampleCostUsd: number;
  sampleTravelMinutes: number;
  tags: string[];
  experienceTags: ExperiencePreference[];
  contextScores: Record<SocialContext, number>;
  explanation: string;
};

export const sampleWeekendIdeas: SampleIdea[] = [
  {
    id: 'o1',
    title: 'A late set in a listening room',
    category: 'Music',
    when: 'Saturday · evening',
    sampleCostUsd: 24,
    sampleTravelMinutes: 20,
    tags: ['jazz', 'live music', 'listening room'],
    experienceTags: ['Relaxed', 'Lively'],
    contextScores: { All: 9, Solo: 7, Friends: 7, Date: 10, Group: 5 },
    explanation: 'A made-up music idea. It is not a real venue, listing, or availability claim.',
  },
  {
    id: 'o2',
    title: 'Restored film, little theater',
    category: 'Film',
    when: 'Friday · after dark',
    sampleCostUsd: 12,
    sampleTravelMinutes: 12,
    tags: ['classic film', 'film', 'cinema'],
    experienceTags: ['Relaxed', 'Creative'],
    contextScores: { All: 8, Solo: 10, Friends: 7, Date: 8, Group: 6 },
    explanation: 'A fictional classic-film idea. Its timing and sample estimates are not verified.',
  },
  {
    id: 'o3',
    title: 'Long lunch, shared plates',
    category: 'Food',
    when: 'Sunday · midday',
    sampleCostUsd: 35,
    sampleTravelMinutes: 15,
    tags: ['shared plates', 'lunch', 'food'],
    experienceTags: ['Lively', 'Creative'],
    contextScores: { All: 8, Solo: 4, Friends: 10, Date: 7, Group: 9 },
    explanation: 'A sample meal idea. It does not identify a restaurant, price, or availability.',
  },
  {
    id: 'o4',
    title: 'Riverside walk & small market',
    category: 'Outdoors',
    when: 'Sunday · morning',
    sampleCostUsd: 0,
    sampleTravelMinutes: 8,
    tags: ['market', 'riverside', 'walk'],
    experienceTags: ['Outdoors', 'Low-cost', 'Relaxed'],
    contextScores: { All: 7, Solo: 9, Friends: 8, Date: 6, Group: 8 },
    explanation: 'A fictional walk and market idea. No specific market, route, or opening time is being claimed.',
  },
  {
    id: 'o5', title: 'Small gallery, new perspectives', category: 'Arts', when: 'Saturday · afternoon',
    sampleCostUsd: 10, sampleTravelMinutes: 18,
    tags: ['art', 'gallery', 'museum', 'exhibition', 'photography'], experienceTags: ['Creative', 'Relaxed'],
    contextScores: { All: 8, Solo: 9, Friends: 7, Date: 8, Group: 6 },
    explanation: 'A fictional gallery and exhibition visit, not a real exhibit, admission price, or opening-hours claim.',
  },
  {
    id: 'o6', title: 'A neighborhood street festival', category: 'Festivals', when: 'Saturday · afternoon',
    sampleCostUsd: 15, sampleTravelMinutes: 25,
    tags: ['festival', 'street fair', 'culture', 'music', 'food'], experienceTags: ['Lively', 'Outdoors'],
    contextScores: { All: 8, Solo: 6, Friends: 9, Date: 7, Group: 9 },
    explanation: 'A made-up local festival idea. No actual festival, vendors, ticketing, or dates have been verified.',
  },
  {
    id: 'o7', title: 'Community garden volunteer morning', category: 'Community', when: 'Sunday · morning',
    sampleCostUsd: 0, sampleTravelMinutes: 10,
    tags: ['community', 'volunteering', 'garden', 'neighbors'], experienceTags: ['Outdoors', 'Low-cost'],
    contextScores: { All: 7, Solo: 8, Friends: 8, Date: 6, Group: 9 },
    explanation: 'A fictional volunteering idea, not a real organization, volunteer vacancy, or confirmed meeting time.',
  },
  {
    id: 'o8', title: 'A friendly pickup game in the park', category: 'Sports', when: 'Saturday · morning',
    sampleCostUsd: 0, sampleTravelMinutes: 12,
    tags: ['sports', 'basketball', 'soccer', 'fitness', 'pickup game'], experienceTags: ['Lively', 'Outdoors', 'Low-cost'],
    contextScores: { All: 7, Solo: 7, Friends: 9, Date: 5, Group: 9 },
    explanation: 'A fictional casual-sports idea. No organized game, facilities, equipment, or spaces are confirmed.',
  },
  {
    id: 'o9', title: 'Seasonal stalls at a farmers market', category: 'Farmers markets', when: 'Sunday · late morning',
    sampleCostUsd: 15, sampleTravelMinutes: 14,
    tags: ['farmers market', 'produce', 'seasonal food', 'local growers'], experienceTags: ['Relaxed', 'Outdoors'],
    contextScores: { All: 7, Solo: 8, Friends: 8, Date: 7, Group: 7 },
    explanation: 'A fictional farmers market outing. No market schedule, stalls, produce, or purchase prices are verified.',
  },
  {
    id: 'o10', title: 'Try a beginner pottery workshop', category: 'Learning', when: 'Saturday · midday',
    sampleCostUsd: 40, sampleTravelMinutes: 22,
    tags: ['workshop', 'pottery', 'crafts', 'learning'], experienceTags: ['Creative', 'Relaxed'],
    contextScores: { All: 7, Solo: 8, Friends: 8, Date: 9, Group: 7 },
    explanation: 'A fictional hands-on class, not a real studio, instructor, booking, or available place.',
  },
  {
    id: 'o11', title: 'Bookshop reading and a quiet browse', category: 'Books', when: 'Sunday · afternoon',
    sampleCostUsd: 0, sampleTravelMinutes: 9,
    tags: ['books', 'reading', 'literature', 'bookshop', 'author'], experienceTags: ['Relaxed', 'Creative', 'Low-cost'],
    contextScores: { All: 7, Solo: 9, Friends: 6, Date: 7, Group: 5 },
    explanation: 'A fictional literary outing. No author appearance, reading time, shop, or admission is confirmed.',
  },
  {
    id: 'o12', title: 'A gentle stretch and mindful pause', category: 'Wellbeing', when: 'Sunday · early morning',
    sampleCostUsd: 10, sampleTravelMinutes: 10,
    tags: ['wellbeing', 'yoga', 'stretching', 'mindfulness'], experienceTags: ['Relaxed', 'Low-cost'],
    contextScores: { All: 6, Solo: 8, Friends: 7, Date: 6, Group: 6 },
    explanation: 'A fictional wellbeing activity, not a real class, health claim, instructor, or schedule.',
  },
  {
    id: 'o13', title: 'Board games around a shared table', category: 'Games', when: 'Friday · evening',
    sampleCostUsd: 8, sampleTravelMinutes: 16,
    tags: ['board games', 'tabletop', 'games', 'meetup'], experienceTags: ['Lively', 'Creative', 'Low-cost'],
    contextScores: { All: 7, Solo: 6, Friends: 9, Date: 7, Group: 9 },
    explanation: 'A fictional social-games idea. No actual meetup, host, space, or game collection is being advertised.',
  },
];

export type RankedSample = {
  idea: SampleIdea;
  score: number;
  reasons: string[];
};

export type ExcludedSample = {
  idea: SampleIdea;
  reasons: string[];
};

export type WeekendRanking = {
  included: RankedSample[];
  excluded: ExcludedSample[];
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type PreferenceReadResult = {
  preferences: WeekendPreferences;
  error: 'unavailable' | 'malformed' | null;
};

export const defaultWeekendPreferences: WeekendPreferences = {
  categories: [],
  interests: [],
  experiences: [],
  context: 'All',
};

const allowedCategory = new Set<string>(activityCategories);
const allowedExperience = new Set<string>(experienceOptions);
const allowedContext = new Set<string>(socialContexts);
const allowedPreferenceKeys = new Set([
  'categories',
  'interests',
  'experiences',
  'context',
  'maxBudgetUsd',
  'maxTravelMinutes',
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseStringList<T extends string>(
  value: unknown,
  allowed: Set<string> | null,
  maxLength: number,
  maxItems: number,
): T[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length === 0 || item.length > maxLength) return null;
    const normalized = item.trim().replace(/\s+/g, ' ');
    if (allowed && !allowed.has(normalized)) return null;
    if (!result.some((current) => current.toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
      result.push(normalized);
    }
  }
  return result as T[];
}

function validOptionalLimit(value: unknown, max: number): value is number | undefined {
  return value === undefined || (Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max);
}

export function validateWeekendPreferences(value: unknown): WeekendPreferences | null {
  if (!isPlainRecord(value) || Object.keys(value).some((key) => !allowedPreferenceKeys.has(key))) return null;
  if (!allowedContext.has(String(value.context))) return null;

  const categories = parseStringList<ActivityCategory>(value.categories, allowedCategory, 40, activityCategories.length);
  const interests = parseStringList<string>(value.interests, null, 60, 20);
  const experiences = parseStringList<ExperiencePreference>(value.experiences, allowedExperience, 40, experienceOptions.length);
  if (!categories || !interests || !experiences) return null;
  if (!validOptionalLimit(value.maxBudgetUsd, 2000) || !validOptionalLimit(value.maxTravelMinutes, 240)) return null;

  return {
    categories,
    interests,
    experiences,
    context: value.context as SocialContext,
    ...(value.maxBudgetUsd === undefined ? {} : { maxBudgetUsd: value.maxBudgetUsd }),
    ...(value.maxTravelMinutes === undefined ? {} : { maxTravelMinutes: value.maxTravelMinutes }),
  };
}

export function readWeekendPreferences(storage: StorageLike): PreferenceReadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(PREFERENCES_STORAGE_KEY);
  } catch {
    return { preferences: { ...defaultWeekendPreferences }, error: 'unavailable' };
  }
  if (raw === null) return { preferences: { ...defaultWeekendPreferences }, error: null };

  try {
    const envelope: unknown = JSON.parse(raw);
    if (!isPlainRecord(envelope) ||
      envelope.kind !== PREFERENCES_KIND ||
      envelope.version !== PREFERENCES_VERSION ||
      Object.keys(envelope).some((key) => !['kind', 'version', 'preferences'].includes(key))) {
      return { preferences: { ...defaultWeekendPreferences }, error: 'malformed' };
    }
    const preferences = validateWeekendPreferences(envelope.preferences);
    return preferences
      ? { preferences, error: null }
      : { preferences: { ...defaultWeekendPreferences }, error: 'malformed' };
  } catch {
    return { preferences: { ...defaultWeekendPreferences }, error: 'malformed' };
  }
}

export function writeWeekendPreferences(storage: StorageLike, value: unknown): boolean {
  const preferences = validateWeekendPreferences(value);
  if (!preferences) return false;
  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({
      kind: PREFERENCES_KIND,
      version: PREFERENCES_VERSION,
      preferences,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearWeekendPreferences(storage: StorageLike): boolean {
  try {
    storage.removeItem(PREFERENCES_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function serializeWeekendPreferences(value: unknown): string {
  const preferences = validateWeekendPreferences(value);
  if (!preferences) throw new Error('Preferences are invalid.');
  return JSON.stringify({
    kind: PREFERENCES_KIND,
    version: PREFERENCES_VERSION,
    preferences,
  }, null, 2);
}

export function parseWeekendPreferencesImport(raw: string): WeekendPreferences {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!isPlainRecord(envelope) ||
    envelope.kind !== PREFERENCES_KIND ||
    envelope.version !== PREFERENCES_VERSION ||
    Object.keys(envelope).some((key) => !['kind', 'version', 'preferences'].includes(key))) {
    throw new Error(`This file must be a ${PREFERENCES_VERSION} Gosie preferences export.`);
  }
  const preferences = validateWeekendPreferences(envelope.preferences);
  if (!preferences) throw new Error('The preferences contain an unsupported field or value.');
  return preferences;
}

export function rankSampleIdeas(
  ideas: SampleIdea[],
  preferences: WeekendPreferences,
): WeekendRanking {
  const included: RankedSample[] = [];
  const excluded: ExcludedSample[] = [];
  const interestSet = new Set(preferences.interests.map((interest) => interest.toLocaleLowerCase()));

  for (const idea of ideas) {
    const exclusionReasons: string[] = [];
    if (preferences.maxBudgetUsd !== undefined && idea.sampleCostUsd > preferences.maxBudgetUsd) {
      exclusionReasons.push(`Its fictional cost estimate ($${idea.sampleCostUsd}) is above your $${preferences.maxBudgetUsd} limit.`);
    }
    if (preferences.maxTravelMinutes !== undefined && idea.sampleTravelMinutes > preferences.maxTravelMinutes) {
      exclusionReasons.push(`Its fictional travel estimate (${idea.sampleTravelMinutes} minutes) is above your ${preferences.maxTravelMinutes}-minute limit.`);
    }
    if (exclusionReasons.length) {
      excluded.push({ idea, reasons: exclusionReasons });
      continue;
    }

    const contextScore = idea.contextScores[preferences.context];
    const matchedInterests = idea.tags.filter((tag) => interestSet.has(tag.toLocaleLowerCase()));
    const categoryMatch = preferences.categories.includes(idea.category);
    const matchedExperiences = idea.experienceTags.filter((tag) => preferences.experiences.includes(tag));
    const score = Math.min(10, contextScore + (categoryMatch ? 1 : 0) + matchedInterests.length * 2 + matchedExperiences.length);
    const reasons = [
      `Fixed fictional ${preferences.context} context score: ${contextScore}/10.`,
      ...(categoryMatch ? [`The sample category matches ${idea.category}.`] : []),
      ...(matchedInterests.length ? [`Fictional sample tags match your selected interests: ${matchedInterests.join(', ')}.`] : []),
      ...(matchedExperiences.length ? [`Sample labels match these experience choices: ${matchedExperiences.join(', ')}.`] : []),
      ...(!categoryMatch && !matchedInterests.length && !matchedExperiences.length
        ? ['No selected soft preference matched this fictional sample; it remains because no chosen limit excludes it.']
        : []),
      idea.explanation,
      'All costs, travel estimates, tags, and scores on this card are illustrative—not verified event facts.',
    ];
    included.push({ idea, score, reasons });
  }

  included.sort((a, b) =>
    b.score - a.score ||
    b.idea.contextScores[preferences.context] - a.idea.contextScores[preferences.context] ||
    a.idea.title.localeCompare(b.idea.title),
  );

  return { included, excluded };
}
