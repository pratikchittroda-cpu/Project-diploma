const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createHooks, treeNodes, treeText, plain, esm, native, theme } = require('./helpers/react-ui.cjs');
const { animatedMock } = require('./helpers/react-ui.cjs');
const backgroundColours = load('components/AppBackground.js', { react: {}, 'react-native': native, 'expo-linear-gradient': {}, 'react-native-svg': {}, '@react-navigation/native': { NavigationContext: {} },
  '../contexts/ThemeContext': {}, './GlassSurface': load('components/GlassSurface.js', { react: {}, 'react-native': native, 'expo-blur': {}, 'expo-linear-gradient': {}, 'expo-glass-effect': {} }) });

class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-06T12:00:00'])); }
}
const finance = load('utils/finance.js', {}, { Date: FixedDate });
const profileImage = load('utils/profileImage.js');
const icons = { Icon: 'Icon' };
const controls = (tree, type) => treeNodes(tree).filter(node => node.type === type);
const control = (tree, type, key, value) => controls(tree, type).find(node => node.props[key] === value);
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function financeUI(hooks, auth, account) {
  return load('components/finance/FinanceUI.js', {
    react: hooks.react, 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, 'react-native-svg': { ...esm('Svg'), Circle: 'Circle' },
    '../../constants/Icons': icons, '../GlassCard': esm('GlassCard'), '../AppBackground': esm('AppBackground'), '../LogoLoader': esm('LogoLoader'), '../../utils/finance': finance,
    '../../contexts/ThemeContext': { useTheme: () => ({ theme, isDarkMode: false }) },
    '../../contexts/AuthContext': { useAuth: () => account }, '../../config/firebase': { auth },
  });
}
function financeHarness(file, { company = false, report = false } = {}) {
  const hooks = createHooks(), user = { uid: 'fixture-owner' }, auth = { currentUser: user };
  const account = { user, userData: { fullName: 'Fixture', companyName: 'Fixture Company' } };
  const writes = [], navigated = [], backed = [];
  const ledger = { complete: true, error: null, refreshing: false, transactions: [], refresh: async () => {},
    addTransaction: async fields => { writes.push(['transaction', fields]); return { success: true }; },
    deleteTransaction: async id => { writes.push(['delete', id]); return { success: true }; } };
  const budgets = { complete: true, error: null, refreshing: false, budgets: [], refresh: async () => {},
    createBudget: async fields => { writes.push(['budget', fields]); return { success: true }; } };
  const history = { rows: [], hasMore: false, loading: false, error: null, refresh: async () => {}, loadMore: async () => {} };
  const ui = financeUI(hooks, auth, account);
  const mockedUI = { ...ui };
  for (const [name, value] of Object.entries(ui)) if (typeof value === 'function' && !name.startsWith('use') && name !== 'categoryDetails') mockedUI[name] = name;
  const navigation = { navigate: route => navigated.push(route), goBack: () => backed.push('goBack'), canGoBack: () => true, addListener: () => () => {} };
  const Screen = load(file, {
    react: hooks.react, 'react-native': native,
    'react-native-svg': { ...esm('Svg'), Circle: 'Circle', Line: 'Line', Path: 'Path', Text: 'SvgText' },
    '../../constants/Icons': icons, '../../contexts/AuthContext': { useAuth: () => account },
    '../../config/firebase': { auth }, './AITransactionTools': esm('AITransactionTools'),
    '../../hooks/useTransactions': { useTransactions: () => ledger, useTransactionHistory: () => history },
    '../../hooks/useBudgets': { useBudgets: () => budgets }, '../../utils/finance': finance,
    '../../utils/profileImage': profileImage, './HomeAIEntry': esm('HomeAIEntry'), './FinanceUI': mockedUI,
    '../../utils/budgetRecommendations': { getBudgetRecommendations: () => [] }, '../BudgetAdvisor': esm('BudgetAdvisor'),
    '../../services/MessageService': esm({ showConfirm: (_title, _body, confirm) => confirm() }),
  }, { Date: FixedDate }).default;
  return { hooks, ledger, budgets, history, writes, navigated, backed, auth, user,
    render: () => hooks.render(() => Screen({ navigation, company, report }).props.component({ navigation, company, report })),
  };
}

