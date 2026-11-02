const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { handleAIRequest, healthResponse } = require('../ai-host/src/server/handler.cjs');
const { decodeFields } = require('../ai-host/src/server/firestore.cjs');

const NOW = Date.parse('2026-10-06T12:00:00.000Z');
const stamp = new Date(NOW).toISOString();
const project = 'demo-expenzo', uid = 'fixture-owner';
const name = `projects/${project}/databases/(default)/documents`;
const env = { FIREBASE_PROJECT_ID: project, FIREBASE_API_KEY: 'synthetic-public-key', NVIDIA_API_KEY: 'synthetic-provider-key', AI_ENABLED: 'true' };
const claims = () => ({ sub: uid, user_id: uid, aud: project, iss: `https://securetoken.google.com/${project}`,
  iat: NOW / 1000 - 60, auth_time: NOW / 1000 - 120, exp: NOW / 1000 + 3600 });
const token = changes => [Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url'),
  Buffer.from(JSON.stringify({ ...claims(), ...changes })).toString('base64url'), 'synthetic-signature'].join('.');
const fields = record => Object.fromEntries(Object.entries(record).map(([key, value]) => [key,
  typeof value === 'boolean' ? { booleanValue: value } : typeof value === 'number' ? { doubleValue: value } : { stringValue: value }]));
const doc = (path, record) => ({ name: `${name}/${path}`, fields: fields(record), createTime: stamp, updateTime: stamp });
const ledgerRow = extra => ({ userId: uid, type: 'expense', category: 'food', amount: 10.075,
  date: '2026-10-06', description: 'Private ledger text must not go to NVIDIA', ...extra });
const usage = (path, count) => count ? { found: { name: `${name}/${path}`, fields: {
  count: { integerValue: String(count) }, updatedAt: { timestampValue: stamp } }, updateTime: stamp } } : { missing: `${name}/${path}`, readTime: stamp };

function harness(options = {}) {
  const requests = [], providers = [];
  let commits = 0;
  const fetchImpl = async (url, init) => {
    assert.equal(init.redirect, 'manual');
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url, init, body });
    if (options.fetch) { const override = await options.fetch(url, init, body); if (override) return override; }
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) return Response.json(options.lookup ?? { users: [{ localId: uid, validSince: '0' }] });
    assert.equal(init.headers.Authorization, `Bearer ${token(options.claims)}`);
    if (url.endsWith(`/users/${uid}`)) return Response.json(doc(`users/${uid}`, options.profile ?? { uid, userType: 'personal', profileComplete: true }));
    if (url.endsWith(':runQuery')) {
      const query = body.structuredQuery;
      assert.deepEqual(query.where.fieldFilter, { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } });
      const transactions = query.from[0].collectionId === 'transactions';
      assert.equal(query.limit, transactions ? 5001 : 201);
      const rows = transactions ? options.transactions ?? [ledgerRow()] : options.budgets ?? [];
      return Response.json(rows.map((row, i) => ({ document: doc(`${transactions ? 'transactions' : 'budgets'}/${row.id || `fixture-${i}`}`, row), readTime: stamp })));
    }
    if (url.endsWith(':batchGet')) {
      assert.equal(body.transaction, undefined);
      return Response.json([
        usage(`globalAIUsage/2026-10-06`, options.globalCount || 0), usage(`aiUsage/${uid}/days/2026-10-06`, options.userCount || 0),
      ]);
    }
    if (url.endsWith(':commit')) {
      commits++;
      assert.equal(body.transaction, undefined);
      assert.equal(body.writes.length, 2);
      for (const write of body.writes) {
        assert.deepEqual(write.updateTransforms, [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }]);
        assert.deepEqual(write.currentDocument, write.update.name.includes('/globalAIUsage/')
          ? options.globalCount ? { updateTime: stamp } : { exists: false }
          : options.userCount ? { updateTime: stamp } : { exists: false });
      }
      if (options.conflict && commits === 1) {
        const code = options.conflict === 'FAILED_PRECONDITION' ? 400 : 409;
        return Response.json({ error: { code, status: typeof options.conflict === 'string' ? options.conflict : 'ABORTED' } }, { status: code });
      }
      if (options.badCommit) return Response.json({ commitTime: stamp });
      return Response.json({ commitTime: stamp, writeResults: [{ updateTime: stamp }, { updateTime: stamp }] });
    }
    throw new Error('Unexpected synthetic upstream route');
  };
  const dependencies = { env: { ...env, ...options.env }, fetchImpl, clock: () => NOW,
    crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' }, timeoutMs: options.timeoutMs,
    provider: async input => { providers.push(input); return options.answer ?? 'Synthetic educational financial response.'; },
  };
  const send = (route = '/financial-chat', payload = { question: 'How can I budget?', consent: true, timeZone: 'Asia/Kolkata' }, requestOptions = {}) =>
    handleAIRequest(new Request(`https://fixture.expo.app/api${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(options.claims)}` },
      body: JSON.stringify(payload), ...requestOptions }), route, dependencies);
  return { send, requests, providers, dependencies, commits: () => commits };
}

