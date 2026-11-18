import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  rankWeekendSampleIdeas,
  weekendSampleIdeas,
} from './weekend-samples.ts';

const titles = (ideas) => ideas.map((idea) => idea.title);

describe('Weekend Ahead sample limits and ranking', () => {
  it('includes ideas at or below the budget cap and excludes higher budgets', () => {
    const ranked = rankWeekendSampleIdeas(weekendSampleIdeas, 'All', 1, 25);
    assert.deepEqual(titles(ranked), [
      'Restored-print film night',
      'Riverside walk & market',
    ]);
    assert.ok(ranked.every((idea) => idea.budgetLevel <= 1));
  });

  it('includes ideas at or below the travel cap and excludes longer trips', () => {
    const ranked = rankWeekendSampleIdeas(weekendSampleIdeas, 'All', null, 15);
    assert.deepEqual(titles(ranked), [
      'Restored-print film night',
      'Long lunch, shared plates',
      'Riverside walk & market',
    ]);
    assert.ok(ranked.every((idea) => idea.travelMinutes <= 15));
  });

  it('ranks all eligible ideas by the selected preset scores', () => {
    assert.deepEqual(
      titles(rankWeekendSampleIdeas(weekendSampleIdeas, 'All', null, 25)),
      [
        'Late set at a small jazz room',
        'Restored-print film night',
        'Long lunch, shared plates',
        'Riverside walk & market',
      ],
    );
    assert.deepEqual(
      titles(rankWeekendSampleIdeas(weekendSampleIdeas, 'Friends', null, 25)),
      [
        'Long lunch, shared plates',
        'Riverside walk & market',
        'Late set at a small jazz room',
        'Restored-print film night',
      ],
    );
  });

  it('changes only the ordering of ideas that pass both caps', () => {
    const initialTitles = titles(weekendSampleIdeas);
    const solo = rankWeekendSampleIdeas(weekendSampleIdeas, 'Solo', 1, 15);
    const friends = rankWeekendSampleIdeas(weekendSampleIdeas, 'Friends', 1, 15);

    assert.deepEqual(titles(solo), [
      'Restored-print film night',
      'Riverside walk & market',
    ]);
    assert.deepEqual(titles(friends), [
      'Riverside walk & market',
      'Restored-print film night',
    ]);
    assert.deepEqual([...titles(solo)].sort(), [...titles(friends)].sort());
    assert.deepEqual(titles(weekendSampleIdeas), initialTitles);
  });

  it('keeps limit controls screen-local and discloses that choices are not saved', async () => {
    const screen = await readFile(new URL('./(tabs)/weekend.tsx', import.meta.url), 'utf8');
    const controlsStart = screen.indexOf('<View style={styles.limitPanel}>');
    const controlsEnd = screen.indexOf('<View style={styles.preferenceList}>', controlsStart);
    assert.notEqual(controlsStart, -1);
    assert.notEqual(controlsEnd, -1);

    const controls = screen.slice(controlsStart, controlsEnd);
    assert.match(screen, /const \[budgetLimit, setBudgetLimit\] = useState/);
    assert.match(screen, /const \[travelLimit, setTravelLimit\] = useState/);
    assert.match(controls, /onPress=\{\(\) => setBudgetLimit\(option\.value\)\}/);
    assert.match(controls, /onPress=\{\(\) => setTravelLimit\(minutes\)\}/);
    assert.match(controls, /Selections are not saved or synced/);
    assert.match(screen, /not saved preferences/);
    assert.doesNotMatch(controls, /dispatchFeedback|AsyncStorage|fetch\(/);
  });
});
