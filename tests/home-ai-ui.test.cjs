const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const jsxRuntime = require('react/jsx-runtime');

const root = path.resolve(__dirname, '..');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-06T12:00:00'])); }
}
function load(file, mocks = {}) {
  const { code } = babel.transformSync(fs.readFileSync(path.join(root, file), 'utf8'), {
    filename: file, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]],
  });
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date: FixedDate, URL,
    require: name => {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected dependency ${name} in ${file}`);
    },
  }, { filename: file });
  return module.exports;
}
const native = Object.fromEntries(['ActivityIndicator', 'Image', 'RefreshControl', 'ScrollView', 'StatusBar', 'Text', 'TextInput', 'TouchableOpacity', 'View'].map(name => [name, name]));
native.Platform = { OS: 'ios' };
native.StyleSheet = { create: value => value, absoluteFill: { position: 'absolute' }, absoluteFillObject: { position: 'absolute' } };
const icons = { Icon: 'Icon', AppIcons: { Profile: 'ProfileIcon', Income: 'IncomeIcon', Expense: 'ExpenseIcon' } };
const theme = { primary: '#6755D7', primaryLight: '#3C74D8', text: '#171717', textSecondary: '#4A4A4A', background: '#FAFAFA',
  surface: '#FFFFFF', border: '#E5E7EB', warning: '#F59E0B', warningLight: '#FEF3C7', inputBackground: '#F5F5F5', primaryContainer: '#6755D720' };
const esm = value => ({ default: value, __esModule: true });
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node?.props) return [];
  return [node, ...nodes(typeof node.type === 'function' ? node.type(node.props) : node.props.children)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join('');
  if (!node.props) return String(node);
  return text(typeof node.type === 'function' ? node.type(node.props) : node.props.children);
}
const byId = (tree, id) => nodes(tree).find(node => node.props.testID === id);
const button = (tree, label) => nodes(tree).find(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label);
const finance = load('utils/finance.js');
const profileImage = load('utils/profileImage.js');
function homeHarness(connected = false) {
  let index = 0;
  const slots = [], refreshed = [], navigated = [], focusRefreshes = [];
  const react = { useCallback: fn => fn, useState: initial => {
    const slot = index++;
    if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
    return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
  } };
  const ledger = { complete: true, error: null, refreshing: false, transactions: [], refresh: async () => { refreshed.push('ledger'); } };
  const budgets = { complete: true, error: null, refreshing: false, budgets: [], refresh: async () => { refreshed.push('budgets'); } };
  const navigation = { navigate: route => navigated.push(route) };
  const useFinanceCardColors = () => ({ ink: theme.text, muted: theme.textSecondary, border: theme.border,
    card: theme.surface, surface: theme.inputBackground, input: theme.inputBackground, selected: theme.border,
    income: '#157A45', expense: '#B52E43', warning: '#865200', accent: theme.primary, light: true });
  const entry = load('components/finance/HomeAIEntry.js', { react, 'react-native': native, '../../constants/Icons': icons,
    '../../config/releaseFeatures': { SERVER_FEATURES_ENABLED: false, AI_FEATURES_ENABLED: connected },
    '../../config/publicConfig': { API_BASE_URL: '', AI_API_BASE_URL: connected ? 'https://ai.example.test/api' : '' },
    './FinanceUI': { Card: 'Card', Copy: 'Text', useFinanceCardColors } }).default;
  const Dashboard = load('components/finance/PersonalDashboard.js', {
    react, 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, '../../constants/Icons': icons,
    '../../contexts/ThemeContext': { useTheme: () => ({ theme, isDarkMode: false }) },
    '../../contexts/AuthContext': { useAuth: () => ({ user: { uid: 'fixture-owner' }, userData: { fullName: 'Fixture User' } }) },
    '../../hooks/useTransactions': { useTransactions: () => ledger }, '../../hooks/useBudgets': { useBudgets: () => budgets },
    '../../utils/finance': finance, '../../utils/profileImage': profileImage, '../GlassCard': esm('GlassCard'),
    '../../utils/budgetRecommendations': { getBudgetRecommendations: () => [] }, '../BudgetAdvisor': esm('BudgetAdvisor'),
    './FinanceUI': { useFinanceCardColors, useFocusRefresh: (_, refresh) => focusRefreshes.push(refresh) }, './HomeAIEntry': esm(entry),
  }).default;
  return { Dashboard, entry, ledger, budgets, navigation, refreshed, navigated, focusRefreshes,
    render: () => { index = 0; return Dashboard({ navigation }); } };
}

test('personal Home keeps the FinanceAccount boundary while using the styled dashboard', () => {
  const Dashboard = load('screens/personal/DashboardScreen.js', { react: {},
    '../../components/finance/FinanceUI': { FinanceAccount: 'FinanceAccount' },
    '../../components/finance/PersonalDashboard': esm('PersonalDashboard'),
    '../../components/finance/FinanceSummaryScreen': esm('FinanceSummaryScreen'),
  }).default;
  const navigation = {};
  const tree = Dashboard({ navigation });
  assert.equal(tree.type, 'FinanceAccount');
  assert.equal(tree.props.component, 'PersonalDashboard');
  assert.equal(tree.props.navigation, navigation);
});

test('styled Home shows overview then AI then recent transactions even with an empty ledger', () => {
  const h = homeHarness(), tree = h.render();
  assert.deepEqual(Array.from(nodes(tree).find(node => node.type === 'Gradient').props.colors), [theme.primary, theme.primaryLight]);
  const content = nodes(tree).find(node => node.type === 'ScrollView').props.children;
  assert.ok(nodes(tree).find(node => node.type === 'ScrollView').props.contentContainerStyle.paddingBottom >= 160);
  assert.equal(content[0].props.testID, 'home-overview');
  assert.equal(content[1].type, h.entry);
  assert.equal(content[2].props.testID, 'home-recent-transactions');
  assert.equal(text(byId(tree, 'home-balance')), '₹0.00');
  assert.match(text(tree), /No transactions yet/);
  assert.match(text(byId(tree, 'home-ai-entry')), /Ask Financial AI.*Setup required/);
  assert.match(text(byId(tree, 'home-ai-entry')), /Configure the secure AI connection/);
  assert.match(byId(tree, 'home-ai-entry').props.accessibilityHint, /No data is sent automatically/);
  byId(tree, 'home-ai-entry').props.onPress();
  assert.deepEqual(h.navigated, ['AIChat']);
});

test('connected AI entry omits provider-specific connection copy', () => {
  const h = homeHarness(true), tree = h.render(), entry = byId(tree, 'home-ai-entry');
  assert.match(text(entry), /Consent required/);
  assert.doesNotMatch(text(entry), /Secure NVIDIA chat|you choose when to share/);
  assert.match(text(entry), /Ask about spending, budgets and savings/);
});

test('AI entry stays visible without displaying unverified totals during loading or errors', () => {
  const h = homeHarness();
  h.ledger.transactions = [{ id: 'partial', type: 'income', amount: 500, date: '2026-10-06', category: 'salary' }];
  h.ledger.complete = false;
  let tree = h.render();
  assert.ok(byId(tree, 'home-data-loading'));
  assert.ok(byId(tree, 'home-ai-entry'));
  assert.equal(byId(tree, 'home-balance'), undefined);
  h.ledger.complete = true;
  h.budgets.complete = false;
  assert.equal(byId(h.render(), 'home-balance'), undefined);
  h.budgets.complete = true;
  h.ledger.error = 'Offline';
  tree = h.render();
  assert.match(text(byId(tree, 'home-data-error')), /Offline/);
  assert.ok(byId(tree, 'home-ai-entry'));
  assert.equal(byId(tree, 'home-balance'), undefined);
  h.ledger.error = null;
  h.ledger.transactions[0].amount = 'invalid';
  tree = h.render();
  assert.match(text(byId(tree, 'home-data-error')), /Invalid stored amount/);
  assert.ok(byId(tree, 'home-ai-entry'));
  assert.equal(byId(tree, 'home-balance'), undefined);
});

test('Home uses corrected local to-date periods and real saved budgets for every toggle', () => {
  const h = homeHarness();
  h.ledger.transactions = [
    { id: 'food', date: '2026-10-06', type: 'expense', amount: 25.5, category: 'food', description: 'Lunch' },
    { id: 'income', date: '2026-10-02', type: 'income', amount: 1000, category: 'salary', description: 'Pay' },
    { id: 'sunday', date: '2026-10-04', type: 'expense', amount: 20, category: 'transport', description: 'Sunday travel' },
    { id: 'last-month', date: '2026-09-30', type: 'expense', amount: 60, category: 'shopping', description: 'September' },
    { id: 'future', date: '2026-10-07', type: 'expense', amount: 999, category: 'shopping', description: 'Future entry' },
  ];
  h.budgets.budgets = [
    { id: 'monthly', category: 'food', period: 'Monthly', amount: 100 },
    { id: 'weekly', category: 'food', period: 'Weekly', amount: 20 },
    { id: 'yearly', category: 'food', period: 'Yearly', amount: 1200 },
  ];
  let tree = h.render();
  assert.equal(text(byId(tree, 'home-income')), '₹1,000.00');
  assert.equal(text(byId(tree, 'home-expenses')), '₹45.50');
  assert.equal(text(byId(tree, 'home-balance')), '₹954.50');
  assert.match(text(byId(tree, 'home-budget-check')), /food: ₹25.50 of ₹100.00/);
  assert.doesNotMatch(text(byId(tree, 'home-recent-transactions')), /Future entry/);
  byId(tree, 'home-period-Weekly').props.onPress();
  tree = h.render();
  assert.equal(text(byId(tree, 'home-balance')), '-₹25.50');
  assert.match(text(byId(tree, 'home-overview')), /2026-10-05 through 2026-10-06/);
  assert.match(text(byId(tree, 'home-budget-check')), /food: ₹25.50 of ₹20.00 — exceeded/);
  assert.equal(byId(tree, 'home-period-Weekly').props.accessibilityState.selected, true);
  byId(tree, 'home-period-Yearly').props.onPress();
  tree = h.render();
  assert.equal(text(byId(tree, 'home-balance')), '₹894.50');
  assert.match(text(byId(tree, 'home-budget-check')), /food: ₹25.50 of ₹1,200.00/);
  h.ledger.transactions[0].amount = 30.5;
  assert.equal(text(byId(h.render(), 'home-balance')), '₹889.50');
});

test('Home actions and both refresh paths still use existing finance navigation and hooks', async () => {
  const h = homeHarness(), tree = h.render();
  for (const label of ['Profile', 'See all transactions', 'Add transaction', 'History', 'Budgets']) button(tree, label).props.onPress();
  assert.deepEqual(h.navigated, ['Profile', 'Transactions', 'AddTransaction', 'Transactions', 'Budget']);
  await nodes(tree).find(node => node.type === 'ScrollView').props.refreshControl.props.onRefresh();
  await h.focusRefreshes[0]();
  assert.deepEqual(h.refreshed, ['ledger', 'budgets', 'ledger', 'budgets']);
});

test('styled Home retains the shared UID identity and theme loading guard', () => {
  const user = { uid: 'fixture-owner' }, auth = { currentUser: user };
  let palette = { theme, isLoading: false };
  const { FinanceAccount } = load('components/finance/FinanceUI.js', { react: require('react'), 'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, 'react-native-vector-icons/MaterialCommunityIcons': esm('Icon'),
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, 'react-native-svg': { ...esm('Svg'), Circle: 'Circle' },
    '../../constants/Icons': icons, '../GlassCard': esm('GlassCard'), '../../utils/finance': finance,
    '../../contexts/ThemeContext': { useTheme: () => palette }, '../../contexts/AuthContext': { useAuth: () => ({ user }) },
    '../../config/firebase': { auth },
  });
  const allowed = FinanceAccount({ component: 'PersonalDashboard' });
  assert.equal(allowed.type, 'PersonalDashboard');
  assert.equal(allowed.key, user.uid);
  auth.currentUser = { uid: user.uid };
  assert.match(text(FinanceAccount({ component: 'PersonalDashboard' })), /Please sign in/);
  palette = { theme: null, isLoading: true };
  assert.ok(nodes(FinanceAccount({ component: 'PersonalDashboard' })).some(node => node.props.accessibilityLabel === 'Loading theme'));
});