test('EAS API verifies identity, reads complete owner finance, reserves usage, and sends only aggregates to the provider', async () => {
  const h = harness({ transactions: Array.from({ length: 31 }, () => ledgerRow()), budgets: [{ id: `budget_${uid}_food_Monthly`, userId: uid, category: 'food', amount: 500, period: 'Monthly' }] });
  const response = await h.send(), result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.context.complete, true);
  assert.equal(result.context.transactionCount, 31);
  assert.equal(result.context.period.start, '2026-10-01');
  assert.equal(result.context.period.end, '2026-10-07');
  assert.equal(result.responseId, '11111111-1111-4111-8111-111111111111');
  assert.equal(h.providers.length, 1);
  assert.equal(h.commits(), 1);
  const sent = JSON.stringify(h.providers[0].messages);
  assert.ok(!sent.includes(uid));
  assert.ok(!sent.includes('Private ledger text'));
  assert.ok(sent.includes('312.48')); // Legacy nearest-paise rounding, not floats.
  assert.ok(sent.includes('500'));
  assert.equal(h.requests.filter(row => row.url.includes('aiResponses')).length, 0);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('EAS categorisation and receipt parsing require explicit consent and never read the full ledger', async () => {
  for (const [route, payload, answer] of [
    ['/categorize', { description: 'Synthetic coffee expense', consent: true }, '{"category":"food","confidence":0.9}'],
    ['/parse-receipt', { receiptText: 'Synthetic item: 2 at INR 12.35 each', consent: true }, '[{"name":"Synthetic item","quantity":2,"price":12.35}]'],
  ]) {
    const h = harness({ answer });
    assert.equal((await h.send(route, payload)).status, 200);
    assert.equal(h.requests.filter(row => row.url.endsWith(':runQuery')).length, 0);
    assert.equal(h.providers.length, 1);
    const rejected = harness({ answer });
    assert.equal((await rejected.send(route, { ...payload, consent: false })).status, 400);
    assert.equal(rejected.requests.length, 0);
  }
});

test('hosted categories match the verified account and legacy owner profiles do not require a migration', async () => {
  const personal = harness({ profile: { userType: 'personal' }, answer: '{"category":"food","confidence":0.9}' });
  assert.equal((await personal.send('/categorize', { description: 'Synthetic cafe purchase', consent: true })).status, 200);
  assert.ok(!personal.providers[0].messages[0].content.includes('office-supplies'));
  const company = harness({ profile: { uid, userType: 'company', profileComplete: true }, answer: '{"category":"office-supplies","confidence":0.9}' });
  assert.equal((await company.send('/categorize', { description: 'Synthetic stationery purchase', consent: true })).status, 200);
  assert.ok(company.providers[0].messages[0].content.includes('office-supplies'));
  const incompatible = harness({ answer: '{"category":"office-supplies","confidence":0.9}' });
  assert.equal((await incompatible.send('/categorize', { description: 'Synthetic purchase', consent: true })).status, 502);
});

test('incomplete, cross-owner or oversized finance input fails without partial summaries or provider requests', async () => {
  for (const transactions of [[ledgerRow({ amount: 'bad' })], [ledgerRow({ userId: 'foreign-owner' })],
    [ledgerRow({ date: '2026-02-30' })], Array.from({ length: 5001 }, () => ledgerRow())]) {
    const h = harness({ transactions }), response = await h.send();
    assert.equal(response.status, 422);
    assert.equal(h.providers.length, 0);
    assert.equal(h.commits(), 0);
  }
  const h = harness({ transactions: [ledgerRow({ date: '2026-10-07' }), ledgerRow({ date: '2026-09-30' }), ledgerRow()] });
  const response = await h.send();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).context.transactionCount, 1);
});

