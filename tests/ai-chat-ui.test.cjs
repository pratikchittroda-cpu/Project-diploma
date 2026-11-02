const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createHooks, treeNodes, treeText, byId, button, plain, esm, native, theme } = require('./helpers/react-ui.cjs');

const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function chatHarness({ service, palette = { theme, isDarkMode: false }, backendEnabled = false } = {}) {
  const outer = createHooks();
  let child = null, childKey = null, active = outer;
  const react = Object.fromEntries(Object.keys(outer.react).map(name => [name,
    typeof outer.react[name] === 'function' ? (...args) => active.react[name](...args) : outer.react[name]]));
  const user = { uid: 'fixture-owner', getIdToken: async () => assert.fail('Unexpected token retrieval') };
  const auth = { currentUser: user };
  const account = { user, profileStatus: 'ready', initializing: false };
  const listeners = new Set(), keyboard = new Map(), requests = [], navigationCalls = [];
  const ai = service || { getFinancialChatResponse: async () => ({ success: false, code: 'backend/disabled' }) };
  const Screen = load('screens/personal/AIChatScreen.js', {
    react, 'react-native': { ...native, Keyboard: { dismiss() {}, addListener: (event, fn) => {
      keyboard.set(event, fn); return { remove: () => keyboard.delete(event) };
    } } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, 'firebase/auth': { onAuthStateChanged: (_, fn) => { listeners.add(fn); return () => listeners.delete(fn); } },
    '../../components/GlassCard': esm('GlassCard'), '../../constants/Icons': { Icon: 'Icon' },
    '../../contexts/ThemeContext': { lightTheme: theme, useTheme: () => palette },
    '../../contexts/AuthContext': { useAuth: () => account }, '../../config/firebase': { auth },
    '../../config/releaseFeatures': { SERVER_FEATURES_ENABLED: false, AI_FEATURES_ENABLED: backendEnabled },
    '../../config/publicConfig': { API_BASE_URL: '', AI_API_BASE_URL: backendEnabled ? 'https://fixture.expo.app/api' : '' },
    '../../services/aiService': esm({ getFinancialChatResponse: args => { requests.push(args); return ai.getFinancialChatResponse(args); } }),
  });
  const navigation = { goBack: () => navigationCalls.push('back'), navigate: route => navigationCalls.push(route) };
  const render = () => {
    active = outer;
    const node = outer.render(() => Screen.default({ navigation }));
    if (!child || node.key !== childKey) { child?.unmount(); child = createHooks(); childKey = node.key; }
    active = child;
    return child.render(() => node.type(node.props));
  };
  const changeAuth = next => { auth.currentUser = next; account.user = next; for (const fn of listeners) fn(next); };
  return { render, requests, auth, account, user, keyboard, navigationCalls, changeAuth,
    unmount() { child?.unmount(); outer.unmount(); },
  };
}
const input = tree => byId(tree, 'ai-question-input');
function prepare(h, question = 'How can I save this month?') {
  let tree = h.render();
  input(tree).props.onChangeText(question);
  byId(tree, 'ai-data-consent').props.onPress();
  return h.render();
}

test('chat drafts and quick questions are interactive but consent is required before sending', async () => {
  const h = chatHarness();
  let tree = h.render();
  assert.match(treeText(tree), /Financial AI Chat/);
  assert.ok(byId(tree, 'ai-connection-notice'));
  assert.notEqual(input(tree).props.editable, false);
  button(tree, 'How can I reduce my spending this month?').props.onPress();
  tree = h.render();
  assert.equal(input(tree).props.value, 'How can I reduce my spending this month?');
  assert.equal(byId(tree, 'ai-send-question').props.disabled, true);
  await byId(tree, 'ai-send-question').props.onPress(); // Programmatic press cannot bypass consent.
  assert.equal(h.requests.length, 0);
  assert.match(treeText(h.render()), /agree for this conversation/);
  button(tree, 'Back to Home').props.onPress();
  button(tree, 'Open Privacy & data').props.onPress();
  assert.deepEqual(h.navigationCalls, ['back', 'Privacy']);
  h.unmount();
});

test('a consented chat prevents duplicate sends and displays the full secure-service answer and bounded history', async () => {
  const pending = defer();
  const answer = `Synthetic service answer: ${'complete text '.repeat(350)}`;
  const h = chatHarness({ backendEnabled: true, service: { getFinancialChatResponse: () => pending.promise } });
  let tree = prepare(h);
  const sending = byId(tree, 'ai-send-question').props.onPress();
  await byId(tree, 'ai-send-question').props.onPress();
  assert.equal(h.requests.length, 1);
  assert.ok(byId(h.render(), 'ai-chat-loading'));
  pending.resolve({ success: true, answer, context: { complete: true, transactionCount: 32 } });
  await sending;
  tree = h.render();
  assert.ok(treeText(byId(tree, 'ai-message-assistant')).includes(answer));
  assert.match(treeText(byId(tree, 'ai-message-assistant')), /32 entries/);
  assert.equal(input(tree).props.value, '');
  input(tree).props.onChangeText('What should I change next?');
  await byId(h.render(), 'ai-send-question').props.onPress();
  const history = plain(h.requests[1].conversationHistory);
  assert.deepEqual(history.map(message => Object.keys(message).sort()), [['content', 'role'], ['content', 'role']]);
  assert.equal(history[0].content, 'How can I save this month?');
  assert.equal(history[1].content, answer);
  assert.equal(h.requests[0].signal.aborted, false);
  h.unmount();
});

test('chat rejects invalid questions before the service even if a disabled button handler is called', async () => {
  const h = chatHarness();
  let tree = prepare(h);
  for (const question of ['x', 'x'.repeat(2001), '  ']) {
    input(tree).props.onChangeText(question);
    tree = h.render();
    assert.equal(byId(tree, 'ai-send-question').props.disabled, true);
    await byId(tree, 'ai-send-question').props.onPress();
    tree = h.render();
    assert.match(treeText(tree), /2–2000 characters/);
  }
  assert.equal(h.requests.length, 0);
  h.unmount();
});

test('cancellation and consent revocation abort pending work and reject late replies', async () => {
  for (const action of ['ai-cancel-request', 'ai-data-consent', 'ai-clear-chat']) {
    const pending = defer();
    const h = chatHarness({ backendEnabled: true, service: { getFinancialChatResponse: () => pending.promise } });
    const sending = byId(prepare(h), 'ai-send-question').props.onPress();
    byId(h.render(), action).props.onPress();
    assert.equal(h.requests[0].signal.aborted, true);
    pending.resolve({ success: true, answer: 'Late reply must be ignored.' });
    await sending;
    const tree = h.render();
    assert.equal(byId(tree, 'ai-message-assistant'), undefined);
    assert.equal(byId(tree, 'ai-chat-loading'), undefined);
    if (action !== 'ai-cancel-request') assert.equal(byId(tree, 'ai-data-consent').props.accessibilityState.checked, false);
    if (action === 'ai-clear-chat') {
      assert.equal(input(tree).props.value, '');
      assert.equal(byId(tree, 'ai-chat-error'), undefined);
    }
    h.unmount();
  }
});

test('same-UID replacement cannot reuse old consent before the auth observer or render runs', async () => {
  const h = chatHarness();
  const oldTree = prepare(h);
  const replacement = { ...h.user };
  h.auth.currentUser = replacement;
  await byId(oldTree, 'ai-send-question').props.onPress();
  assert.equal(h.requests.length, 0);
  h.changeAuth(replacement);
  const fresh = h.render();
  assert.equal(input(fresh).props.value, '');
  assert.equal(byId(fresh, 'ai-data-consent').props.accessibilityState.checked, false);
  assert.equal(byId(fresh, 'ai-send-question').props.disabled, true);
  h.unmount();
});

test('account replacement, logout and unmount abort old requests without exposing old messages or consent', async () => {
  for (const transition of ['same-uid', 'new-uid', 'logout', 'unmount']) {
    const pending = defer();
    const h = chatHarness({ service: { getFinancialChatResponse: () => pending.promise } });
    const sending = byId(prepare(h), 'ai-send-question').props.onPress();
    if (transition === 'unmount') h.unmount();
    else {
      h.changeAuth(transition === 'logout' ? null : { uid: transition === 'same-uid' ? h.user.uid : 'other-fixture-owner' });
      const fresh = h.render();
      assert.equal(input(fresh).props.value, '');
      assert.equal(byId(fresh, 'ai-data-consent').props.accessibilityState.checked, false);
    }
    assert.equal(h.requests[0].signal.aborted, true);
    pending.resolve({ success: true, answer: 'Old account reply.' });
    await sending;
    if (transition !== 'unmount') {
      assert.equal(byId(h.render(), 'ai-message-assistant'), undefined);
      h.unmount();
    }
  }
});

test('sending against the unchanged disabled backend preserves the question and reports a real setup error', async () => {
  const h = chatHarness();
  const tree = prepare(h);
  assert.equal(byId(tree, 'ai-send-question').props.disabled, false);
  await byId(tree, 'ai-send-question').props.onPress();
  const failed = h.render();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].consent, true);
  assert.match(treeText(byId(failed, 'ai-chat-error')), /not enabled/);
  assert.equal(input(failed).props.value, 'How can I save this month?');
  assert.equal(byId(failed, 'ai-message-assistant'), undefined);
  h.unmount();
});

