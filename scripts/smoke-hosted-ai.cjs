// Explicit live verification. Creates only a temporary synthetic account/profile.
// No provider key is needed here; the hosted API owns it. Never print credentials.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { createScope } = require('../ai-host/src/server/runtime.cjs');
const { createFirestoreClient } = require('../ai-host/src/server/firestore.cjs');
const { reserveUsage } = require('../ai-host/src/server/quota.cjs');

if (!process.argv.includes('--live-synthetic-account')) {
  console.error('This creates and removes a live synthetic Firebase account. Run only with --live-synthetic-account after approval.');
  process.exit(1);
}
const root = path.resolve(__dirname, '..');
const fromDotEnv = createRequire(require.resolve('react-native-dotenv/package.json'));
const env = fromDotEnv('dotenv').parse(fs.readFileSync(path.join(root, '.env')));
const project = 'project1-7a465';
if (env.FIREBASE_PROJECT_ID !== project || !env.FIREBASE_API_KEY) throw new Error('Refusing an unverified Firebase project');
const base = 'https://expenzo-ai-pratik2467.expo.app/api';
const firebase = 'https://identitytoolkit.googleapis.com/v1/accounts';
let uid, idToken, profileCreated = false;

async function send(url, body, token) {
  const response = await fetch(url, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(35000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let value;
  try { value = await response.json(); } catch { /* No raw upstream bodies in logs. */ }
  return { status: response.status, ok: response.ok, value };
}
function check(result, phase) {
  if (result.ok) return;
  const code = /^[a-z0-9-]+\/[a-z0-9-]+$/.test(result.value?.code || '') ? ` (${result.value.code})` : '';
  throw new Error(`${phase}: HTTP ${result.status}${code}`);
}

async function diagnoseFirestore() {
  // Rule-bound requests against only the freshly created synthetic account.
  // Emit fixed operation names/statuses, never URLs, identities or bodies.
  const scope = createScope(undefined);
  const operations = new Map([[':runQuery', 'owned-query'], [':beginTransaction', 'begin-usage'],
    [':batchGet', 'read-usage'], [':commit', 'commit-usage'], [':rollback', 'rollback-usage']]);
  const transport = async (url, init) => {
    const operation = operations.get([...operations.keys()].find(suffix => url.endsWith(suffix))) || 'own-profile';
    const response = await fetch(url, init);
    console.log(JSON.stringify({ firestoreDiagnostic: operation, httpStatus: response.status }));
    return response;
  };
  const db = createFirestoreClient({ projectId: project, token: idToken, uid, fetchImpl: transport, scope });
  try {
    await db.profile();
    for (const collection of ['transactions', 'budgets']) await db.collection(collection).where('userId', '==', uid).limit(1).get();
    await reserveUsage(db, uid, Date.now, scope);
    console.log(JSON.stringify({ firestoreDiagnosticPassed: true, syntheticUsageReserved: true }));
  } finally { scope.close(); }
}

async function cleanup() {
  if (!uid) return true;
  let recordsRemoved = true;
  for (const target of [profileCreated ? `users/${uid}` : null, `aiUsage/${uid}`].filter(Boolean)) {
    const result = cp.spawnSync(process.execPath, [
      path.join(root, 'functions/node_modules/firebase-tools/lib/bin/firebase.js'),
      'firestore:delete', target, '--recursive', '--force', '--project', project, '--non-interactive',
    ], { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 35000 });
    if (result.status !== 0) recordsRemoved = false;
  }
  let accountRemoved = false;
  try { accountRemoved = (await send(`${firebase}:delete?key=${env.FIREBASE_API_KEY}`, { idToken })).ok; }
  catch { /* Cleanup failure is reported without authentication material. */ }
  console.log(JSON.stringify({ temporaryRecordsRemoved: recordsRemoved, temporaryAuthAccountRemoved: accountRemoved, globalUsageCounterPreserved: true }));
  return recordsRemoved && accountRemoved;
}

async function main() {
  let passed = false;
  try {
    const email = `eas-ai-smoke-${crypto.randomBytes(10).toString('hex')}@example.test`;
    const password = crypto.randomBytes(24).toString('base64url');
    const created = await send(`${firebase}:signUp?key=${env.FIREBASE_API_KEY}`, { email, password, returnSecureToken: true });
    check(created, 'Create synthetic test account');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(created.value?.localId || '') || created.value.email !== email || !created.value.idToken) throw new Error('Invalid test identity response');
    uid = created.value.localId;
    idToken = created.value.idToken;
    const stamp = new Date().toISOString();
    const profile = { uid, email, fullName: 'Synthetic AI smoke test', userType: 'personal', provider: 'password', profileComplete: true, createdAt: stamp, updatedAt: stamp };
    const fields = Object.fromEntries(Object.entries(profile).map(([name, value]) => [name, typeof value === 'boolean' ? { booleanValue: value } : { stringValue: value }]));
    const saved = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${uid}`, {
      method: 'PATCH', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ fields }),
    });
    if (!saved.ok) { await saved.body?.cancel(); throw new Error(`Create synthetic profile: HTTP ${saved.status}`); }
    await saved.body?.cancel();
    profileCreated = true;
    console.log(JSON.stringify({ temporaryAccountCreated: true, syntheticProfileCreated: true, realFinanceRecordsRead: false }));

    const localIdentity = await send(`${firebase}:lookup?key=${env.FIREBASE_API_KEY}`, { idToken });
    check(localIdentity, 'Hosted verification prerequisite');
    if (localIdentity.value?.users?.[0]?.localId !== uid) throw new Error('Invalid test identity verification');
    console.log(JSON.stringify({ authoritativeGoogleLookupVerifiedLocally: true }));
    if (process.argv.includes('--diagnose-firestore') || process.argv.includes('--firestore-only')) await diagnoseFirestore();
    if (process.argv.includes('--firestore-only')) { passed = true; return; }

    const noConsent = await send(`${base}/financial-chat`, { question: 'Synthetic consent check', consent: false, timeZone: 'Asia/Kolkata' }, idToken);
    if (noConsent.status !== 400 || noConsent.value?.code !== 'ai/consent-required') throw new Error('Consent was not enforced');
    console.log(JSON.stringify({ liveConsentGateVerified: true }));

    const chat = await send(`${base}/financial-chat`, {
      question: 'I have no recorded transactions or saved budgets yet. Give two short practical steps to start tracking INR expenses; do not invent amounts.',
      consent: true, timeZone: 'Asia/Kolkata',
    }, idToken);
    check(chat, 'Hosted financial chat');
    const chatOK = typeof chat.value?.answer === 'string' && chat.value.answer.trim().length > 0 && chat.value.answer.length <= 12000 && chat.value.context?.complete === true && chat.value.context.transactionCount === 0;
    console.log(JSON.stringify({ feature: 'financial-chat', httpStatus: chat.status, verified: chatOK, completeContext: chat.value.context?.complete === true }));
    if (!chatOK) throw new Error('Hosted chat returned an invalid response');

    const category = await send(`${base}/categorize`, { description: 'Synthetic cafe coffee expense', consent: true }, idToken);
    check(category, 'Hosted category suggestion');
    const categoryOK = category.value?.category === 'food' && typeof category.value.confidence === 'number';
    console.log(JSON.stringify({ feature: 'categorize', httpStatus: category.status, verified: categoryOK }));
    if (!categoryOK) throw new Error('Hosted category response was invalid');

    const receipt = await send(`${base}/parse-receipt`, {
      receiptText: 'SYNTHETIC RECEIPT\nItem: Test Notebook\nQuantity: 3\nUnit price: INR 12.35\nLine total: INR 37.05', consent: true,
    }, idToken);
    check(receipt, 'Hosted receipt parsing');
    const receiptOK = receipt.value?.requiresConfirmation === true && Array.isArray(receipt.value.items) && receipt.value.items.length === 1 && receipt.value.items[0].quantity === 3 && receipt.value.items[0].price === 12.35;
    console.log(JSON.stringify({ feature: 'parse-receipt', httpStatus: receipt.status, verified: receiptOK }));
    if (!receiptOK) throw new Error('Hosted receipt response was invalid');
    passed = true;
  } catch (error) {
    // Only our phase/status messages are public. No body, email, UID or token.
    const safe = /^(?:Hosted |Create synthetic |Consent |Invalid test )/.test(error.message);
    console.log(JSON.stringify({ liveSmokePassed: false, reason: safe ? error.message : 'Transport or runtime verification failed.' }));
  } finally {
    const cleaned = await cleanup();
    console.log(JSON.stringify({ liveSmokePassed: passed, cleanupVerified: cleaned }));
    if (!passed || !cleaned) process.exitCode = 1;
  }
}
main();