test('durable usage caps and ambiguous commits cannot produce a paid request or an automatic provider retry', async () => {
  for (const options of [{ userCount: 20 }, { globalCount: 200 }, { badCommit: true }]) {
    const h = harness(options), response = await h.send();
    assert.equal(response.status, options.badCommit ? 422 : 429);
    assert.equal(h.providers.length, 0);
    assert.equal(h.commits(), options.badCommit ? 1 : 0);
  }
  const conflict = harness({ conflict: true });
  assert.equal((await conflict.send()).status, 200);
  assert.equal(conflict.commits(), 2);
  assert.equal(conflict.providers.length, 1);
  for (const status of ['FAILED_PRECONDITION', 'ALREADY_EXISTS']) {
    const h = harness({ conflict: status, userCount: 1, globalCount: 1 });
    assert.equal((await h.send()).status, 200);
    assert.equal(h.commits(), 2);
    assert.equal(h.providers.length, 1);
    assert.ok(h.requests.every(row => !row.url.endsWith(':beginTransaction') && !row.url.endsWith(':rollback')));
  }
  const ambiguous = harness({ conflict: 'UNKNOWN' });
  assert.equal((await ambiguous.send()).status, 503);
  assert.equal(ambiguous.commits(), 1);
  assert.equal(ambiguous.providers.length, 0);
});

