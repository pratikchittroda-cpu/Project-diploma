const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const { validateRequest } = require('../functions/lib/validation');

function load(file, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { code } = babel.transformSync(source, { filename: file, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'] });
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, URL, AbortController, setTimeout, clearTimeout,
    require: name => { if (!(name in mocks)) throw new Error(`Unmocked ${name}`); return mocks[name]; }, ...globals });
  return module.exports;
}
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const reply = (data, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(data) });
function harness(options = {}) {
  const requests = [];
  const user = { uid: 'alice', getIdToken: async () => 'synthetic-id-token' };
  const auth = { currentUser: user };
  const client = load('services/backendClient.js', {
    '../config/firebase': { auth }, '../config/publicConfig': { API_BASE_URL: options.url ?? 'https://api.expenzo.app/ai', AI_API_BASE_URL: options.aiUrl },
    // Explicit test-only opt-in preserves coverage of the dormant secure backend.
    '../config/releaseFeatures': options.releaseFeatures ?? { SERVER_FEATURES_ENABLED: true },
  }, { fetch: async (...args) => { requests.push(args); return options.fetch ? options.fetch(...args) : reply({ success: true }); }, ...options.globals });
  client.setBackendAppCheckTokenProvider(async () => 'synthetic-attestation');
  return { ...client, requests, auth, user };
}

test('Spark retains disabled report/deletion routes while separately enabling consented hosted AI', async () => {
  const releaseFeatures = load('config/releaseFeatures.js', {});
  assert.equal(releaseFeatures.SERVER_FEATURES_ENABLED, false);
  const h = harness({ url: 'https://fixture.cloudfunctions.net/ai', releaseFeatures });
  const tokens = [];
  h.user.getIdToken = async () => { tokens.push('auth'); return 'synthetic-id-token'; };
  h.setBackendAppCheckTokenProvider(async () => { tokens.push('app-check'); return 'synthetic-attestation'; });
  assert.equal(releaseFeatures.AI_FEATURES_ENABLED, true);
  for (const route of ['/report', '/account/delete']) {
    await assert.rejects(h.requestBackend(route, {}), error => error.code === 'backend/disabled');
  }
  assert.deepEqual(tokens, []);
  assert.equal(h.requests.length, 0);
});

test('backend client sends both tokens to only the configured HTTPS route and never follows redirects', async () => {
  const h = harness();
  assert.equal((await h.requestBackend('/report', { reason: 'other' })).success, true);
  assert.equal(h.requests.length, 1);
  const [url, request] = h.requests[0];
  assert.equal(url, 'https://api.expenzo.app/ai/report');
  assert.equal(request.headers.Authorization, 'Bearer synthetic-id-token');
  assert.equal(request.headers['X-Firebase-AppCheck'], 'synthetic-attestation');
  assert.equal(request.redirect, 'error');
  assert.equal(request.method, 'POST');
});

test('unconfigured/credential-bearing/query/HTTP endpoints and unknown routes never send a token', async () => {
  for (const url of ['', 'http://api.expenzo.app', 'https://user:password@api.expenzo.app', 'https://api.expenzo.app/?secret=x',
    'https://api.expenzo.app/#fragment', 'https://localhost', 'https://127.0.0.1', 'https://example.com']) {
    const h = harness({ url });
    await assert.rejects(h.requestBackend('/account/delete', {}), e => e.code === 'backend/not-configured');
    assert.equal(h.requests.length, 0);
  }
  const h = harness();
  await assert.rejects(h.requestBackend('/unknown', {}), e => e.code === 'backend/invalid-route');
  h.auth.currentUser = null;
  await assert.rejects(h.requestBackend('/report', {}), e => e.code === 'auth/unauthenticated');
  assert.equal(h.requests.length, 0);
});

test('cancellation and deadline bound token retrieval without a delayed backend request', async () => {
  let timeout;
  const h = harness({ globals: { setTimeout: fn => { timeout = fn; return 1; }, clearTimeout: () => {} } });
  const token = defer(); h.user.getIdToken = () => token.promise;
  const pending = h.requestBackend('/account/delete', {});
  const checked = assert.rejects(pending, e => e.code === 'backend/timeout');
  timeout(); await checked;
  token.resolve('synthetic'); await flush();
  assert.equal(h.requests.length, 0);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(h.requestBackend('/report', {}, { signal: controller.signal }), e => e.code === 'backend/cancelled');
});

