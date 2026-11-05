const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createHooks, treeNodes, treeText, byId, button, plain, esm, native, theme } = require('./helpers/react-ui.cjs');

const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function chatHarness({ service, palette = { theme, isDarkMode: false }, backendEnabled = false, consentStore = new Map(), saveFails = false } = {}) {
  const consentSaves = [];
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
     '../../components/GlassCard': esm('GlassCard'), '../../components/AppBackground': esm('AppBackground'), '../../components/LogoLoader': esm('LogoLoader'), '../../components/GlassSurface': { ...esm('GlassSurface'), glassEdge: dark => (dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)') }, '../../components/MarkdownText': esm('MarkdownText'), '../../constants/Icons': { Icon: 'Icon' },
    '../../contexts/ThemeContext': { lightTheme: theme, useTheme: () => palette },
    '../../contexts/AuthContext': { useAuth: () => account }, '../../config/firebase': { auth },
    '../../config/releaseFeatures': { SERVER_FEATURES_ENABLED: false, AI_FEATURES_ENABLED: backendEnabled },
    '../../config/publicConfig': { API_BASE_URL: '', AI_API_BASE_URL: backendEnabled ? 'https://fixture.expo.app/api' : '' },
    '../../services/aiService': esm({ getFinancialChatResponse: args => { requests.push(args); return ai.getFinancialChatResponse(args); } }),
    // Remembered consent: an in-memory stand-in for the per-account device store.
    '../../utils/aiConsent': {
      loadChatConsent: async uid => consentStore.get(uid) === true,
      saveChatConsent: async (uid, granted) => {
        consentSaves.push([uid, granted]);
        if (saveFails) return false;
        if (granted) consentStore.set(uid, true); else consentStore.delete(uid);
        return true;
      },
    },
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
  return { render, requests, auth, account, user, keyboard, navigationCalls, changeAuth, consentStore, consentSaves,
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
  assert.match(treeText(h.render()), /I agree · remember my choice/);
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
    // Revoking turns consent off; Clear chat aborts the request but keeps the once-given consent.
    if (action !== 'ai-cancel-request') assert.equal(byId(tree, 'ai-data-consent').props.accessibilityState.checked, action === 'ai-clear-chat');
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
  assert.equal(byId(tree, 'ai-data-consent').props.accessibilityState.checked, true);
  assert.equal(byId(tree, 'ai-message-assistant'), undefined);
  h.unmount();
});

test('chat uses light/dark/loading theme fallback and removes bottom inset while the keyboard is open', () => {
  const darkTheme = { ...theme, isDarkMode: true, background: '#0F0F0F', surface: '#1A1A1A', text: '#FFFFFF', textSecondary: '#B3B3B3' };
  for (const palette of [{ theme, isDarkMode: false }, { theme: darkTheme, isDarkMode: true }, { theme: null, isDarkMode: false }]) {
    const h = chatHarness({ palette });
    let tree = h.render();
    assert.deepEqual(Array.from(treeNodes(tree).find(node => node.type === 'AppBackground').props.colors), [theme.primary, theme.primaryLight]);
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

test('the sharing card keeps a short summary up front and the full disclosure one tap away', () => {
  const h = chatHarness();
  let tree = h.render();
  assert.match(treeText(tree), /Nothing is sent automatically/);
  assert.doesNotMatch(treeText(tree), /raw ledger descriptions/);
  const toggle = byId(tree, 'ai-sharing-details');
  assert.equal(toggle.props.accessibilityState.expanded, false);
  toggle.props.onPress();
  tree = h.render();
  assert.equal(byId(tree, 'ai-sharing-details').props.accessibilityState.expanded, true);
  for (const text of [/2–2000 characters/, /up to 8 recent chat excerpts \(4000 characters total\)/, /raw ledger descriptions and identifiers are not shared/,
    /not saved locally/]) assert.match(treeText(tree), text);
  byId(tree, 'ai-sharing-details').props.onPress();
  assert.doesNotMatch(treeText(h.render()), /raw ledger descriptions/);
  h.unmount();
});

test('consent shows in one place: the card collapses once agreed and the composer offers revoke', () => {
  const h = chatHarness();
  let tree = h.render();
  assert.match(treeText(tree), /Choose what you share/);
  assert.match(treeText(byId(tree, 'ai-review-sharing')), /Review data sharing to send/);
  tree = prepare(h);
  assert.doesNotMatch(treeText(tree), /Choose what you share|Nothing is sent automatically/);
  assert.equal(byId(tree, 'ai-data-consent').props.accessibilityState.checked, true);
  const status = byId(tree, 'ai-review-sharing');
  assert.match(treeText(status), /Sharing on · revoke/);
  assert.equal(status.props.accessibilityLabel, 'Revoke data-sharing consent');
  status.props.onPress();
  tree = h.render();
  assert.equal(byId(tree, 'ai-data-consent').props.accessibilityState.checked, false);
  assert.match(treeText(tree), /Choose what you share/);
  // A one-character draft swaps the status for guidance until it is fixed.
  input(tree).props.onChangeText('x');
  tree = h.render();
  assert.equal(byId(tree, 'ai-review-sharing'), undefined);
  assert.match(treeText(tree), /Use at least 2 characters/);
  h.unmount();
});

const settle = () => new Promise(resolve => setImmediate(resolve));

test('consent is asked once per account: saved on agree, restored next visit, cleared on revoke', async () => {
  const consentStore = new Map();
  const first = chatHarness({ consentStore });
  let tree = prepare(first);
  await settle();
  assert.deepEqual(first.consentSaves, [['fixture-owner', true]]);
  assert.equal(consentStore.get('fixture-owner'), true);
  // Clear chat keeps the choice.
  byId(tree, 'ai-clear-chat').props.onPress();
  assert.equal(byId(first.render(), 'ai-data-consent').props.accessibilityState.checked, true);
  first.unmount();

  // A later visit starts already agreed: no consent prompt, the card is collapsed.
  const second = chatHarness({ consentStore });
  second.render();
  await settle();
  tree = second.render();
  assert.equal(byId(tree, 'ai-data-consent').props.accessibilityState.checked, true);
  assert.doesNotMatch(treeText(tree), /Choose what you share/);
  assert.match(treeText(byId(tree, 'ai-review-sharing')), /Sharing on · revoke/);
  // Revoking is remembered too.
  byId(tree, 'ai-review-sharing').props.onPress();
  await settle();
  assert.equal(consentStore.has('fixture-owner'), false);
  second.unmount();
  const third = chatHarness({ consentStore });
  third.render();
  await settle();
  assert.equal(byId(third.render(), 'ai-data-consent').props.accessibilityState.checked, false);
  third.unmount();
});

test('a remembered consent never overrides a choice made while it was loading, and save failures are reported', async () => {
  const consentStore = new Map([['fixture-owner', true]]);
  const h = chatHarness({ consentStore });
  let tree = h.render();
  // The user revokes before the stored value arrives; the stored "granted" must not win.
  byId(tree, 'ai-data-consent').props.onPress(); // on
  byId(h.render(), 'ai-data-consent').props.onPress(); // off
  await settle();
  assert.equal(byId(h.render(), 'ai-data-consent').props.accessibilityState.checked, false);
  h.unmount();

  const failing = chatHarness({ saveFails: true });
  tree = failing.render();
  byId(tree, 'ai-data-consent').props.onPress();
  await settle();
  assert.match(treeText(failing.render()), /could not remember it/);
  failing.unmount();

  // Another account on the same device has its own (absent) consent.
  const other = chatHarness({ consentStore: new Map([['someone-else', true]]) });
  other.render();
  await settle();
  assert.equal(byId(other.render(), 'ai-data-consent').props.accessibilityState.checked, false);
  other.unmount();
});

test('the chat page uses the theme page gradient with white page text, like every other screen', () => {
  const pageGradientColors = ['#3157FF', '#1F3FD1'];
  const h = chatHarness({ palette: { theme: { ...theme, pageGradientColors }, isDarkMode: false } });
  const tree = h.render();
  assert.deepEqual(Array.from(treeNodes(tree).find(node => node.type === 'AppBackground').props.colors), pageGradientColors);
  const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  const title = treeNodes(tree).find(node => node.props.accessibilityRole === 'header' && treeText(node) === 'Financial AI Chat');
  assert.equal(flat(title.props.style).color, '#FFFFFF');
  assert.equal(treeNodes(tree).find(node => node.type === 'StatusBar').props.barStyle, 'light-content');
  h.unmount();
});
