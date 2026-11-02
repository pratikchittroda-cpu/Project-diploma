const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createHooks, treeNodes, treeText, esm, native, theme } = require('./helpers/react-ui.cjs');
const finance = load('utils/finance.js');
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const action = (tree, title) => treeNodes(tree).find(node => node.type === 'Button' && node.props.title === title);
const consent = tree => treeNodes(tree).find(node => node.props.accessibilityRole === 'checkbox');

function toolsHarness(service = {}) {
  const hooks = createHooks(), user = { uid: 'fixture-owner' }, auth = { currentUser: user }, calls = [], applied = [], ref = { current: null };
  const account = { user, profileStatus: 'ready', initializing: false, userData: { userType: 'personal' } };
  let draft = { revision: 0, type: 'expense', category: 'food', amount: '', description: 'Synthetic coffee purchase' };
  const listeners = new Set();
  const Tools = load('components/finance/AITransactionTools.js', {
    react: hooks.react, 'react-native': native, 'firebase/auth': { onAuthStateChanged: (_, fn) => { listeners.add(fn); return () => listeners.delete(fn); } },
    '../../constants/Icons': { Icon: 'Icon' }, '../../config/firebase': { auth }, '../../contexts/AuthContext': { useAuth: () => account },
    '../../utils/finance': finance, '../../services/aiService': esm({
      categorizeTransaction: async (...args) => { calls.push(['category', ...args]); return service.category ? service.category(...args) : { source: 'ai', aiSuggested: true, category: 'food', confidence: 0.9 }; },
      parseReceiptTextWithAI: async (...args) => { calls.push(['receipt', ...args]); return { success: true, source: 'ai', items: [{ name: 'Synthetic item', price: 12.35, quantity: 3 }] }; },
    }),
    './FinanceUI': { Button: 'Button', Card: 'Card', Copy: 'Text', Field: 'Field', categoryDetails: value => ({ label: value }),
      useFinanceColors: () => ({ accent: theme.primary, border: theme.border, surface: theme.surface }) },
  }).default;
  const render = () => hooks.render(() => Tools({ ref, draft, getDraftSnapshot: () => ({ ...draft }), isSaving: () => false,
    onApplyCategory: suggestion => { applied.push(['category', suggestion.category]); return true; },
    onApplyReceiptItem: item => { applied.push(['receipt', item]); return true; } }));
  return { render, calls, applied, hooks, auth, user, ref, account,
    editDraft() { ref.current.invalidateDraft(); draft = { ...draft, revision: draft.revision + 1, description: 'New manual draft' }; },
  };
}

test('AI form tools send nothing before consent and require explicit review before applying a category', async () => {
  const h = toolsHarness();
  let tree = h.render();
  await action(tree, 'Suggest category').props.onPress();
  assert.equal(h.calls.length, 0);
  consent(tree).props.onPress();
  await action(h.render(), 'Suggest category').props.onPress();
  tree = h.render();
  assert.match(treeText(tree), /AI category suggestion/);
  assert.equal(h.applied.length, 0);
  action(tree, 'Use suggested category').props.onPress();
  assert.deepEqual(h.applied, [['category', 'food']]);
  assert.equal(h.calls[0][1], 'Synthetic coffee purchase');
  assert.equal(h.calls[0][2].consent, true);
  h.hooks.unmount();
});

test('AI tools do not overwrite manual edits, reuse old-account consent, or duplicate a pending request', async () => {
  const pending = defer(), h = toolsHarness({ category: () => pending.promise });
  consent(h.render()).props.onPress();
  const tree = h.render(), sending = action(tree, 'Suggest category').props.onPress();
  await action(tree, 'Suggest category').props.onPress();
  assert.equal(h.calls.length, 1);
  h.editDraft();
  assert.equal(h.calls[0][2].signal.aborted, true);
  pending.resolve({ source: 'ai', aiSuggested: true, category: 'food', confidence: 0.9 });
  await sending;
  assert.equal(action(h.render(), 'Use suggested category'), undefined);
  h.auth.currentUser = { ...h.user };
  await action(h.render(), 'Suggest category').props.onPress();
  assert.equal(h.calls.length, 1);
  assert.equal(h.applied.length, 0);
  h.hooks.unmount();
});

test('local fallback is never labelled AI, and receipt parsing selects a reviewed item without saving', async () => {
  const local = toolsHarness({ category: async () => ({ source: 'local', aiSuggested: false, category: 'food', error: 'backend/unavailable', errorMessage: 'No AI connection' }) });
  consent(local.render()).props.onPress();
  await action(local.render(), 'Suggest category').props.onPress();
  assert.match(treeText(local.render()), /Local keyword suggestion · not an AI reply/);
  assert.equal(action(local.render(), 'Use suggested category'), undefined);
  local.hooks.unmount();
  const h = toolsHarness();
  consent(h.render()).props.onPress();
  treeNodes(h.render()).find(node => node.type === 'Field' && node.props.label === 'Receipt text').props.onChangeText('Synthetic item: 3 at INR 12.35 each');
  await action(h.render(), 'Parse receipt text').props.onPress();
  let tree = h.render();
  assert.equal(action(tree, 'Apply selected item').props.disabled, true);
  const item = treeNodes(tree).find(node => node.props.accessibilityRole === 'radio');
  assert.match(item.props.accessibilityLabel, /total ₹37\.05/);
  item.props.onPress();
  action(h.render(), 'Apply selected item').props.onPress();
  assert.deepEqual(h.applied, [['receipt', { name: 'Synthetic item', quantity: 3, price: 12.35 }]]);
  tree = h.render();
  assert.match(treeText(tree), /unsaved amount and description/);
  action(tree, 'Clear AI tools').props.onPress();
  assert.equal(consent(h.render()).props.accessibilityState.checked, false);
  h.hooks.unmount();
});