test('same-UID replacement sessions cannot send or consume an obsolete backend request', async () => {
  const token = defer(); const h = harness(); h.user.getIdToken = () => token.promise;
  const pending = h.requestBackend('/report', {});
  h.auth.currentUser = { ...h.user }; token.resolve('old-session');
  await assert.rejects(pending, e => e.code === 'auth/session-changed');
  assert.equal(h.requests.length, 0);
  const response = defer(); const duringFetch = harness({ fetch: () => response.promise });
  const reading = duringFetch.requestBackend('/report', {}); await flush();
  duringFetch.auth.currentUser = { ...duringFetch.user }; response.resolve(reply({ success: true }));
  await assert.rejects(reading, e => e.code === 'auth/session-changed');
});

test('App Check and structured backend errors are preserved without retries; malformed bodies fail clearly', async () => {
  const h = harness(); h.setBackendAppCheckTokenProvider(async () => { throw Object.assign(new Error('Unsupported build'), { code: 'app-check/unsupported' }); });
  await assert.rejects(h.requestBackend('/report', {}), e => e.code === 'app-check/unsupported');
  assert.equal(h.requests.length, 0);
  const stale = harness({ fetch: async () => reply({ code: 'auth/requires-recent-login', error: 'Verify again' }, 401) });
  await assert.rejects(stale.requestBackend('/account/delete', {}), e => e.code === 'auth/requires-recent-login' && e.status === 401);
  assert.equal(stale.requests.length, 1);
  for (const body of ['not-json', 'x'.repeat(65537)]) {
    const broken = harness({ fetch: async () => ({ ok: true, status: 200, text: async () => body }) });
    await assert.rejects(broken.requestBackend('/report', {}), e => e.code === 'backend/invalid-response');
    assert.equal(broken.requests.length, 1);
  }
});

const aiReply = () => ({ answer: 'Educational answer. '.repeat(100), responseId: '11111111-1111-4111-8111-111111111111',
  context: { complete: true, transactionCount: 35, period: { start: '2026-10-01', end: '2026-10-05', timeZone: 'Asia/Kolkata' } } });
function aiHarness(response = aiReply()) {
  const requests = [];
  const service = load('services/aiService.js', {
    '../config/aiConfig': { AI_CONFIG: {} },
    '../utils/finance': load('utils/finance.js', {}),
    './backendClient': { requestBackend: async (...args) => { requests.push(args); return response; } },
  }, { Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'Asia/Kolkata' }) }) } }).default;
  return { service, requests };
}

test('financial chat matches server schema, sends timezone and bounded history, and preserves the full answer', async () => {
  const h = aiHarness(); const signal = new AbortController().signal;
  const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: String(i).repeat(1500), id: 'ui-only', userId: 'never-send' }));
  const result = await h.service.getFinancialChatResponse({ question: ' Budget advice? ', conversationHistory: history, consent: true, signal });
  assert.equal(result.success, true); assert.ok(result.answer.length > 1200, 'do not cut off important caveats');
  const [route, payload, options] = h.requests[0];
  assert.equal(route, '/financial-chat'); assert.equal(options.signal, signal);
  assert.equal(payload.timeZone, 'Asia/Kolkata'); assert.equal(payload.question, 'Budget advice?');
  const parsed = validateRequest(route, JSON.parse(JSON.stringify(payload)));
  assert.ok(parsed.conversationHistory.length <= 8);
  assert.ok(parsed.conversationHistory.reduce((n, m) => n + m.content.length, 0) <= 4000);
  assert.ok(!JSON.stringify(payload).includes('never-send'));
  assert.equal(parsed.conversationHistory.at(-1).content, '11'.repeat(1000));
});

test('AI consent and question limits fail before a request; incomplete context cannot be displayed as verified', async () => {
  const h = aiHarness();
  for (const input of [{ question: 'Help?', consent: false }, { question: 'x'.repeat(2001), consent: true }, { question: {}, consent: true }]) {
    assert.equal((await h.service.getFinancialChatResponse(input)).success, false);
  }
  assert.equal(h.requests.length, 0);
  for (const response of [{ ...aiReply(), context: { complete: false } }, { ...aiReply(), answer: '' },
    { ...aiReply(), context: { complete: true } }, { ...aiReply(), responseId: null }]) {
    const broken = aiHarness(response);
    assert.equal((await broken.service.getFinancialChatResponse({ question: 'Help?', consent: true })).success, false);
  }
});

test('client and backend legacy rounding agree at half-paise boundaries', () => {
  const client = load('utils/finance.js', {});
  const { summarize } = require('../functions/lib/finance');
  for (const amount of [1.005, 10.075, 19.995, 0.005, 0.015, 123456.785]) {
    const summary = summarize([{ type: 'expense', category: 'food', date: '2026-10-04', amount }], [], {});
    assert.equal(summary.totals.expenses, client.fromMinor(client.toMinor(amount)), String(amount));
  }
});
