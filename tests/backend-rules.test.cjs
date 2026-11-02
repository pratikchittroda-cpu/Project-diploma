'use strict';
// This suite refuses to use a real project or non-loopback backend.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
process.env.METADATA_SERVER_DETECTION = 'none';
const fromFunctions = createRequire(path.join(__dirname, '../functions/package.json'));
const { initializeTestEnvironment, assertSucceeds, assertFails } = fromFunctions('@firebase/rules-unit-testing');
const { doc, collection, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc, deleteField, runTransaction, writeBatch, setLogLevel, serverTimestamp } = fromFunctions('firebase/firestore');
const { ref, uploadBytes, getMetadata, deleteObject, listAll } = fromFunctions('firebase/storage');
const { initializeApp, deleteApp } = fromFunctions('firebase-admin/app');
const { getFirestore } = fromFunctions('firebase-admin/firestore');
const { getStorage } = fromFunctions('firebase-admin/storage');
const { reserveQuota, LIMITS } = require('../functions/lib/quota');
const { createMockUserToken } = fromFunctions('@firebase/util');
const { createScope: hostedScope } = require('../ai-host/src/server/runtime.cjs');
const { createFirestoreClient } = require('../ai-host/src/server/firestore.cjs');
const { reserveUsage: reserveHostedUsage } = require('../ai-host/src/server/quota.cjs');
const { startDeletion, runDeletion } = require('../functions/lib/deletion');
const PROJECT = 'demo-expenzo';
for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[name] || '')) throw new Error(`Refusing tests without loopback ${name}`);
}
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT) throw new Error('Refusing non-demo project');
let env, adminApp, admin;
const stamp = '2026-10-04T12:00:00.000Z';
const profile = (uid, userType = 'personal', extra = {}) => ({ uid, email: `${uid}@example.test`, fullName: `${uid} Test`, userType, provider: 'password', profileComplete: true, createdAt: stamp, updatedAt: stamp, ...extra });
const transaction = (uid, extra = {}) => ({ userId: uid, type: 'expense', amount: 12.34, category: 'food', description: 'Lunch', date: '2026-10-04', createdAt: stamp, updatedAt: stamp, ...extra });
const budget = (uid, extra = {}) => ({ userId: uid, category: 'food', period: 'Monthly', amount: 100, type: 'personal', name: 'Food', archived: false, createdAt: stamp, updatedAt: stamp, ...extra });
const member = (uid, extra = {}) => ({ userId: uid, name: 'Member', email: '', role: 'Engineer', salary: 120000.12, department: 'General', status: 'active', joinDate: '2026-02-28', avatar: 'account', color: '#667eea', createdAt: stamp, updatedAt: stamp, ...extra });
const team = (uid, extra = {}) => ({ userId: uid, name: 'Engineering', budget: 1000, color: '#667eea', icon: 'office-building', createdAt: stamp, updatedAt: stamp, ...extra });
const context = uid => env.authenticatedContext(uid, { email: `${uid}@example.test` });
const seed = async records => env.withSecurityRulesDisabled(async c => {
  const db = c.firestore();
  for (let offset = 0; offset < records.length; offset += 400) {
    const batch = writeBatch(db);
    records.slice(offset, offset + 400).forEach(([key, value]) => batch.set(doc(db, key), value));
    await batch.commit();
  }
});
before(async () => {
  setLogLevel('silent');
  env = await initializeTestEnvironment({ projectId: PROJECT,
    firestore: { rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8') },
    storage: { rules: fs.readFileSync(path.join(__dirname, '../storage.rules'), 'utf8') },
  });
  adminApp = initializeApp({ projectId: PROJECT, storageBucket: PROJECT }, 'backend-rules-demo-only');
  admin = getFirestore(adminApp);
});
beforeEach(async () => {
  await env.clearStorage(); await env.clearFirestore();
  await seed([['users/alice', profile('alice')], ['users/bob', profile('bob')], ['users/company', profile('company', 'company')]]);
});
after(async () => { if (adminApp) await deleteApp(adminApp); if (env) await env.cleanup(); });

test('profiles: only owner reads, auth email create, immutable identity, strict schema and no client delete', async () => {
  const alice = context('alice').firestore(), guest = env.unauthenticatedContext().firestore(), charlie = context('charlie').firestore();
  await assertSucceeds(getDoc(doc(alice, 'users/alice')));
  await assertFails(getDoc(doc(alice, 'users/bob'))); await assertFails(getDoc(doc(guest, 'users/alice')));
  await assertFails(getDocs(collection(alice, 'users')));
  await assertFails(setDoc(doc(charlie, 'users/charlie'), profile('charlie', 'personal', { email: 'other@example.test' })));
  await assertSucceeds(setDoc(doc(charlie, 'users/charlie'), profile('charlie')));
  await assertSucceeds(updateDoc(doc(alice, 'users/alice'), { fullName: 'New Name', updatedAt: stamp }));
  for (const change of [{ uid: 'bob' }, { email: 'bob@example.test' }, { userType: 'company' }, { provider: 'google' }, { createdAt: '2026-01-01T00:00:00.000Z' }, { admin: true }, { fullName: '' }, { updatedAt: '2026-02-30T00:00:00.000Z' }]) await assertFails(updateDoc(doc(alice, 'users/alice'), change));
  await assertFails(deleteDoc(doc(alice, 'users/alice')));
});
test('an incomplete legacy profile can be completed in a transaction without changing its identity', async () => {
  await seed([['users/legacy', profile('legacy', 'personal', { profileComplete: false })]]);
  const db = context('legacy').firestore();
  await assertSucceeds(runTransaction(db, async tx => {
    const target = doc(db, 'users/legacy');
    const existing = await tx.get(target);
    assert.equal(existing.data().profileComplete, false);
    tx.update(target, { fullName: 'Repaired Legacy', profileComplete: true, updatedAt: stamp });
  }));
  const repaired = await getDoc(doc(db, 'users/legacy'));
  assert.equal(repaired.data().profileComplete, true);
  assert.equal(repaired.data().fullName, 'Repaired Legacy');
  assert.equal(repaired.data().uid, 'legacy');
  assert.equal(repaired.data().userType, 'personal');
});
test('incomplete profile repair may replace the document to remove obsolete fields while preserving protected legacy data', async () => {
  await seed([['users/legacy', profile('legacy', 'personal', { profileComplete: false, preferences: { currency: 'INR' }, obsoleteField: true })]]);
  const db = context('legacy').firestore(), target = doc(db, 'users/legacy');
  await assertSucceeds(runTransaction(db, async tx => {
    const existing = await tx.get(target);
    const repaired = { ...existing.data(), fullName: 'Repaired Legacy', profileComplete: true, updatedAt: stamp };
    delete repaired.obsoleteField;
    tx.set(target, repaired);
  }));
  const repaired = await getDoc(target);
  assert.equal(repaired.data().profileComplete, true);
  assert.equal(repaired.data().obsoleteField, undefined);
  assert.deepEqual(repaired.data().preferences, { currency: 'INR' });
});
test('incomplete email profiles without the optional provider field can still be repaired', async () => {
  const legacy = profile('legacy', 'personal', { profileComplete: false });
  delete legacy.provider;
  await seed([['users/legacy', legacy]]);
  const db = context('legacy').firestore(), target = doc(db, 'users/legacy');
  await assertSucceeds(runTransaction(db, async tx => {
    const existing = await tx.get(target);
    tx.set(target, { ...existing.data(), fullName: 'Repaired Legacy', profileComplete: true, updatedAt: stamp });
  }));
  assert.equal((await getDoc(target)).data().profileComplete, true);
});
test('legacy profile fields remain readable and unchanged during edits but cannot be added, mutated or removed', async () => {
  const legacy = { employeeCount: 5, activeProjects: 2, monthlyBudget: 999, budgets: { food: 50 }, preferences: { currency: 'INR', theme: 'dark' } };
  await seed([['users/company', profile('company', 'company', legacy)]]);
  const db = context('company').firestore(), target = doc(db, 'users/company');
  await assertSucceeds(updateDoc(target, { companyName: 'Updated Company', fullName: 'New Contact', updatedAt: stamp }));
  const saved = (await getDoc(target)).data();
  for (const [key, value] of Object.entries(legacy)) {
    assert.deepEqual(saved[key], value);
    await assertFails(updateDoc(target, { [key]: null }));
    await assertFails(updateDoc(target, { [key]: deleteField() }));
    await assertFails(updateDoc(doc(context('alice').firestore(), 'users/alice'), { [key]: value }));
    await assertFails(setDoc(doc(context('new').firestore(), 'users/new'), profile('new', 'personal', { [key]: value })));
  }
  await assertFails(updateDoc(target, { 'preferences.theme': 'light' }));
});
test('missing deterministic budget/salary gets succeed only signed-in; existing cross-owner docs and broad queries remain denied', async () => {
  const db = context('alice').firestore(), guest = env.unauthenticatedContext().firestore();
  for (const collectionName of ['transactions', 'budgets']) {
    await assertSucceeds(getDoc(doc(db, `${collectionName}/missing`)));
    await assertFails(getDoc(doc(guest, `${collectionName}/missing`)));
  }
  await seed([['transactions/bob', transaction('bob')], ['budgets/bob', budget('bob')], ['transactions/alice', transaction('alice')]]);
  await assertFails(getDoc(doc(db, 'transactions/bob'))); await assertFails(getDoc(doc(db, 'budgets/bob')));
  await assertFails(getDocs(collection(db, 'transactions'))); await assertFails(getDocs(collection(db, 'budgets')));
  await assertFails(getDocs(query(collection(db, 'transactions'), where('userId', '==', 'bob'))));
  const owned = await assertSucceeds(getDocs(query(collection(db, 'transactions'), where('userId', '==', 'alice'))));
  assert.equal(owned.size, 1);
});
test('budget service three-period transaction creates, updates and archives missing canonical targets atomically', async () => {
  const db = context('alice').firestore(), periods = ['Weekly', 'Monthly', 'Yearly'];
  const targets = periods.map(period => doc(db, `budgets/budget_alice_food_${period}`));
  await assertSucceeds(runTransaction(db, async tx => {
    const existing = await Promise.all(targets.map(target => tx.get(target)));
    assert.ok(existing.every(row => !row.exists()));
    targets.forEach((target, i) => tx.set(target, budget('alice', { period: periods[i] })));
  }));
  await assertSucceeds(runTransaction(db, async tx => {
    await Promise.all(targets.map(target => tx.get(target)));
    targets.forEach(target => tx.update(target, { archived: true }));
  }));
  for (const target of targets) assert.equal((await getDoc(target)).data().archived, true);
});
test('salary transaction supports idempotent missing target read and company scope, never another account', async () => {
  await seed([['members/m1', member('company')]]);
  const db = context('company').firestore(), salary = doc(db, 'transactions/salary_company_m1_2026-10');
  const create = () => runTransaction(db, async tx => {
    const [existing, person] = await Promise.all([tx.get(salary), tx.get(doc(db, 'members/m1'))]);
    if (existing.exists()) return false;
    assert.equal(person.data().userId, 'company');
    tx.set(salary, transaction('company', { amount: 10000.01, category: 'salaries', companyId: 'company', userType: 'company', autoGenerated: true, memberId: 'm1', salaryMonth: '2026-10' })); return true;
  });
  assert.equal(await assertSucceeds(create()), true); assert.equal(await assertSucceeds(create()), false);
  await assertFails(getDoc(doc(context('alice').firestore(), salary.path)));
  await assertFails(setDoc(doc(context('alice').firestore(), 'transactions/fake-salary'), transaction('alice', { category: 'salaries', companyId: 'company', userType: 'company', autoGenerated: true })));
});
test('transactions constrain money, real calendar dates, type/category and immutable ownership/generated metadata', async () => {
  const db = context('alice').firestore(), target = doc(db, 'transactions/own');
  await assertSucceeds(setDoc(target, transaction('alice', { date: '2024-02-29', amount: 0.29 })));
  for (const amount of [0, -1, 1.001, 1.000000001, 1000000000.01, '12', NaN, Infinity]) await assertFails(updateDoc(target, { amount }));
  for (const date of ['2025-02-29', '2026-04-31', '1899-12-31', '2026-00-10', '2026-13-10', '2026-01-00', '2026-1-01', '2026-01-01T12:00:00Z', 'nonsense']) await assertFails(updateDoc(target, { date }));
  for (const change of [{ userId: 'bob' }, { type: 'income' }, { category: 'salary' }, { userType: 'company' }, { companyId: 'bob' }, { autoGenerated: true }, { memberId: 'm1' }, { salaryMonth: '2026-10' }, { description: '' }, { description: 'x'.repeat(501) }, { note: 'x'.repeat(1001) }, { surprise: true }, { updatedAt: '2026-10-04T99:00:00.000Z' }]) await assertFails(updateDoc(target, change));
  await assertFails(updateDoc(target, { description: '  \t\n' }));
  await assertSucceeds(updateDoc(target, { amount: 1000000000, date: '2026-10-04' }));
  await assertFails(setDoc(doc(db, 'transactions/victim'), transaction('bob')));
  await assertFails(deleteDoc(doc(context('bob').firestore(), target.path)));
  await assertSucceeds(deleteDoc(target));
});
test('budget, team and member fields match service writes and enforce owner/company boundaries', async () => {
  const personal = context('alice').firestore(), company = context('company').firestore();
  await assertSucceeds(setDoc(doc(personal, 'budgets/own'), budget('alice')));
  for (const change of [{ amount: 0 }, { amount: 1.005 }, { period: 'daily' }, { category: 'salary' }, { type: 'company' }, { userId: 'bob' }, { archived: 'true' }]) await assertFails(updateDoc(doc(personal, 'budgets/own'), change));
  await assertFails(setDoc(doc(personal, 'teams/own'), team('alice')));
  await assertFails(setDoc(doc(personal, 'members/own'), member('alice')));
  await assertSucceeds(setDoc(doc(company, 'teams/own'), team('company')));
  await assertSucceeds(setDoc(doc(company, 'members/own'), member('company')));
  for (const change of [{ salary: 0 }, { salary: 0.001 }, { status: 'removed' }, { joinDate: '2025-02-29' }, { userId: 'alice' }, { name: '' }, { role: ' ' }, { department: '' }, { name: 'x'.repeat(101) }]) await assertFails(updateDoc(doc(company, 'members/own'), change));
  await assertFails(getDoc(doc(personal, 'members/own')));
  await assertFails(getDocs(collection(company, 'members')));
  await assertSucceeds(getDocs(query(collection(company, 'members'), where('userId', '==', 'company'))));
  await assertSucceeds(updateDoc(doc(company, 'members/own'), { salary: 100.25, status: 'inactive' }));
});
test('deletion lock blocks every client write including profile creation; internal collections deny all client access', async () => {
  await seed([['transactions/t', transaction('company')], ['budgets/b', budget('company', { type: 'company' })], ['teams/t', team('company')], ['members/m', member('company')], ['deletionJobs/company', { status: 'pending' }], ['deletionJobs/new', { status: 'pending' }]]);
  const db = context('company').firestore();
  for (const key of ['users/company', 'transactions/t', 'budgets/b', 'teams/t', 'members/m']) {
    await assertFails(updateDoc(doc(db, key), { updatedAt: stamp })); await assertFails(deleteDoc(doc(db, key)));
  }
  await assertFails(setDoc(doc(db, 'transactions/new'), transaction('company')));
  await assertFails(setDoc(doc(db, 'budgets/new'), budget('company')));
  await assertFails(setDoc(doc(db, 'teams/new'), team('company')));
  await assertFails(setDoc(doc(db, 'members/new'), member('company')));
  await assertFails(setDoc(doc(context('new').firestore(), 'users/new'), profile('new')));
  for (const name of ['aiResponses', 'aiReports', 'reports', 'aiQuota', 'serviceQuota', 'deletionJobs', 'unknown']) {
    await assertFails(getDoc(doc(db, `${name}/company`)));
    await assertFails(setDoc(doc(db, `${name}/company`), { userId: 'company' }));
    await assertFails(deleteDoc(doc(db, `${name}/company`)));
  }
  await assertFails(setDoc(doc(db, 'users/company/private/x'), { value: 1 }));
});
const utcDay = () => new Date().toISOString().slice(0, 10);
function hostedReservation(db, uid, count, globalCount, day = utcDay(), extras = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, `aiUsage/${uid}/days/${day}`), { count, updatedAt: serverTimestamp(), ...extras });
  batch.set(doc(db, `globalAIUsage/${day}`), { count: globalCount, updatedAt: serverTimestamp() });
  return batch.commit();
}
test('hosted AI counters require paired increments and enforce owner isolation, exact schemas, UTC day and no reset/delete', async () => {
  const db = context('alice').firestore(), day = utcDay();
  const own = doc(db, `aiUsage/alice/days/${day}`), global = doc(db, `globalAIUsage/${day}`);
  await assertFails(setDoc(own, { count: 1, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(global, { count: 1, updatedAt: serverTimestamp() }));
  await assertSucceeds(hostedReservation(db, 'alice', 1, 1));
  await assertSucceeds(hostedReservation(db, 'alice', 2, 2));
  assert.equal((await getDoc(own)).data().count, 2);
  await assertFails(hostedReservation(db, 'alice', 1, 3));
  await assertFails(hostedReservation(db, 'alice', 4, 3));
  await assertFails(hostedReservation(db, 'alice', 3, 3, day, { privateText: 'not allowed' }));
  await assertFails(hostedReservation(db, 'alice', 3, 3, '2000-01-01'));
  await assertFails(hostedReservation(context('bob').firestore(), 'alice', 3, 3));
  await assertFails(getDoc(doc(context('bob').firestore(), own.path)));
  await assertFails(getDocs(collection(db, 'aiUsage/alice/days')));
  await assertFails(deleteDoc(own)); await assertFails(deleteDoc(global));
  await assertFails(hostedReservation(env.unauthenticatedContext().firestore(), 'alice', 3, 3));
  assert.equal((await getDoc(global)).data().count, 2);
});
test('hosted AI caps, immutable server timestamps and deletion locks deny usage before a provider call', async () => {
  const db = context('alice').firestore(), day = utcDay(), now = new Date();
  await seed([[`aiUsage/alice/days/${day}`, { count: 19, updatedAt: now }], [`globalAIUsage/${day}`, { count: 199, updatedAt: now }]]);
  await assertSucceeds(hostedReservation(db, 'alice', 20, 200));
  await assertFails(hostedReservation(db, 'alice', 21, 201));
  await assertFails(hostedReservation(context('bob').firestore(), 'bob', 1, 201));
  assert.equal((await getDoc(doc(db, `globalAIUsage/${day}`))).data().count, 200);
  await seed([[`aiUsage/alice/days/${day}`, { count: 1, updatedAt: now }], [`globalAIUsage/${day}`, { count: 1, updatedAt: now }]]);
  const oldStamp = writeBatch(db);
  oldStamp.set(doc(db, `aiUsage/alice/days/${day}`), { count: 2, updatedAt: new Date('2000-01-01') });
  oldStamp.set(doc(db, `globalAIUsage/${day}`), { count: 2, updatedAt: serverTimestamp() });
  await assertFails(oldStamp.commit());
  await seed([['deletionJobs/alice', { status: 'pending' }]]);
  await assertFails(hostedReservation(db, 'alice', 2, 2));
});
test('the actual hosted REST adapter reads and atomically reserves rule-bound counters without server transaction RPCs', async () => {
  const scope = hostedScope(undefined), operations = [];
  const token = createMockUserToken({ sub: 'alice', email: 'alice@example.test' }, PROJECT);
  const fetchImpl = async (url, init) => {
    const target = new URL(url);
    assert.equal(target.origin, 'https://firestore.googleapis.com');
    assert.ok(target.pathname.startsWith(`/v1/projects/${PROJECT}/databases/(default)/documents`));
    assert.equal(init.redirect, 'manual');
    operations.push(target.pathname.split('/').pop());
    return fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}${target.pathname}`, init);
  };
  const db = createFirestoreClient({ projectId: PROJECT, token, uid: 'alice', fetchImpl, scope });
  try {
    assert.equal((await db.profile()).uid, 'alice');
    const empty = await db.collection('transactions').where('userId', '==', 'alice').limit(5001).get();
    assert.equal(empty.size, 0);
    await reserveHostedUsage(db, 'alice', Date.now, scope);
    await reserveHostedUsage(db, 'alice', Date.now, scope);
    const sdk = context('alice').firestore(), day = utcDay();
    assert.equal((await getDoc(doc(sdk, `aiUsage/alice/days/${day}`))).data().count, 2);
    assert.equal((await getDoc(doc(sdk, `globalAIUsage/${day}`))).data().count, 2);
    assert.ok(operations.every(operation => !operation.includes('beginTransaction') && !operation.includes('rollback')));
    await seed([[`aiUsage/alice/days/${day}`, { count: 19, updatedAt: new Date() }], [`globalAIUsage/${day}`, { count: 199, updatedAt: new Date() }]]);
    await reserveHostedUsage(db, 'alice', Date.now, scope);
    await assert.rejects(reserveHostedUsage(db, 'alice', Date.now, scope), error => error.code === 'quota/exceeded');
    assert.equal((await getDoc(doc(sdk, `aiUsage/alice/days/${day}`))).data().count, 20);
    assert.equal((await getDoc(doc(sdk, `globalAIUsage/${day}`))).data().count, 200);
  } finally { scope.close(); }
});
test('Storage isolates owners and validates exact upload path, content type and size', async () => {
  const alice = context('alice').storage(), bob = context('bob').storage(), guest = env.unauthenticatedContext().storage();
  const object = ref(alice, 'users/alice/profile.jpg'), bytes = new Uint8Array([1, 2, 3]);
  await assertSucceeds(uploadBytes(object, bytes, { contentType: 'image/jpeg' }));
  assert.equal((await assertSucceeds(getMetadata(object))).size, 3);
  await assertFails(getMetadata(ref(bob, object.fullPath))); await assertFails(getMetadata(ref(guest, object.fullPath)));
  await assertFails(uploadBytes(ref(bob, object.fullPath), bytes, { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(guest, object.fullPath), bytes, { contentType: 'image/jpeg' }));
  for (const name of ['users/alice/arbitrary.jpg', 'users/alice/nested/profile.jpg', 'profiles/alice/profile.jpg', 'users/bob/profile.jpg']) await assertFails(uploadBytes(ref(alice, name), bytes, { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(object, bytes, { contentType: 'application/javascript' }));
  await assertFails(uploadBytes(object, new Uint8Array(5 * 1024 * 1024), { contentType: 'image/jpeg' }));
  await assertFails(listAll(ref(alice, 'users')));
  await assertSucceeds(uploadBytes(ref(alice, 'users/alice/profile.webp'), bytes, { contentType: 'image/webp' }));
  await assertFails(deleteObject(ref(bob, object.fullPath)));
  await assertSucceeds(deleteObject(object));
});
test('Storage deletion lock prevents uploads, replacements and deletes', async () => {
  const storage = context('alice').storage(), object = ref(storage, 'users/alice/profile.png');
  await assertSucceeds(uploadBytes(object, new Uint8Array([1]), { contentType: 'image/png' }));
  await seed([['deletionJobs/alice', { status: 'pending' }]]);
  await assertFails(uploadBytes(object, new Uint8Array([2]), { contentType: 'image/png' }));
  await assertFails(uploadBytes(ref(storage, 'users/alice/profile.jpg'), new Uint8Array([2]), { contentType: 'image/jpeg' }));
  await assertFails(deleteObject(object));
});
test('real Firestore transactions atomically enforce user and global quota concurrency', async () => {
  const now = Date.parse(stamp);
  const outcomes = await Promise.allSettled(Array.from({ length: 12 }, () => reserveQuota(admin, 'alice', false, now)));
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, LIMITS.aiMinute);
  assert.ok(outcomes.filter(r => r.status === 'rejected').every(r => r.reason.code === 'quota/exceeded'));
  assert.equal((await admin.doc('aiQuota/alice').get()).data().ai.daily, 3);
  await admin.doc('serviceQuota/ai').set({ day: stamp.slice(0, 10), minute: Math.floor(now / 60000), daily: 499, perMinute: 0 });
  const global = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => reserveQuota(admin, `other-${i}`, false, now)));
  assert.equal(global.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(global.filter(r => r.status === 'rejected').every(r => r.reason.code === 'quota/service-limit'));
  assert.equal((await admin.doc('serviceQuota/ai').get()).data().daily, 500);
});
test('real emulator deletion drains 805 documents and profile storage with durable lock and cross-owner isolation', async () => {
  await seed([...Array.from({ length: 805 }, (_, i) => [`transactions/alice-${i}`, transaction('alice')]), ['transactions/bob', transaction('bob')], ['aiReports/r', { userId: 'alice', answer: 'test' }]]);
  await uploadBytes(ref(context('alice').storage(), 'users/alice/profile.jpg'), new Uint8Array([1]), { contentType: 'image/jpeg' });
  await uploadBytes(ref(context('bob').storage(), 'users/bob/profile.jpg'), new Uint8Array([2]), { contentType: 'image/jpeg' });
  const now = Date.parse(stamp); await startDeletion(admin, { uid: 'alice', auth_time: now / 1000 }, now);
  await assertFails(setDoc(doc(context('alice').firestore(), 'transactions/locked'), transaction('alice')));
  let authCalls = 0;
  const complete = await runDeletion({ db: admin, uid: 'alice', bucket: getStorage(adminApp).bucket(), auth: { deleteUser: async uid => { assert.equal(uid, 'alice'); authCalls++; } }, now: () => now });
  assert.equal(complete, true); assert.equal(authCalls, 1);
  assert.equal((await admin.collection('transactions').where('userId', '==', 'alice').get()).size, 0);
  assert.equal((await admin.doc('transactions/bob').get()).exists, true);
  assert.equal((await admin.doc('users/alice').get()).exists, false);
  assert.equal((await admin.doc('deletionJobs/alice').get()).data().status, 'complete');
  assert.equal((await getStorage(adminApp).bucket().getFiles({ prefix: 'users/alice/' }))[0].length, 0);
  assert.equal((await getStorage(adminApp).bucket().getFiles({ prefix: 'users/bob/' }))[0].length, 1);
});