test('failed chat preserves a newer draft and explicit retry does not duplicate failed history', async () => {
  const first = defer();
  let attempts = 0;
  const h = chatHarness({ backendEnabled: true, service: { getFinancialChatResponse: () => ++attempts === 1 ? first.promise
    : Promise.resolve({ success: true, answer: 'Synthetic recovered reply.' }) } });
  const sending = byId(prepare(h), 'ai-send-question').props.onPress();
  input(h.render()).props.onChangeText('My next draft');
  first.resolve({ success: false, code: 'backend/timeout' });
  await sending;
  let tree = h.render();
  assert.equal(input(tree).props.value, 'My next draft');
  assert.match(treeText(byId(tree, 'ai-chat-error')), /may have processed/);
  await byId(tree, 'ai-retry-request').props.onPress();
  tree = h.render();
  assert.equal(h.requests[1].question, 'How can I save this month?');
  assert.equal(h.requests[1].conversationHistory.length, 0);
  assert.equal(input(tree).props.value, 'My next draft');
  assert.equal(treeNodes(tree).filter(node => node.props.testID === 'ai-message-user').length, 1);
  assert.equal(byId(tree, 'ai-chat-error'), undefined);
  byId(tree, 'ai-clear-chat').props.onPress();
  tree = h.render();
  assert.equal(input(tree).props.value, '');
  assert.equal(byId(tree, 'ai-data-consent').props.accessibilityState.checked, false);
  assert.equal(byId(tree, 'ai-message-assistant'), undefined);
  h.unmount();
});