test('restored transaction forms save validated numeric personal/company entries through existing hooks', async () => {
  for (const company of [false, true]) {
    const h = financeHarness('components/finance/FinanceTransactionForm.js', { company });
    let tree = h.render();
    control(tree, 'Field', 'label', 'Amount (INR)').props.onChangeText('125.35');
    control(tree, 'Field', 'label', 'Description').props.onChangeText('Synthetic expense');
    tree = h.render();
    await control(tree, 'Button', 'title', 'Save transaction').props.onPress();
    assert.equal(h.writes.length, 1);
    const saved = plain(h.writes[0][1]);
    assert.equal(saved.amount, 125.35);
    assert.equal(saved.type, 'expense');
    assert.equal(saved.date, '2026-10-06');
    assert.equal(saved.category, company ? 'office-supplies' : 'food');
    if (company) { assert.equal(saved.companyId, 'fixture-owner'); assert.equal(saved.department, 'General'); }
    else assert.equal(saved.companyId, undefined);
    assert.match(control(h.render(), 'Notice', 'message', 'Saved expense of ₹125.35.').props.message, /Saved/);
    h.hooks.unmount();
  }
});

test('restored history keeps complete-ledger totals separate from paginated and filtered rows', () => {
  const h = financeHarness('components/finance/FinanceHistoryScreen.js');
  h.ledger.transactions = Array.from({ length: 31 }, (_, i) => ({ id: String(i).padStart(3, '0'), date: '2026-10-06',
    type: i ? 'expense' : 'income', amount: i ? 10 : 1000, category: i ? 'food' : 'salary', description: `Synthetic ${i}` }));
  h.history.rows = h.ledger.transactions.slice(0, 20);
  let tree = h.render();
  let overview = controls(tree, 'LedgerOverview')[0];
  assert.equal(overview.props.stats.count, 31);
  assert.equal(overview.props.stats.netAmount, 700);
  assert.equal(controls(tree, 'TransactionRow').length, 20);
  control(tree, 'Field', 'label', 'Search loaded history').props.onChangeText('Synthetic 19');
  tree = h.render();
  assert.equal(controls(tree, 'TransactionRow').length, 1);
  assert.equal(controls(tree, 'LedgerOverview')[0].props.stats.count, 31);
  h.ledger.error = 'Offline';
  assert.equal(controls(h.render(), 'LedgerOverview').length, 0);
  h.hooks.unmount();
});

test('history header centers icon actions and provides personal/company back actions', () => {
  for (const company of [false, true]) {
    const h = financeHarness('components/finance/FinanceHistoryScreen.js', { company });
    const page = controls(h.render(), 'FinancePage')[0];
    assert.equal(page.props.showBack, true);
    page.props.onBack();
    assert.deepEqual(h.backed, company ? ['goBack'] : []);
    assert.deepEqual(h.navigated, company ? [] : ['Home']);
    page.props.actions.props.onPress();
    assert.deepEqual(h.navigated, company ? ['AddCompanyTransactionDetail'] : ['Home', 'AddTransaction']);
    h.hooks.unmount();
  }
});

