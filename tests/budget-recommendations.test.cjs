const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./helpers/react-ui.cjs');
const finance = load('utils/finance.js');
const config = load('config/aiConfig.js');
const { getBudgetRecommendations: recommend } = load('utils/budgetRecommendations.js', { './finance': finance, '../config/aiConfig': config });
const now = () => new Date(2026, 9, 6, 12);
const entry = extra => ({ id: 'fixture-entry', userId: 'fixture-owner', type: 'expense', date: '2026-10-06', category: 'food', amount: 80, description: 'Synthetic groceries', ...extra });
const budget = extra => ({ id: 'budget_fixture-owner_food_Monthly', userId: 'fixture-owner', period: 'Monthly', category: 'food', amount: 100, ...extra });

test('restored local recommendations use saved monthly limits, exact paise thresholds and no future spending', () => {
  for (const [amount, type] of [[69.99, null], [70, 'warning'], [89.99, 'warning'], [90, 'critical'], [100, 'exceeded'], [100.01, 'exceeded']]) {
    const result = recommend([entry({ amount }), entry({ date: '2026-10-07', amount: 9000 })], [budget()], { now: now() });
    assert.equal(result[0]?.type || null, type);
    if (type) { assert.match(result[0].message, /saved ₹100\.00 monthly limit/); assert.ok(!result[0].message.includes('9,000')); }
  }
  const fractional = recommend(Array.from({ length: 3 }, () => entry({ amount: 0.29 })), [budget({ amount: 1 })], { now: now() });
  assert.match(fractional[0].message, /₹0\.87.*87\.0%/);
  assert.match(fractional[0].suggestions[0], /₹0\.13/);
});

test('canonical budgets and archive tombstones win and unsaved budget limits are never inferred', () => {
  const legacy = budget({ id: 'legacy', amount: 50 });
  assert.equal(recommend([entry()], [legacy, budget({ amount: 200 })], { now: now() }).length, 0);
  assert.equal(recommend([entry()], [legacy, budget({ archived: true })], { now: now() }).length, 0);
  assert.equal(recommend([entry()], [], { now: now() }).length, 0);
  assert.equal(recommend([entry()], [budget({ amount: 0 })], { now: now() }).length, 0);
});

test('keyword reviews use whole recorded transactions once, bounded local days, and honest recorded amounts', () => {
  const rows = [entry({ amount: 120, description: 'Synthetic coffee and cafe purchase' }),
    entry({ amount: 500, description: 'Workshop service' }),
    entry({ amount: 700, description: 'Coffee', date: '2026-10-07' }),
    entry({ amount: 800, description: 'Coffee', date: '2026-09-01' })];
  const result = recommend(rows, [], { now: now() });
  const tip = result.find(row => row.id.startsWith('savings:'));
  assert.match(tip.message, /1 recorded expense description.*₹120\.00/);
  assert.ok(!result.some(row => row.id.startsWith('savings:shopping')));
  assert.ok(!tip.suggestions.some(text => /save ₹60/.test(text)));
});

test('previous-month patterns cover the full previous calendar month and distinguish current month-to-date', () => {
  const rows = [entry({ date: '2026-09-01', amount: 20 }), entry({ date: '2026-09-30', amount: 30 }), entry({ amount: 5 })];
  const result = recommend(rows, [], { now: now() });
  assert.match(result[0].message, /2026-09 \(full month\): ₹50\.00/);
  assert.match(result[0].message, /This month to date.*₹5\.00/);
  assert.match(result[0].suggestions[1], /different lengths of time/);
  assert.deepEqual(plain(result), plain(recommend(rows, [], { now: now() })));
});

test('invalid full-snapshot inputs fail rather than mixing reliable totals with partial recommendations', () => {
  for (const rows of [[entry({ amount: 'bad' })], [entry({ date: '2026-02-30' })], [entry({ description: {} })], [entry({ type: 'invalid' })]]) {
    assert.throws(() => recommend(rows, [budget()], { now: now() }));
  }
  assert.throws(() => recommend([], [budget({ period: 'Daily' })], { now: now() }));
  assert.throws(() => recommend([], [], { now: new Date('invalid') }));
});