test('chat uses light/dark/loading theme fallback and removes bottom inset while the keyboard is open', () => {
  const darkTheme = { ...theme, isDarkMode: true, background: '#0F0F0F', surface: '#1A1A1A', text: '#FFFFFF', textSecondary: '#B3B3B3' };
  for (const palette of [{ theme, isDarkMode: false }, { theme: darkTheme, isDarkMode: true }, { theme: null, isDarkMode: false }]) {
    const h = chatHarness({ palette });
    let tree = h.render();
    assert.deepEqual(Array.from(treeNodes(tree).find(node => node.type === 'Gradient').props.colors), [theme.primary, theme.primaryLight]);
    assert.ok(treeNodes(tree).some(node => node.props.style?.paddingBottom === 42));
    h.keyboard.get('keyboardWillShow')();
    tree = h.render();
    assert.ok(treeNodes(tree).some(node => node.props.style?.paddingBottom === 16));
    h.keyboard.get('keyboardWillHide')();
    assert.ok(treeNodes(h.render()).some(node => node.props.style?.paddingBottom === 42));
    h.unmount();
  }
});

test('an unconfigured hosted AI endpoint rejects UI sends before tokens, attestation or network', async () => {
  let realService;
  const h = chatHarness({ service: { getFinancialChatResponse: args => realService.getFinancialChatResponse(args) } });
  const calls = [];
  h.user.getIdToken = async () => { calls.push('auth-token'); return 'synthetic-token'; };
  const releaseFeatures = load('config/releaseFeatures.js');
  assert.equal(releaseFeatures.SERVER_FEATURES_ENABLED, false);
  assert.equal(releaseFeatures.AI_FEATURES_ENABLED, true);
  const client = load('services/backendClient.js', {
    '../config/firebase': { auth: h.auth }, '../config/publicConfig': { API_BASE_URL: '', AI_API_BASE_URL: '' },
    '../config/releaseFeatures': releaseFeatures,
  }, { fetch: async () => { calls.push('fetch'); throw new Error('Network must not run'); } });
  client.setBackendAppCheckTokenProvider(async () => { calls.push('attestation'); return 'synthetic-attestation'; });
  realService = load('services/aiService.js', { '../config/aiConfig': { AI_CONFIG: {} },
    '../utils/finance': load('utils/finance.js'), './backendClient': client }).default;
  await byId(prepare(h), 'ai-send-question').props.onPress();
  assert.deepEqual(calls, []);
  assert.match(treeText(byId(h.render(), 'ai-chat-error')), /not configured/);
  h.unmount();
});
