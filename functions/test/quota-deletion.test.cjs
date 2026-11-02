'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MemoryDb, fakeBucket } = require('./helpers.cjs');
const { reserveQuota, LIMITS } = require('../lib/quota');
const { startDeletion, runDeletion, COLLECTIONS } = require('../lib/deletion');
const { RETENTION, cleanExpiredData } = require('../lib/retention');
const now = Date.parse('2026-10-04T12:00:00Z');
test('quota reservations are atomic under concurrency and failed reservations do not increment counters', async () => {
  const db = new MemoryDb();
  const outcomes = await Promise.allSettled(Array.from({ length: 40 }, () => reserveQuota(db, 'alice', false, now)));
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, LIMITS.aiMinute);
  assert.equal(db.data.get('aiQuota/alice').ai.daily, 3); assert.equal(db.data.get('serviceQuota/ai').daily, 3);
  await reserveQuota(db, 'alice', true, now);
  assert.equal(db.data.get('aiQuota/alice').report.daily, 1); assert.equal(db.data.get('aiQuota/alice').ai.daily, 3);
  await reserveQuota(db, 'alice', false, now + 60000);
  assert.equal(db.data.get('aiQuota/alice').ai.daily, 4); assert.equal(db.data.get('aiQuota/alice').ai.perMinute, 1);
  await reserveQuota(db, 'alice', false, now + 86400000);
  assert.equal(db.data.get('aiQuota/alice').ai.daily, 1);
});
test('global and per-user daily ceilings and deletion lock fail closed', async () => {
  const day = new Date(now).toISOString().slice(0, 10), minute = Math.floor(now / 60000);
  for (const [seed, code] of [
    [{ 'serviceQuota/ai': { day, daily: 500, minute, perMinute: 0 } }, 'quota/service-limit'],
    [{ 'serviceQuota/ai': { day, daily: 0, minute, perMinute: 30 } }, 'quota/service-limit'],
    [{ 'aiQuota/alice': { ai: { day, daily: 20, minute, perMinute: 0 } } }, 'quota/exceeded'],
    [{ 'deletionJobs/alice': { status: 'complete' } }, 'account/deleting'],
  ]) await assert.rejects(reserveQuota(new MemoryDb(seed), 'alice', false, now), e => e.code === code);
});
test('deletion drains more than a batch and all storage prefixes without touching another owner', async () => {
  const seed = { 'users/alice': { uid: 'alice' }, 'users/bob': { uid: 'bob' } };
  for (const collection of COLLECTIONS) {
    for (let i = 0; i < (collection === 'transactions' ? 805 : 1); i++) seed[`${collection}/alice-${i}`] = { userId: 'alice' };
    seed[`${collection}/bob`] = { userId: 'bob' };
  }
  const db = new MemoryDb(seed), bucket = fakeBucket([...Array.from({ length: 205 }, (_, i) => `users/alice/${i}`), 'profiles/alice/old.jpg', 'profileImages/alice/old.jpg', 'users/bob/profile.jpg']);
  await startDeletion(db, { uid: 'alice', auth_time: now / 1000 }, now);
  const authCalls = [], auth = { deleteUser: async uid => authCalls.push(uid) };
  let complete = false;
  for (let i = 0; i < 4 && !complete; i++) complete = await runDeletion({ db, auth, bucket, uid: 'alice', now: () => now });
  assert.equal(complete, true); assert.deepEqual(authCalls, ['alice']);
  assert.ok(db.batchSizes.includes(400)); assert.ok(db.batchSizes.every(n => n <= 400));
  for (const collection of COLLECTIONS) {
    assert.equal((await db.collection(collection).where('userId', '==', 'alice').get()).size, 0);
    assert.equal(db.data.get(`${collection}/bob`).userId, 'bob');
  }
  assert.equal(db.data.has('users/alice'), false); assert.equal(db.data.has('users/bob'), true);
  assert.deepEqual([...bucket.files], ['users/bob/profile.jpg']);
  assert.ok(bucket.calls.every(call => call.autoPaginate === false && call.maxResults === 100));
  assert.equal(db.data.get('deletionJobs/alice').expiresAt, now + RETENTION.deletionMs);
  assert.equal(await runDeletion({ db, auth, bucket, uid: 'alice', now: () => now }), true); assert.equal(authCalls.length, 1);
});
test('partial Firestore failure retains generic retry state and write lock then resumes', async () => {
  const db = new MemoryDb(Object.fromEntries(Array.from({ length: 801 }, (_, i) => [`transactions/${i}`, { userId: 'alice' }])));
  await startDeletion(db, { uid: 'alice', auth_time: now / 1000 }, now);
  let batches = 0;
  db.failCommit = async () => { if (++batches === 2) throw new Error('PRIVATE db payload'); };
  const options = { db, auth: { deleteUser: async () => {} }, bucket: fakeBucket(), uid: 'alice', now: () => now };
  assert.equal(await runDeletion(options), false);
  assert.equal((await db.collection('transactions').get()).size, 401);
  assert.equal(db.data.get('deletionJobs/alice').lastError, 'retry-required');
  assert.ok(!JSON.stringify(db.data.get('deletionJobs/alice')).includes('PRIVATE'));
  await assert.rejects(reserveQuota(db, 'alice', false, now), e => e.code === 'account/deleting');
  db.failCommit = null;
  assert.equal(await runDeletion(options), true);
});
test('storage partial failure preserves profile/Auth until retry and auth-not-found is idempotent', async () => {
  const db = new MemoryDb({ 'users/alice': { uid: 'alice' } }), bucket = fakeBucket(['users/alice/a.jpg', 'profiles/alice/b.jpg']);
  bucket.failName = 'profiles/alice/b.jpg'; let calls = 0;
  const options = { db, bucket, uid: 'alice', now: () => now, auth: { deleteUser: async () => { calls++; throw Object.assign(new Error('gone'), { code: 'auth/user-not-found' }); } } };
  await startDeletion(db, { uid: 'alice', auth_time: now / 1000 }, now);
  assert.equal(await runDeletion(options), false); assert.equal(calls, 0); assert.equal(db.data.has('users/alice'), true);
  bucket.failName = null;
  assert.equal(await runDeletion(options), true); assert.equal(calls, 1); assert.equal(bucket.files.size, 0);
});
test('durable jobs enforce recent auth even on retry and honor active leases and work budget', async () => {
  const db = new MemoryDb();
  await startDeletion(db, { uid: 'alice', auth_time: now / 1000 }, now);
  await assert.rejects(startDeletion(db, { uid: 'alice', auth_time: now / 1000 - 301 }, now), e => e.code === 'auth/requires-recent-login');
  const options = { db, uid: 'alice', now: () => now, bucket: fakeBucket(), auth: { deleteUser: async () => {} } };
  assert.equal(await runDeletion({ ...options, budgetMs: 0 }), false);
  assert.equal(db.data.get('deletionJobs/alice').status, 'pending');
  db.data.get('deletionJobs/alice').leaseUntil = now + 90000;
  assert.equal(await runDeletion(options), false);
  db.data.get('deletionJobs/alice').leaseUntil = now - 1;
  assert.equal(await runDeletion(options), true);
});
test('retention expires receipts, reports (including legacy), completed jobs and quota metadata in bounded pages', async () => {
  const seed = {
    'aiReports/legacy-expired': { createdAt: now - RETENTION.reportMs },
    'aiReports/legacy-current': { createdAt: now - 100 },
    'aiReports/expired': { expiresAt: now - 1 },
    'deletionJobs/complete': { status: 'complete', expiresAt: now },
    'deletionJobs/pending': { status: 'pending', updatedAt: 1 },
    'aiQuota/expired': { expiresAt: now }, 'aiQuota/current': { expiresAt: now + 1 },
    'serviceQuota/ai': { expiresAt: now },
  };
  for (let i = 0; i < 805; i++) seed[`aiResponses/${i}`] = { expiresAt: now - 1 };
  const db = new MemoryDb(seed);
  assert.equal(await cleanExpiredData(db, now), 810);
  assert.deepEqual([...db.data.keys()].sort(), ['aiQuota/current', 'aiReports/legacy-current', 'deletionJobs/pending']);
  assert.equal(await cleanExpiredData(db, now), 0);
});
test('retention cannot remove a quota renewed after its expiry query', async () => {
  const db = new MemoryDb({ 'aiQuota/alice': { userId: 'alice', expiresAt: now - 1 } });
  const transaction = db.runTransaction.bind(db);
  db.runTransaction = callback => {
    db.data.get('aiQuota/alice').expiresAt = now + RETENTION.quotaMs;
    return transaction(callback);
  };
  assert.equal(await cleanExpiredData(db, now), 0);
  assert.equal(db.data.get('aiQuota/alice').expiresAt, now + RETENTION.quotaMs);
});
test('large deletion resumes after the bounded per-invocation batch ceiling', async () => {
  const db = new MemoryDb(Object.fromEntries(Array.from({ length: 6001 }, (_, i) => [`transactions/${i}`, { userId: 'alice' }])));
  await startDeletion(db, { uid: 'alice', auth_time: now / 1000 }, now);
  let deletedAuth = 0;
  const options = { db, uid: 'alice', bucket: fakeBucket(), now: () => now, auth: { deleteUser: async () => { deletedAuth++; } } };
  assert.equal(await runDeletion(options), false); assert.equal(deletedAuth, 0);
  assert.equal(db.data.get('deletionJobs/alice').status, 'pending');
  assert.equal((await db.collection('transactions').get()).size, 1);
  assert.equal(await runDeletion(options), true); assert.equal(deletedAuth, 1);
});