test('method, body, URL and CORS failures are bounded before Auth/provider network', async () => {
  const cases = [
    [{ method: 'GET', body: undefined }, 405],
    [{ headers: { 'Content-Type': 'text/plain' } }, 415],
    [{ headers: { 'Content-Type': 'application/json', Origin: 'https://foreign.expo.app' } }, 403],
    [{ body: JSON.stringify({ question: 'x'.repeat(25000), consent: true, timeZone: 'Asia/Kolkata' }) }, 413],
    [{ body: 'invalid JSON' }, 400],
    [{ body: JSON.stringify({ question: 'Help?', consent: true, timeZone: 'Asia/Kolkata', userId: 'forbidden-client-owner' }) }, 400],
  ];
  for (const [request, status] of cases) {
    const h = harness();
    assert.equal((await h.send('/financial-chat', undefined, request)).status, status);
    assert.equal(h.requests.length, 0);
  }
  const h = harness();
  for (const url of ['http://fixture.expo.app/api/financial-chat', 'https://fixture.expo.app/api/financial-chat?secret=x']) {
    const response = await handleAIRequest(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), '/financial-chat', h.dependencies);
    assert.equal(response.status, 400);
  }
  assert.equal(h.requests.length, 0);
  const allowed = harness({ env: { ALLOWED_WEB_ORIGINS: 'https://fixture.expo.app' } });
  const preflight = await allowed.send('/financial-chat', undefined, { method: 'OPTIONS', body: undefined,
    headers: { Origin: 'https://fixture.expo.app', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://fixture.expo.app');
  assert.equal(allowed.requests.length, 0);
  const sameOrigin = harness();
  const native = await sameOrigin.send('/financial-chat', undefined, { headers: { 'Content-Type': 'application/json',
    Authorization: `Bearer ${token()}`, Origin: 'https://fixture.expo.app' } });
  assert.equal(native.status, 200);
  assert.equal(native.headers.get('access-control-allow-origin'), 'https://fixture.expo.app');
});

test('whole-request deadline and cancellation abort slow transports without late provider work', async () => {
  const h = harness({ timeoutMs: 20, fetch: () => new Promise(() => {}) });
  assert.equal((await h.send()).status, 504);
  assert.equal(h.providers.length, 0);
  assert.equal(h.requests[0].init.signal.aborted, true);
  const cancelled = harness(), controller = new AbortController();
  controller.abort();
  assert.equal((await cancelled.send('/financial-chat', undefined, { signal: controller.signal })).status, 408);
  assert.equal(cancelled.requests.length, 0);
});

test('health discloses only readiness flags and strict Firestore decoding rejects invalid numeric/timestamp values', async () => {
  const response = healthResponse({ env });
  assert.deepEqual(await response.json(), { enabled: true, configured: true });
  for (const invalid of [{ amount: { integerValue: '9007199254740992' } }, { amount: { doubleValue: Infinity } },
    { createdAt: { timestampValue: '2026-02-30T12:00:00Z' } }, { amount: { integerValue: '001' } }]) {
    assert.throws(() => decodeFields(invalid));
  }
  const disabled = harness({ env: { AI_ENABLED: 'false' } });
  assert.equal((await disabled.send()).status, 503);
  assert.equal(disabled.requests.length, 0);
});

test('the default worker fetch transport preserves its global receiver', async () => {
  const h = harness(), original = globalThis.fetch;
  const mockedTransport = h.dependencies.fetchImpl;
  delete h.dependencies.fetchImpl;
  globalThis.fetch = function (...args) { assert.equal(this, globalThis); return mockedTransport(...args); };
  try { assert.equal((await h.send()).status, 200); assert.equal(h.providers.length, 1); }
  finally { globalThis.fetch = original; }
});

test('manual worker transport rejects redirects without forwarding credentials or trying another destination', async () => {
  const h = harness({ fetch: () => new Response(null, { status: 302, headers: { Location: 'https://untrusted.example.org' } }) });
  const response = await h.send();
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, 'backend/redirect-refused');
  assert.equal(h.requests.length, 1);
  assert.equal(h.providers.length, 0);
});

test('worker verification accepts bounded byte streams crossing a JavaScript realm without relaxing identity checks', async () => {
  const json = JSON.stringify({ users: [{ localId: uid, validSince: '0' }] });
  const bytes = vm.runInNewContext(`new Uint8Array(${JSON.stringify([...Buffer.from(json)])})`);
  assert.equal(bytes instanceof Uint8Array, false);
  const h = harness({ fetch: url => url.includes('identitytoolkit') ? new Response(new ReadableStream({
    start(controller) { controller.enqueue(bytes); controller.close(); },
  }), { headers: { 'Content-Type': 'application/json' } }) : null });
  assert.equal((await h.send()).status, 200);
  assert.equal(h.providers.length, 1);
});

test('EAS rejects forged constraints, Google rejection, disabled/revoked identity and wrong-owner profile before provider use', async () => {
  for (const options of [{ claims: { aud: 'other-project' } }, { claims: { exp: NOW / 1000 - 1 } },
    { lookup: { users: [{ localId: 'another-owner' }] } }, { lookup: { users: [{ localId: uid, disabled: true }] } },
    { lookup: { users: [{ localId: uid, validSince: String(NOW / 1000) }] } },
    { profile: { uid: 'another-owner', userType: 'personal', profileComplete: true } },
    { profile: { uid, userType: 'personal', profileComplete: false } },
    { fetch: url => url.includes('identitytoolkit') ? Response.json({ error: {} }, { status: 400 }) : null }]) {
    const h = harness(options), response = await h.send();
    assert.ok(response.status >= 400);
    assert.equal(h.providers.length, 0);
    assert.equal(h.commits(), 0);
    if (options.claims) assert.equal(h.requests.length, 0);
  }
});
