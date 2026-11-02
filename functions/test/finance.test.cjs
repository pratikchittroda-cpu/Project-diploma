'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MemoryDb } = require('./helpers.cjs');
const { monthBounds, ledgerDate, fetchFinanceContext, buildMessages, MAX_TRANSACTIONS, MAX_BUDGETS } = require('../lib/finance');
const now = new Date('2026-03-01T00:30:00Z');
const row = (date, amount = 10, extra = {}) => ({ userId: 'alice', type: 'expense', category: 'food', amount, date, ...extra });
test('month-to-date follows requested IANA calendar at boundaries including leap day and DST', () => {
  assert.deepEqual(monthBounds(now, 'America/Los_Angeles'), { start: '2026-02-01', end: '2026-03-01', periodEnd: '2026-03-01', timeZone: 'America/Los_Angeles', calendar: 'Local calendar month to date; date-only ledger', endExclusive: true });
  assert.equal(monthBounds(now, 'Asia/Kolkata').end, '2026-03-02');
  assert.equal(monthBounds(new Date('2024-02-29T12:00:00Z'), 'UTC').end, '2024-03-01');
  assert.equal(monthBounds(new Date('2026-03-08T10:30:00Z'), 'America/Los_Angeles').end, '2026-03-09');
  assert.equal(ledgerDate('2026-03-01T00:15:00Z', 'America/Los_Angeles'), '2026-02-28');
  assert.equal(ledgerDate('2026-03-01', 'America/Los_Angeles'), '2026-03-01');
  for (const date of ['2025-02-29', '2026-04-31', '1899-12-31', '2026-02-30T01:00:00Z', '2026-03-01T10:00:00', 'not a date', null]) assert.throws(() => ledgerDate(date, 'UTC'), e => e.code === 'finance/invalid-data');
});
test('context includes date-only and legacy instants/fallbacks; filters all data by owner and sends only aggregates', async () => {
  const db = new MemoryDb({
    'transactions/a': row('2026-02-01', 0.1, { description: 'PRIVATE merchant', note: 'PRIVATE memo' }),
    'transactions/b': row('2026-03-01T00:15:00Z', 0.2),
    'transactions/c': row(undefined, 1.005, { createdAt: '2026-02-28T12:00:00.000Z', category: 'Food & Dining' }),
    'transactions/d': row('2026-03-01', 999),
    'transactions/e': row('2026-02-20', 50000, { userId: 'bob' }),
    'budgets/old': { userId: 'alice', category: 'Food & Dining', period: 'Monthly', amount: 40 },
    'budgets/budget_alice_food_Monthly': { userId: 'alice', category: 'food', period: 'Monthly', amount: 50 },
    'budgets/secret': { userId: 'bob', category: 'food', period: 'Monthly', amount: 99999 },
  });
  const context = await fetchFinanceContext(db, 'alice', now, 'America/Los_Angeles');
  assert.equal(context.transactionCount, 3); assert.equal(context.totals.expenses, 1.31); assert.equal(context.complete, true);
  assert.deepEqual(context.monthlyBudgets, [{ category: 'food', amount: 50, period: 'Monthly' }]);
  const payload = JSON.stringify(buildMessages('/financial-chat', { question: 'Budget?', conversationHistory: [] }, context));
  for (const forbidden of ['PRIVATE', 'alice', 'bob', '50000', '99999', 'userId', 'description', 'createdAt']) assert.ok(!payload.includes(forbidden), forbidden);
});
test('canonical tombstones hide legacy duplicates; monthly limits are never inferred from other periods', async () => {
  const db = new MemoryDb({
    'budgets/legacy': { userId: 'alice', category: 'food', period: 'Monthly', amount: 10 },
    'budgets/budget_alice_food_Monthly': { userId: 'alice', category: 'food', period: 'Monthly', amount: 10, archived: true },
    'budgets/week': { userId: 'alice', category: 'transport', period: 'Weekly', amount: 20 },
  });
  const context = await fetchFinanceContext(db, 'alice', now, 'UTC');
  assert.deepEqual(context.monthlyBudgets, []); assert.match(context.budgetNote, /cannot be determined/);
});
test('malformed legacy data and truncation fail closed before partial totals can be sent', async () => {
  for (const stored of [row('not-date'), row('2026-03-01', '10'), row('2020-01-01', '10'), row('2026-03-01', -10), row('2026-03-01', 10, { category: 'unknown' })]) {
    await assert.rejects(fetchFinanceContext(new MemoryDb({ 'transactions/bad': stored }), 'alice', now, 'UTC'), e => e.code === 'finance/invalid-data');
  }
  await assert.rejects(fetchFinanceContext(new MemoryDb({ 'budgets/bad': { userId: 'alice', category: 'food', amount: 0, period: 'Monthly' } }), 'alice', now, 'UTC'), e => e.code === 'finance/invalid-data');
  for (const extra of [{ period: 'Weekly', amount: '10' }, { period: 'Yearly', amount: 0 }, { archived: 'true' }]) {
    await assert.rejects(fetchFinanceContext(new MemoryDb({ 'budgets/bad': { userId: 'alice', category: 'food', amount: 10, period: 'Monthly', ...extra } }), 'alice', now, 'UTC'), e => e.code === 'finance/invalid-data');
  }
  for (const [collection, max] of [['transactions', MAX_TRANSACTIONS], ['budgets', MAX_BUDGETS]]) {
    const db = new MemoryDb(Object.fromEntries(Array.from({ length: max + 1 }, (_, i) => [`${collection}/${i}`, { userId: 'alice' }])));
    await assert.rejects(fetchFinanceContext(db, 'alice', now, 'UTC'), e => e.code === 'finance/too-large');
  }
});
