import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clearWeekendPreferences,
  defaultWeekendPreferences,
  parseWeekendPreferencesImport,
  PREFERENCES_KIND,
  PREFERENCES_STORAGE_KEY,
  PREFERENCES_VERSION,
  rankSampleIdeas,
  readWeekendPreferences,
  sampleWeekendIdeas,
  serializeWeekendPreferences,
  validateWeekendPreferences,
  writeWeekendPreferences,
  type StorageLike,
  type WeekendPreferences,
} from './weekend-discovery.ts';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const prefs = (changes: Partial<WeekendPreferences> = {}): WeekendPreferences => ({
  ...defaultWeekendPreferences,
  ...changes,
});

describe('Weekend Ahead preference storage and portability', () => {
  it('starts with optional, empty choices when no browser value exists', () => {
    const storage = new MemoryStorage();
    assert.deepEqual(readWeekendPreferences(storage), {
      preferences: defaultWeekendPreferences,
      error: null,
    });
  });

  it('saves and reads only the validated preference fields', () => {
    const storage = new MemoryStorage();
    const value = prefs({
      categories: ['Outdoors'],
      interests: ['jazz'],
      experiences: ['Relaxed'],
      context: 'Friends',
      maxBudgetUsd: 30,
      maxTravelMinutes: 45,
    });
    assert.equal(writeWeekendPreferences(storage, value), true);
    assert.deepEqual(readWeekendPreferences(storage), { preferences: value, error: null });
    const stored = JSON.parse(storage.getItem(PREFERENCES_STORAGE_KEY)!);
    assert.deepEqual(Object.keys(stored).sort(), ['kind', 'preferences', 'version']);
    assert.equal(stored.kind, PREFERENCES_KIND);
    assert.equal(stored.version, PREFERENCES_VERSION);
  });

  it('leaves malformed browser data untouched until a user explicitly replaces or clears it', () => {
    const storage = new MemoryStorage();
    const original = '{not json';
    storage.setItem(PREFERENCES_STORAGE_KEY, original);
    assert.equal(readWeekendPreferences(storage).error, 'malformed');
    assert.equal(storage.getItem(PREFERENCES_STORAGE_KEY), original);
    assert.equal(clearWeekendPreferences(storage), true);
    assert.equal(storage.getItem(PREFERENCES_STORAGE_KEY), null);
  });

  it('handles unavailable browser storage without throwing', () => {
    const storage: StorageLike = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
    };
    assert.equal(readWeekendPreferences(storage).error, 'unavailable');
    assert.equal(writeWeekendPreferences(storage, prefs()), false);
    assert.equal(clearWeekendPreferences(storage), false);
  });

  it('round-trips a versioned preferences-only JSON document', () => {
    const value = prefs({
      categories: ['Music', 'Food'],
      interests: ['jazz', 'shared plates'],
      experiences: ['Relaxed', 'Low-cost'],
      context: 'Date',
      maxBudgetUsd: 40,
    });
    const serialized = serializeWeekendPreferences(value);
    assert.deepEqual(parseWeekendPreferencesImport(serialized), value);
    assert.equal(serialized.includes('event'), false);
    assert.equal(serialized.includes('source'), false);
  });

  it('rejects invalid JSON, wrong versions, unknown data, and out-of-range limits', () => {
    assert.throws(() => parseWeekendPreferencesImport('{broken'), /valid JSON/);
    assert.throws(() => parseWeekendPreferencesImport(JSON.stringify({
      kind: PREFERENCES_KIND,
      version: '2.0.0',
      preferences: defaultWeekendPreferences,
    })), /1\.0\.0/);
    assert.throws(() => parseWeekendPreferencesImport(JSON.stringify({
      kind: PREFERENCES_KIND,
      version: PREFERENCES_VERSION,
      preferences: { ...defaultWeekendPreferences, eventHistory: ['private item'] },
    })), /unsupported field/);
    assert.equal(validateWeekendPreferences({ ...defaultWeekendPreferences, maxBudgetUsd: 2001 }), null);
    assert.equal(validateWeekendPreferences({ ...defaultWeekendPreferences, interests: [''] }), null);
  });
});

describe('Weekend Ahead illustrative ranking and hard limits', () => {
  it('changes the sample order when a selected interest or category matches', () => {
    const defaultOrder = rankSampleIdeas(sampleWeekendIdeas, prefs()).included.map(({ idea }) => idea.id);
    const marketFirst = rankSampleIdeas(sampleWeekendIdeas, prefs({
      categories: ['Outdoors'],
      interests: ['MARKET'],
    })).included.map(({ idea }) => idea.id);
    assert.notDeepEqual(marketFirst, defaultOrder);
    assert.equal(marketFirst[0], 'o4');
    const market = rankSampleIdeas(sampleWeekendIdeas, prefs({ interests: ['market'] })).included.find(({ idea }) => idea.id === 'o4')!;
    assert.ok(market.reasons.some((reason) => reason.includes('Fictional sample tags match your selected interests: market')));
  });

  it('uses a social-context score as a ranking input and explains it', () => {
    const ranked = rankSampleIdeas(sampleWeekendIdeas, prefs({ context: 'Solo' }));
    assert.equal(ranked.included[0].idea.id, 'o2');
    assert.ok(ranked.included[0].reasons.some((reason) => reason.includes('Solo context score: 10/10')));
  });

  it('applies optional budget and travel limits before ranking with explicit reasons', () => {
    const ranked = rankSampleIdeas(sampleWeekendIdeas, prefs({
      maxBudgetUsd: 20,
      maxTravelMinutes: 15,
    }));
    assert.deepEqual(ranked.excluded.map(({ idea }) => idea.id).sort(), ['o1', 'o3']);
    assert.equal(ranked.included.some(({ idea }) => idea.id === 'o1'), false);
    assert.ok(ranked.excluded.find(({ idea }) => idea.id === 'o1')?.reasons.some((reason) => reason.includes('cost estimate')));
    assert.ok(ranked.excluded.find(({ idea }) => idea.id === 'o1')?.reasons.some((reason) => reason.includes('travel estimate')));
  });

  it('returns an honest empty result if every fictional sample fails a hard limit', () => {
    const ranked = rankSampleIdeas(sampleWeekendIdeas, prefs({
      maxBudgetUsd: 0,
      maxTravelMinutes: 0,
    }));
    assert.equal(ranked.included.length, 0);
    assert.equal(ranked.excluded.length, sampleWeekendIdeas.length);
    assert.ok(ranked.excluded.every(({ reasons }) => reasons.length > 0));
  });

  it('does not treat an unmatched user interest as a fact about an idea', () => {
    const ranked = rankSampleIdeas(sampleWeekendIdeas, prefs({ interests: ['astronomy'] }));
    assert.ok(ranked.included.every(({ reasons }) =>
      reasons.every((reason) => !reason.includes('astronomy') || reason.includes('selected interests')),
    ));
    assert.ok(ranked.included.every(({ reasons }) =>
      reasons.some((reason) => reason.includes('not verified event facts')),
    ));
  });
});