test('icon-only buttons center both plus and back glyphs inside their hit areas', () => {
  const hooks = createHooks(), ui = financeUI(hooks, { currentUser: { uid: 'fixture-owner' } }, { user: { uid: 'fixture-owner' } });
  for (const icon of ['plus', 'arrow-left']) {
    const tree = hooks.render(() => ui.Button({ title: icon, icon, onPress() {} }));
    const content = (Array.isArray(tree.props.children) ? tree.props.children : [tree.props.children]).find(child => child?.type === 'View');
    assert.deepEqual(plain(content.props.style), { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' });
    assert.deepEqual(plain(content.props.children.props.style), { width: 24, height: 24, lineHeight: 24, textAlign: 'center', textAlignVertical: 'center' });
  }
  hooks.unmount();
});

test('reviewed receipt assistance fills exact paise in an unsaved form and rejects stale draft application', async () => {
  const h = financeHarness('components/finance/FinanceTransactionForm.js');
  let tools = controls(h.render(), 'AITransactionTools')[0];
  const snapshot = { ...tools.props.getDraftSnapshot(), user: h.user };
  assert.equal(tools.props.onApplyReceiptItem({ name: 'Synthetic item', quantity: 3, price: 12.35 }, snapshot), true);
  let tree = h.render();
  assert.equal(control(tree, 'Field', 'label', 'Amount (INR)').props.value, '37.05');
  assert.equal(h.writes.length, 0);
  tools = controls(tree, 'AITransactionTools')[0];
  assert.equal(tools.props.onApplyReceiptItem({ name: 'Old result', quantity: 1, price: 5 }, snapshot), false);
  await control(tree, 'Button', 'title', 'Save transaction').props.onPress();
  assert.equal(h.writes[0][1].amount, 37.05);
  assert.equal(h.writes[0][1].description, 'Synthetic item');
  h.hooks.unmount();
});

function accountPrimitives(hooks) {
  return load('components/account/AccountPrimitives.js', {
    react: hooks.react, 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, '../../contexts/ThemeContext': { useTheme: () => ({ theme }) },
    '../../constants/Icons': icons, '../../utils/profileImage': profileImage, '../GlassCard': esm('GlassCard'), '../AppBackground': esm('AppBackground'), '../LogoLoader': esm('LogoLoader'), '../BrandLogo': esm('BrandLogo'),
  });
}

test('restored account fields keep controlled values and provide accessible password visibility', () => {
  const hooks = createHooks(), ui = accountPrimitives(hooks);
  const props = { label: 'Password', value: 'synthetic-password', secureTextEntry: true, onChangeText() {} };
  let tree = hooks.render(() => ui.AccountField(props));
  assert.equal(controls(tree, 'TextInput')[0].props.secureTextEntry, true);
  control(tree, 'TouchableOpacity', 'accessibilityLabel', 'Show password').props.onPress();
  tree = hooks.render(() => ui.AccountField(props));
  assert.equal(controls(tree, 'TextInput')[0].props.secureTextEntry, false);
  assert.equal(controls(tree, 'TextInput')[0].props.value, props.value);
  assert.equal(control(tree, 'TouchableOpacity', 'accessibilityLabel', 'Hide password').props.disabled, false);
  const screen = ui.AccountScreen({ title: 'Profile', children: 'Fixture' });
  const background = treeNodes(screen, false).find(node => node.type === 'AppBackground');
  assert.equal(background.props.colors.length, 2);
  hooks.unmount();
});

test('restored personal/company sign-in forms call matching auth flows and cannot bypass missing Google setup', async () => {
  for (const company of [false, true]) {
    const hooks = createHooks(), ui = accountPrimitives(hooks), calls = [], routes = [];
    const primitives = { ...ui };
    for (const name of ['AccountButton', 'AccountCard', 'AccountField', 'AccountScreen', 'AccountText']) primitives[name] = name;
    const Form = load('components/account/AccountAuthForm.js', {
      react: hooks.react, 'react-native': native, '../../contexts/ThemeContext': { useTheme: () => ({ theme }) },
      '../../contexts/AuthContext': { useAuth: () => ({ loading: false,
        signIn: async (...args) => { calls.push(['password', ...args]); return { success: true }; },
        signInWithGoogle: async () => { calls.push(['google']); return { success: true }; },
      }) }, '../../constants/Icons': icons, '../../utils/googleAuth': { getGoogleAuthSetup: () => ({ isConfigured: false, reason: 'OAuth setup required.' }) },
      '../../services/MessageService': esm({ showError: () => assert.fail('Unexpected auth error') }),
      './AccountPrimitives': primitives, '../../assets/g_logo.png': 'synthetic-google-logo',
    }).default;
    const render = () => hooks.render(() => Form({ navigation: { navigate: route => routes.push(route) }, accountType: company ? 'company' : 'personal' }));
    let tree = render();
    control(tree, 'AccountField', 'label', company ? 'Company email' : 'Email').props.onChangeText('fixture@example.test');
    control(tree, 'AccountField', 'label', 'Password').props.onChangeText('synthetic-password');
    tree = render();
    await control(tree, 'AccountButton', 'title', 'Sign In').props.onPress();
    assert.deepEqual(calls, [['password', 'fixture@example.test', 'synthetic-password', company ? 'company' : 'personal']]);
    const google = control(render(), 'AccountButton', 'title', 'Continue with Google');
    assert.equal(google.props.disabled, true);
    await google.props.onPress();
    assert.equal(calls.length, 1);
    assert.deepEqual(routes, []); // Auth-driven navigation decides readiness and account recovery.
    hooks.unmount();
  }
});

test('account recovery invokes setup and keeps backend failures visible instead of looking inert', async () => {
  const hooks = createHooks(), calls = [], errors = [];
  const account = {
    user: { uid: 'fixture-owner', email: 'fixture@example.test' },
    userData: { uid: 'fixture-owner', userType: 'personal', fullName: 'Fixture User' },
    profileStatus: 'incomplete', profileError: 'Complete your account setup.', loading: false,
    completeProfile: async data => { calls.push(data); return { success: false, error: 'Permission denied while saving profile.' }; },
    refreshUserData: async () => {},
  };
  const Recovery = load('components/account/AccountRecovery.js', {
    react: hooks.react, 'react-native': native, '../../contexts/AuthContext': { useAuth: () => account },
    '../../contexts/ThemeContext': { useTheme: () => ({ theme }) }, '../../constants/Icons': icons,
    '../../services/MessageService': esm({ showError: (...args) => errors.push(args) }),
    './AccountPrimitives': { AccountButton: 'AccountButton', AccountCard: 'AccountCard', AccountField: 'AccountField',
      AccountRow: 'AccountRow', AccountScreen: 'AccountScreen', AccountSection: 'AccountSection', AccountText: 'AccountText',
      useAccountTask: () => ({ busy: false, run: task => task(() => true) }) },
    './AccountActions': { useAccountActions: () => ({ requestSignOut() {}, requestDelete() {}, deletionAvailable: false }) },
  }).default;
  const render = () => hooks.render(() => Recovery({ navigation: { navigate() {}, canGoBack: () => false } }));
  let tree = render();
  await control(tree, 'AccountButton', 'title', 'Complete Setup').props.onPress();
  assert.deepEqual(plain(calls), [{ userType: 'personal', fullName: 'Fixture User' }]);
  assert.match(treeText(render()), /Permission denied while saving profile/);
  assert.deepEqual(errors, [['Setup not saved', 'Permission denied while saving profile.']]);
  hooks.unmount();
});

test('restored floating tabs preserve prevention, previous-tab return, long press and keyboard hiding', () => {
  const hooks = createHooks(), keyboard = new Map(), calls = [];
  let prevent = false;
  const state = { routes: [{ name: 'Home', key: 'home' }, { name: 'Transactions', key: 'history' }, { name: 'AddTransaction', key: 'add' }], index: 1 };
  const Bar = load('navigation/SharedTabBar.js', {
    '../components/AppBackground': backgroundColours, '../theme/fonts': { brandFontsReady: () => false },
    react: hooks.react, 'react-native': { ...native, Animated: animatedMock(), Easing: { out: x => x, quad: x => x, cubic: x => x }, Keyboard: { isVisible: () => false, addListener: (event, fn) => {
      keyboard.set(event, fn); return { remove: () => keyboard.delete(event) };
    } } }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' }, 'expo-blur': { BlurView: 'Blur' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
    '../contexts/ThemeContext': { useTheme: () => ({ theme, isLoading: false, isDarkMode: false }) },
    '../screens/personal/SplashScreen': esm('SplashScreen'), '../components/account/AccountPrimitives': { accountGradientColors: () => [theme.primary, theme.primaryLight] },
  }).default;
  const navigation = { emit: event => { calls.push(['event', event.type, event.target]); return { defaultPrevented: prevent }; }, navigate: route => calls.push(['navigate', route]) };
  const render = () => hooks.render(() => Bar({ state, navigation, addRouteName: 'AddTransaction', initialRouteName: 'Home', icons: {}, descriptors: {} }));
  const tab = (tree, label) => treeNodes(tree, false).find(node => node.props.accessibilityLabel === label);
  let tree = render();
  tab(tree, 'Add transaction').props.onPress();
  state.index = 2;
  tree = render();
  tab(tree, 'Close add transaction').props.onPress();
  assert.deepEqual(calls.filter(call => call[0] === 'navigate'), [['navigate', 'AddTransaction'], ['navigate', 'Transactions']]);
  prevent = true;
  tab(tree, 'Home').props.onPress();
  assert.equal(calls.filter(call => call[0] === 'navigate').length, 2);
  tab(tree, 'Home').props.onLongPress();
  assert.deepEqual(calls.at(-1), ['event', 'tabLongPress', 'home']);
  keyboard.get('keyboardDidShow')();
  assert.equal(render(), null);
  keyboard.get('keyboardDidHide')();
  assert.ok(render());
  hooks.unmount();
  assert.equal(keyboard.size, 0);
});

test('restored budget form delegates one coherent save while retaining the synchronous duplicate lock', async () => {
  const h = financeHarness('components/finance/FinanceBudgetScreen.js');
  let tree = h.render();
  control(tree, 'Button', 'title', 'Add budget').props.onPress();
  tree = h.render();
  control(tree, 'Field', 'label', 'Monthly amount (INR)').props.onChangeText('350.00');
  controls(tree, 'CategoryChoices')[0].props.onSelect('transport');
  tree = h.render();
  const pending = defer();
  h.budgets.createBudget = fields => { h.writes.push(['budget', fields]); return pending.promise; };
  const saving = control(tree, 'Button', 'title', 'Save all periods').props.onPress();
  await control(tree, 'Button', 'title', 'Save all periods').props.onPress();
  assert.equal(h.writes.length, 1);
  assert.deepEqual(plain(h.writes[0][1]), { category: 'transport', categoryName: 'Transport', amount: 350, period: 'Monthly', type: 'personal' });
  pending.resolve({ success: true }); await saving;
  assert.equal(controls(h.render(), 'CategoryChoices').length, 0);
  h.hooks.unmount();
});

test('restored reports plot real local-period ledger data and company AI entry stays reachable while loading', () => {
  const h = financeHarness('components/finance/FinanceSummaryScreen.js', { company: true, report: true });
  h.ledger.transactions = [
    { id: 'revenue', date: '2026-10-02', type: 'income', amount: 1000, category: 'sales', description: 'Synthetic sale' },
    { id: 'expense', date: '2026-10-06', type: 'expense', amount: 25, category: 'office-supplies', department: 'Operations', description: 'Synthetic supplies' },
    { id: 'old', date: '2026-09-30', type: 'expense', amount: 100, category: 'office-supplies', description: 'Previous period' },
    { id: 'future', date: '2026-10-07', type: 'expense', amount: 999, category: 'office-supplies', description: 'Future entry' },
  ];
  let tree = h.render();
  const raw = () => treeNodes(tree, false);
  const trend = () => raw().find(node => node.type?.name === 'TrendChart').props.data;
  assert.deepEqual(plain(trend().map(point => [point.income, point.expense])), [[1000, 0], [0, 25]]);
  assert.equal(raw().find(node => node.type?.name === 'DepartmentExpense').props.department.spent, 25);
  controls(tree, 'Choices')[0].props.onSelect('Weekly');
  tree = h.render();
  assert.deepEqual(plain(trend().map(point => [point.income, point.expense])), [[0, 0], [0, 25]]);
  h.hooks.unmount();
  const home = financeHarness('components/finance/FinanceSummaryScreen.js', { company: true });
  home.ledger.complete = false;
  const loading = home.render();
  assert.equal(controls(loading, 'HomeAIEntry').length, 1);
  assert.equal(controls(loading, 'LedgerOverview').length, 0);
  home.hooks.unmount();
});

test('restored prompt dialog forwards current input once and does not steal dismissal from its provider', async () => {
  const hooks = createHooks(), pending = defer(), submitted = [];
  let dismissals = 0;
  const Animated = { View: 'AnimatedView', Value: class { setValue() {} interpolate() { return 0; } },
    timing: () => ({ start() {}, stop() {} }) };
  const Box = load('components/ThemedMessageBox.js', {
    react: hooks.react, 'react-native': { ...native, Modal: 'Modal', Animated,
      BackHandler: { addEventListener: () => ({ remove() {} }) } },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
    '../contexts/ThemeContext': { useTheme: () => ({ theme, isDarkMode: false }) },
    './account/AccountPrimitives': { accountGradientColors: () => [theme.primary, theme.primaryLight] },
    './GlassSurface': esm('GlassSurface'), './LogoLoader': esm('LogoLoader'),
  }).default;
  const props = { visible: true, type: 'confirm', title: 'Synthetic prompt', showInput: true, initialValue: 'initial',
    buttons: [{ text: 'Confirm', onPress: value => { submitted.push(value); return pending.promise; } }],
    onDismiss: () => { dismissals++; } };
  const render = () => hooks.render(() => Box(props));
  let tree = render();
  controls(tree, 'TextInput')[0].props.onChangeText('edited');
  tree = render();
  const confirm = controls(tree, 'TouchableOpacity').find(node => treeText(node) === 'Confirm');
  const pressing = confirm.props.onPress();
  await confirm.props.onPress();
  render().props.onRequestClose();
  assert.deepEqual(submitted, ['edited']);
  assert.equal(dismissals, 0);
  pending.resolve(); await pressing;
  assert.equal(dismissals, 0);
  render().props.onRequestClose();
  assert.equal(dismissals, 1);
  hooks.unmount();
});

test('toasts sit over the top of the screen and drop in from above without blocking the page', () => {
  const hooks = createHooks();
  const Animated = animatedMock();
  const Box = load('components/ThemedMessageBox.js', {
    react: hooks.react, 'react-native': { ...native, Modal: 'Modal', Animated, useWindowDimensions: () => ({ width: 402, height: 874 }),
      BackHandler: { addEventListener: () => ({ remove() {} }) } },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
    '../contexts/ThemeContext': { useTheme: () => ({ theme, isDarkMode: false }) },
    './account/AccountPrimitives': { accountGradientColors: () => [theme.primary, theme.primaryLight] },
    './GlassSurface': esm('GlassSurface'), './LogoLoader': esm('LogoLoader'),
  }).default;
  const tree = hooks.render(() => Box({ visible: true, type: 'success', title: 'Profile saved', message: 'Your profile details were saved.', autoHide: false }));
  const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  const overlay = flat(tree.props.style);
  // A full-screen overlay pinned to the top edge, below the status bar / notch.
  assert.deepEqual([overlay.position, overlay.top, overlay.left, overlay.right, overlay.bottom], ['absolute', 0, 0, 0, 0]);
  assert.equal(overlay.justifyContent, 'flex-start');
  assert.equal(overlay.paddingTop, 59 + 8);
  assert.equal(tree.props.pointerEvents, 'box-none'); // the page underneath stays usable
  // It springs down from above the screen edge on the native driver.
  const toast = tree.props.children;
  assert.deepEqual(Array.from(flat(toast.props.style).transform[0].translateY.interpolation.outputRange), [-120, 0]);
  const entrance = Animated.started.at(-1);
  assert.equal(entrance.useNativeDriver, true);
  assert.ok('stiffness' in entrance);
  hooks.unmount();
});
