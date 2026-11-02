'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../lib/app');
const { MemoryDb, fakeBucket } = require('./helpers.cjs');
const { RETENTION } = require('../lib/retention');
const now = Date.parse('2026-10-04T12:00:00Z');
async function fixture(t, overrides = {}) {
  const db = new MemoryDb({ 'users/alice': { uid: 'alice' } }), calls = { auth: [], provider: 0, appCheck: 0 };
  const options = { db, bucket: fakeBucket(), apiKey: () => 'test-only', aiEnabled: true, clock: () => now,
    auth: { verifyIdToken: async (token, revoked) => { calls.auth.push([token, revoked]); if (token === 'revoked') throw new Error('PRIVATE revoked details'); return { uid: 'alice', auth_time: now / 1000 }; }, deleteUser: async () => {} },
    appCheck: { verifyToken: async token => { calls.appCheck++; if (token !== 'valid-app') throw new Error('PRIVATE App Check'); } },
    provider: async () => { calls.provider++; return 'Educational answer'; }, ...overrides };
  const server = createApp(options).listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async (path, body = {}, headers = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST', headers: { Authorization: 'Bearer valid', 'X-Firebase-AppCheck': 'valid-app', 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  return { request, db: options.db, calls };
}
const chat = { question: 'How is my budget?', consent: true, timeZone: 'Asia/Kolkata' };
test('HTTP auth rejects unsigned/revoked sessions and App Check is enforced by default', async t => {
  const f = await fixture(t);
  for (const Authorization of ['', 'Basic wrong', 'Bearer revoked']) {
    const response = await f.request('/financial-chat', chat, { Authorization });
    assert.equal(response.status, 401); assert.ok(!JSON.stringify(response.body).includes('PRIVATE'));
  }
  assert.ok(f.calls.auth.every(([, revoked]) => revoked === true));
  const noCheck = await f.request('/financial-chat', chat, { 'X-Firebase-AppCheck': '' });
  assert.equal(noCheck.status, 403); assert.equal(noCheck.body.code, 'app-check/required'); assert.equal(f.calls.provider, 0);
});
test('HTTP contract refuses cross-account context and data injection before a paid call', async t => {
  const f = await fixture(t);
  for (const body of [{ ...chat, userId: 'bob' }, { ...chat, context: { balance: 999 } }, { ...chat, timeZone: undefined }, { ...chat, consent: false }]) assert.equal((await f.request('/financial-chat', body)).status, 400);
  assert.equal(f.calls.provider, 0); assert.equal(f.db.data.has('aiQuota/alice'), false);
});
test('HTTP responses are private, malformed JSON/oversize/CORS are bounded and AI remains opt-in', async t => {
  const f = await fixture(t, { aiEnabled: false });
  const disabled = await f.request('/financial-chat', chat);
  assert.equal(disabled.status, 503); assert.equal(disabled.body.code, 'ai/disabled');
  assert.equal(disabled.headers.get('cache-control'), 'no-store'); assert.equal(disabled.headers.get('x-powered-by'), null);
  assert.equal((await f.request('/categorize', '{')).status, 400);
  assert.equal((await f.request('/categorize', { description: 'x'.repeat(25000) })).status, 400);
  assert.equal((await f.request('/financial-chat', chat, { Origin: 'https://hostile.invalid' })).status, 403);
});
test('HTTP server derives owned context and stores a reportable receipt without raw ledger transmission', async t => {
  let sent;
  const f = await fixture(t, { provider: async request => { sent = request; return 'Education, not investment advice.'; } });
  f.db.data.set('transactions/a', { userId: 'alice', amount: 10, type: 'expense', category: 'food', date: '2026-10-04', description: 'PRIVATE merchant' });
  f.db.data.set('transactions/b', { userId: 'bob', amount: 9999, type: 'income', category: 'salary', date: '2026-10-04' });
  const response = await f.request('/financial-chat', chat);
  assert.equal(response.status, 200); assert.equal(response.body.context.transactionCount, 1);
  assert.ok(!JSON.stringify(sent).includes('PRIVATE')); assert.ok(!JSON.stringify(sent).includes('9999'));
  const receipt = f.db.data.get(`aiResponses/${response.body.responseId}`);
  assert.equal(receipt.userId, 'alice'); assert.equal(receipt.expiresAt, now + RETENTION.responseMs);
  assert.equal((await f.request('/report', { responseId: response.body.responseId, reason: 'inaccurate' })).status, 200);
  assert.equal(f.db.data.get(`aiReports/${response.body.responseId}`).expiresAt, now + RETENTION.reportMs);
});
test('HTTP report ownership and expiry are verified before a report is saved', async t => {
  const f = await fixture(t), id = '11111111-1111-4111-8111-111111111111';
  for (const record of [{ userId: 'bob', expiresAt: now + 100 }, { userId: 'alice', expiresAt: now }, { userId: 'alice' }]) {
    f.db.data.set(`aiResponses/${id}`, record);
    const response = await f.request('/report', { responseId: id, reason: 'privacy' });
    assert.equal(response.status, 404); assert.equal(f.db.data.has(`aiReports/${id}`), false);
  }
});
test('provider failure is not retried or leaked and consumes reserved quota; malformed output is rejected', async t => {
  let attempts = 0;
  const f = await fixture(t, { provider: async () => { attempts++; throw new Error('PRIVATE backend/provider secret'); } });
  const failed = await f.request('/financial-chat', chat);
  assert.equal(failed.status, 503); assert.ok(!JSON.stringify(failed).includes('PRIVATE')); assert.equal(attempts, 1);
  assert.equal(f.db.data.get('aiQuota/alice').ai.daily, 1);
  const malformed = await fixture(t, { provider: async () => '{"category":"food","confidence":9}' });
  assert.equal((await malformed.request('/categorize', { description: 'Food', consent: true })).body.code, 'ai/invalid-output');
});
test('deletion racing a provider call blocks receipt writes and recent authentication is required', async t => {
  const db = new MemoryDb({ 'users/alice': { uid: 'alice' } });
  const f = await fixture(t, { db, provider: async () => { db.data.set('deletionJobs/alice', { status: 'pending' }); return 'answer'; } });
  assert.equal((await f.request('/financial-chat', chat)).body.code, 'account/deleting');
  assert.equal((await db.collection('aiResponses').get()).size, 0);
  const stale = await fixture(t, { auth: { verifyIdToken: async () => ({ uid: 'alice', auth_time: now / 1000 - 301 }), deleteUser: async () => assert.fail('stale auth deleted') } });
  assert.equal((await stale.request('/account/delete')).body.code, 'auth/requires-recent-login');
  assert.equal(stale.db.data.has('deletionJobs/alice'), false);
});
test('HTTP deletion confirms completion only after cleanup; partial failures return durable in-progress status', async t => {
  const complete = await fixture(t);
  assert.deepEqual((await complete.request('/account/delete')).body, { success: true });
  assert.equal(complete.db.data.has('users/alice'), false);
  assert.equal(complete.db.data.get('deletionJobs/alice').status, 'complete');
  const incomplete = await fixture(t, { bucket: { getFiles: async () => { throw new Error('PRIVATE failed storage'); } } });
  const response = await incomplete.request('/account/delete');
  assert.equal(response.status, 409); assert.equal(response.body.code, 'deletion/in-progress');
  assert.ok(!JSON.stringify(response).includes('PRIVATE'));
  assert.equal(incomplete.db.data.get('deletionJobs/alice').status, 'pending');
  assert.equal(incomplete.db.data.has('users/alice'), true);
});
