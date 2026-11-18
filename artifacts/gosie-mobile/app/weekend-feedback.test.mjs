import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  createWeekendFeedbackState,
  summarizeWeekendFeedback,
  weekendFeedbackReducer,
} from './weekend-feedback.ts';

const ideaA = 'Late set at a small jazz room';
const ideaB = 'Restored-print film night';
const update = (state, action) => weekendFeedbackReducer(state, action);

describe('Weekend Ahead temporary feedback', () => {
  it('starts with no feedback and the All social context selected', () => {
    assert.deepEqual(createWeekendFeedbackState(), {
      context: 'All',
      savedIdeas: [],
      dismissedIdeas: [],
      ratings: {},
    });
  });

  it('saves and unsaves ideas without changing other feedback', () => {
    let state = createWeekendFeedbackState();
    state = update(state, { type: 'toggle-saved', title: ideaA });
    state = update(state, { type: 'toggle-saved', title: ideaB });
    assert.deepEqual(state.savedIdeas, [ideaA, ideaB]);

    state = update(state, { type: 'toggle-saved', title: ideaA });
    assert.deepEqual(state.savedIdeas, [ideaB]);
    assert.deepEqual(state.dismissedIdeas, []);
    assert.deepEqual(state.ratings, {});
  });

  it('changes an idea rating and counts each rated idea once', () => {
    let state = createWeekendFeedbackState();
    state = update(state, { type: 'rate', title: ideaA, rating: 2 });
    state = update(state, { type: 'rate', title: ideaA, rating: 5 });
    assert.equal(state.ratings[ideaA], 5);
    assert.equal(summarizeWeekendFeedback(state).rated, 1);

    state = update(state, { type: 'rate', title: ideaB, rating: 3 });
    assert.deepEqual(state.ratings, { [ideaA]: 5, [ideaB]: 3 });
    assert.equal(summarizeWeekendFeedback(state).rated, 2);
  });

  it('dismisses once and restores an idea without losing its other feedback', () => {
    let state = createWeekendFeedbackState();
    state = update(state, { type: 'toggle-saved', title: ideaA });
    state = update(state, { type: 'rate', title: ideaA, rating: 4 });
    state = update(state, { type: 'dismiss', title: ideaA });
    state = update(state, { type: 'dismiss', title: ideaA });
    assert.deepEqual(state.dismissedIdeas, [ideaA]);

    state = update(state, { type: 'restore', title: ideaA });
    assert.deepEqual(state.dismissedIdeas, []);
    assert.deepEqual(state.savedIdeas, [ideaA]);
    assert.equal(state.ratings[ideaA], 4);
  });

  it('reports saved, dismissed, and distinct rated idea totals', () => {
    let state = createWeekendFeedbackState();
    state = update(state, { type: 'toggle-saved', title: ideaA });
    state = update(state, { type: 'dismiss', title: ideaB });
    state = update(state, { type: 'rate', title: ideaA, rating: 5 });
    state = update(state, { type: 'rate', title: ideaB, rating: 1 });
    state = update(state, { type: 'rate', title: ideaB, rating: 3 });
    assert.deepEqual(summarizeWeekendFeedback(state), {
      saved: 1,
      dismissed: 1,
      rated: 2,
    });
  });

  it('preserves saved, dismissed, and rated feedback when social context changes', () => {
    let state = createWeekendFeedbackState();
    state = update(state, { type: 'toggle-saved', title: ideaA });
    state = update(state, { type: 'dismiss', title: ideaB });
    state = update(state, { type: 'rate', title: ideaA, rating: 4 });
    state = update(state, { type: 'set-context', context: 'Friends' });
    state = update(state, { type: 'set-context', context: 'Date' });

    assert.equal(state.context, 'Date');
    assert.deepEqual(state.savedIdeas, [ideaA]);
    assert.deepEqual(state.dismissedIdeas, [ideaB]);
    assert.deepEqual(state.ratings, { [ideaA]: 4 });
  });

  it('keeps feedback screen-local and discloses that nothing is stored or synced', async () => {
    const state = createWeekendFeedbackState();
    assert.deepEqual(Object.keys(state).sort(), [
      'context',
      'dismissedIdeas',
      'ratings',
      'savedIdeas',
    ]);

    const screen = await readFile(new URL('./(tabs)/weekend.tsx', import.meta.url), 'utf8');
    assert.match(screen, /current session only/);
    assert.match(screen, /Nothing is stored or synced/);
  });
});
