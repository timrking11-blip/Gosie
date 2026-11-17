const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rankWeekend, validSocial, ideas } = require('./weekend-engine');
const { demoProfiles } = require('./demo-data');
const base = { ...demoProfiles[2].config, budgetHard: true };

test('all social lenses preserve all records and never override hard limits', () => {
  const config = { ...base, budgetPerActivity: 10, maxTravelMinutes: 15, allowExceptions: false };
  for (const social of validSocial) {
    const result = rankWeekend(config, [], social);
    assert.equal(result.included.length + result.exceptions.length + result.excluded.length + result.dismissed.length, ideas.length);
    assert.ok(result.included.length > 0);
    assert.equal(result.exceptions.length, 0);
    for (const idea of result.included) {
      assert.ok(idea.price <= 10 && idea.travelMinutes <= 15);
      assert.ok(config.transportModes.includes(idea.transport));
    }
  }
});

test('latest rating changes score and order without changing another profile', () => {
  const neutral = rankWeekend(base, []);
  const low = rankWeekend(base, [{ item_id: 'e1', action: 'rating', rating: 1 }]);
  const high = rankWeekend(base, [{ item_id: 'e1', action: 'rating', rating: 5 }]);
  const find = (result) => result.included.find((idea) => idea.id === 'e1');
  assert.equal(find(high).score - find(low).score, 32);
  assert.ok(high.included.findIndex((idea) => idea.id === 'e1') < low.included.findIndex((idea) => idea.id === 'e1'));
  assert.deepEqual(rankWeekend(base, []), neutral);
});

test('saving, dismissal, and undo use explicit profile feedback', () => {
  const saved = rankWeekend(base, [{ item_id: 'e1', action: 'saved' }]);
  assert.equal(saved.included[0].id, 'e1');
  const dismissed = rankWeekend(base, [{ item_id: 'e1', action: 'dismissed' }]);
  assert.equal(dismissed.dismissed[0].id, 'e1');
  assert.ok(!dismissed.included.some((idea) => idea.id === 'e1'));
  assert.ok(rankWeekend(base, []).included.some((idea) => idea.id === 'e1'));
});

test('UI interest values match sample categories and explicit tags', () => {
  const cfg = { ...base, weekendInterests: ['Live music'], customInterests: [] };
  const without = rankWeekend({ ...cfg, weekendInterests: [] }, []);
  const withMusic = rankWeekend(cfg, []);
  assert.equal(withMusic.included.find((idea) => idea.id === 'e1').score - without.included.find((idea) => idea.id === 'e1').score, 20);
});
