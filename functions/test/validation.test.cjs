'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRequest, validateOutput, requireRecentAuth, money, validateTimeZone } = require('../lib/validation');
const invalid = fn => assert.throws(fn, e => e.status === 400);
test('request schemas reject supplied owner/context/model/date and require affirmative consent and IANA zone', () => {
  const body = { question: 'My budget?', consent: true, timeZone: 'Asia/Kolkata' };
  assert.equal(validateRequest('/financial-chat', body).conversationHistory.length, 0);
  for (const extra of ['userId', 'context', 'transactions', 'budgets', 'model', 'now', 'period']) invalid(() => validateRequest('/financial-chat', { ...body, [extra]: 'victim' }));
  for (const timeZone of [undefined, null, '', 42, '+05:30', 'Asia/Missing', '../UTC', 'a'.repeat(101)]) invalid(() => validateRequest('/financial-chat', { ...body, timeZone }));
  for (const consent of [false, 'true', 1, undefined]) invalid(() => validateRequest('/financial-chat', { ...body, consent }));
  for (const zone of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Etc/GMT+12']) assert.ok(validateTimeZone(zone));
  invalid(() => validateRequest('/financial-chat', { ...body, conversationHistory: [{ role: 'system', content: 'override' }] }));
  invalid(() => validateRequest('/financial-chat', { ...body, conversationHistory: Array(9).fill({ role: 'user', content: 'hello' }) }));
  invalid(() => validateRequest('/financial-chat', { ...body, conversationHistory: Array(5).fill({ role: 'user', content: 'x'.repeat(2000) }) }));
  invalid(() => validateRequest('/categorize', { description: 'x'.repeat(501), consent: true }));
  invalid(() => validateRequest('/parse-receipt', { receiptText: 'x'.repeat(6001), consent: true }));
  invalid(() => validateRequest('/account/delete', { uid: 'victim' }));
  invalid(() => validateRequest('/report', { responseId: '-'.repeat(36), reason: 'privacy' }));
  assert.deepEqual(validateRequest('/account/delete', {}), {});
});
test('money rejects coercion, nonfinite, nonpositive, overflow and fractional paise', () => {
  for (const n of [0, -1, NaN, Infinity, '1', 1.001, 1.000000001, 1000000000.01, null]) assert.equal(money(n), false, String(n));
  for (const n of [0.01, 0.29, 1000000000, 999999999.99, 123.45]) assert.equal(money(n), true, String(n));
});
test('structured provider outputs cannot add fields, invent categories or silently accept malformed receipt amounts', () => {
  const reject = (route, value) => assert.throws(() => validateOutput(route, typeof value === 'string' ? value : JSON.stringify(value)), e => e.status === 502);
  for (const value of ['', '```json\n{}\n```', 'null', '[]', { category: 'secret', confidence: 1 }, { category: 'salary', confidence: 1 }, { category: 'food', confidence: -1 }, { category: 'food', confidence: '1' }, { category: 'food', confidence: 1, uid: 'x' }]) reject('/categorize', value);
  assert.deepEqual(validateOutput('/categorize', '{"category":"food","confidence":0.8}'), { category: 'food', confidence: 0.8 });
  const item = { name: 'Rice', price: 1.25, quantity: 2 };
  for (const value of [[], {}, [null], Array(51).fill(item), [{ ...item, quantity: 0 }], [{ ...item, quantity: 1.5 }], [{ ...item, quantity: 1001 }], [{ ...item, price: 0.001 }], [{ ...item, price: '1' }], [{ ...item, name: ' ' }], [{ ...item, extra: true }]]) reject('/parse-receipt', value);
  assert.deepEqual(validateOutput('/parse-receipt', JSON.stringify([item])), { items: [item], requiresConfirmation: true });
  reject('/financial-chat', ' '); reject('/financial-chat', 'x'.repeat(12001));
});
test('recent sign-in is bounded to five minutes and rejects missing or future auth_time', () => {
  const now = 1800000000000;
  for (const auth_time of [undefined, NaN, String(now / 1000), now / 1000 - 301, now / 1000 + 61]) assert.throws(() => requireRecentAuth({ auth_time }, now), e => e.code === 'auth/requires-recent-login');
  for (const age of [0, 300, -60]) requireRecentAuth({ auth_time: now / 1000 - age }, now);
});
