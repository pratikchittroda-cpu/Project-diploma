const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createHooks, treeNodes, treeText, plain, esm, native } = require('./helpers/react-ui.cjs');

const flatten = style => Array.isArray(style)
  ? Object.assign({}, ...style.map(flatten)) : style || {};
const nativeUI = { ...native, StyleSheet: { ...native.StyleSheet, flatten } };
const icons = { Icon: 'Icon', AppIcons: { Profile: 'ProfileIcon', Income: 'IncomeIcon', Expense: 'ExpenseIcon' } };
const finance = load('utils/finance.js');
const profileImage = load('utils/profileImage.js');
const tick = () => new Promise(resolve => setImmediate(resolve));

function themeHarness(saved = {}) {
  const hooks = createHooks(), storage = new Map(Object.entries(saved));
  const writes = [];
  const context = load('contexts/ThemeContext.js', {
    react: hooks.react,
    '@react-native-async-storage/async-storage': esm({
      getItem: async key => storage.get(key) ?? null,
      setItem: async (key, value) => { storage.set(key, value); writes.push([key, value]); },
    }),
  });
  return { ...context, hooks, storage, writes,
    render: () => hooks.render(() => context.ThemeProvider({ children: 'Fixture' })).props.value,
  };
}

function uiHarness(initialTheme, platform = 'ios') {
  const hooks = createHooks();
  let theme = initialTheme;
  const environment = { ...nativeUI, Platform: { OS: platform } };
  const useTheme = () => ({ theme, isDarkMode: theme.isDarkMode, isLoading: false });
  const GlassCard = load('components/GlassCard.js', {
    react: hooks.react, 'react-native': environment, 'expo-blur': { BlurView: 'Blur' },
    '../contexts/ThemeContext': { useTheme },
  }).default;
  const account = load('components/account/AccountPrimitives.js', {
    react: hooks.react, 'react-native': environment,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, '../../contexts/ThemeContext': { useTheme },
    '../../constants/Icons': icons, '../../utils/profileImage': profileImage, '../GlassCard': esm(GlassCard), '../BrandLogo': esm('BrandLogo'),
  });
  const ui = load('components/finance/FinanceUI.js', {
    react: hooks.react, 'react-native': environment,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, 'react-native-svg': { ...esm('Svg'), Circle: 'Circle' },
    '../../constants/Icons': icons, '../GlassCard': esm(GlassCard), '../../utils/finance': finance,
    '../../contexts/ThemeContext': { useTheme }, '../../contexts/AuthContext': { useAuth: () => ({}) },
    '../../config/firebase': { auth: {} },
  });
  return { hooks, ui, account, GlassCard, environment, useTheme,
    setTheme: next => { theme = next; },
  };
}

function luminance(color) {
  assert.match(color, /^#[\da-f]{6}$/i);
  return [1, 3, 5].reduce((sum, offset, index) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}
function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function blend(foreground, background) {
  const alpha = parseInt(foreground.slice(7, 9), 16) / 255;
  return '#' + [1, 3, 5].map(offset => Math.round(parseInt(foreground.slice(offset, offset + 2), 16) * alpha
    + parseInt(background.slice(offset, offset + 2), 16) * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}

function tabHarness(initialTheme, company = false, insets = { top: 59, bottom: 34, left: 0, right: 0 }) {
  const hooks = createHooks(), keyboard = new Map(), navigated = [], emitted = [];
  let theme = initialTheme, prevent = false;
  const useTheme = () => ({ theme, isDarkMode: theme.isDarkMode, isLoading: false });
  class Value {
    constructor(value) { this.value = value; }
    interpolate({ outputRange }) { return outputRange[this.value ? 1 : 0]; }
  }
  const Animated = { View: 'AnimatedView', Value,
    spring: (value, { toValue }) => ({ start: () => { value.value = toValue; }, stop() {} }) };
  const Bar = load('navigation/SharedTabBar.js', {
    react: hooks.react, 'react-native': { ...nativeUI, Animated, Keyboard: { isVisible: () => false,
      addListener: (name, fn) => { keyboard.set(name, fn); return { remove: () => keyboard.delete(name) }; } } },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' }, 'expo-blur': { BlurView: 'Blur' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => insets },
    '../contexts/ThemeContext': { useTheme }, '../screens/personal/SplashScreen': esm('Splash'),
    '../components/account/AccountPrimitives': { accountGradientColors: uiHarness(theme).account.accountGradientColors },
  }).default;
  const screenNames = company ? ['CompanyDashboard', 'CompanyReports', 'TeamManagement', 'CompanyBudget', 'AddCompanyTransaction']
    : ['Dashboard', 'AddTransaction', 'Transactions', 'Budget', 'Stats'];
  const navigatorMocks = Object.fromEntries(screenNames.map(name => [`../screens/${company ? 'company' : 'personal'}/${name}Screen`, esm('Screen')]));
  const Navigator = load(`navigation/${company ? 'CompanyTabNavigator' : 'TabNavigator'}.js`, {
    ...navigatorMocks, react: hooks.react, 'react-native': nativeUI,
    '@react-navigation/bottom-tabs': { createBottomTabNavigator: () => ({ Navigator: 'Tabs', Screen: 'TabScreen' }) },
    '../contexts/ThemeContext': { useTheme }, './SharedTabBar': { ...esm('SharedTabBar'), TabLoadingState: 'Splash', tabScreenOptions: {} },
  }).default;
  const tabs = Navigator().props.children;
  const routes = tabs.props.children.map(screen => ({ name: screen.props.name, key: screen.props.name }));
  const descriptors = Object.fromEntries(tabs.props.children.map(screen => [screen.props.name, { options: screen.props.options }]));
  const state = { routes, index: 1 };
  const navigation = { emit: event => { emitted.push(event); return { defaultPrevented: prevent }; }, navigate: route => navigated.push(route) };
  const props = tabs.props.tabBar({ state, descriptors, navigation }).props;
  return { hooks, keyboard, navigated, emitted, state, descriptors, routes, insets,
    setTheme: next => { theme = next; }, prevent: value => { prevent = value; },
    render: () => hooks.render(() => { const tree = Bar(props); return { tree, nodes: treeNodes(tree) }; }),
  };
}

test('personal/company floating pills have visible labels, balanced targets, a width cap and safe-area clearance', () => {
  const { lightTheme, darkTheme } = themeHarness();
  for (const company of [false, true]) {
    for (const insets of [{ bottom: 0, left: 0, right: 0 }, { bottom: 34, left: 0, right: 0 }, { bottom: 21, left: 44, right: 44 }]) {
      const h = tabHarness(lightTheme, company, insets);
      for (const theme of [lightTheme, darkTheme, lightTheme]) {
        h.setTheme(theme);
        const { tree, nodes } = h.render();
         const wrapper = flatten(tree.props.style), bar = flatten(tree.props.children.props.style);
          assert.equal(wrapper.position, 'absolute');
          assert.equal(wrapper.left, 0);
          assert.equal(wrapper.right, 0);
          assert.equal(wrapper.bottom, 0);
          assert.equal(wrapper.width, '100%');
         assert.equal(wrapper.height, 64 + Math.max(insets.bottom, 12) + 8);
         assert.ok(wrapper.paddingLeft >= Math.max(insets.left, 16));
         assert.ok(wrapper.paddingRight >= Math.max(insets.right, 16));
         assert.ok(bar.maxWidth <= 520);
        assert.equal(bar.backgroundColor, theme.tabBar);
        assert.equal(bar.borderColor, theme.border);
         assert.equal(bar.height, 64);
        const buttons = nodes.filter(node => node.type === 'Pressable');
        assert.equal(buttons.length, 5);
        assert.deepEqual(buttons.map(treeText), company ? ['Home', 'Reports', 'Add', 'Team', 'Budget'] : ['Home', 'History', 'Add', 'Budget', 'Stats']);
        for (const button of buttons) {
          const style = flatten(button.props.style({ pressed: false }));
          assert.ok(style.minHeight >= 44 && style.minWidth >= 44);
           const viewportWidth = insets.left || insets.right ? 852 : 320;
           const horizontalPadding = wrapper.paddingLeft + wrapper.paddingRight;
           assert.ok((Math.min(viewportWidth - horizontalPadding, bar.maxWidth) - 2 * bar.paddingHorizontal - 2 * bar.borderWidth) / 5 >= 44);
          assert.equal(style.marginTop, undefined);
        }
        assert.equal(buttons[1].props.accessibilityState.selected, true);
        assert.equal(buttons[1].props.accessibilityLabel, company ? 'Reports' : 'Transactions');
      }
      h.hooks.unmount(); assert.equal(h.keyboard.size, 0);
    }
  }
});

test('floating Add/Close preserves previous-tab return, prevention, long press, test IDs and keyboard overrides', () => {
  const { lightTheme } = themeHarness();
  for (const company of [false, true]) {
    const h = tabHarness(lightTheme, company);
    const buttons = () => h.render().nodes.filter(node => node.type === 'Pressable');
    h.descriptors[h.routes[0].key].options.tabBarButtonTestID = 'home-tab';
    assert.equal(buttons()[0].props.testID, 'home-tab');
    buttons()[2].props.onPress();
    h.state.index = 2;
    assert.equal(treeText(buttons()[2]), 'Close');
    assert.equal(buttons()[2].props.accessibilityLabel, 'Close add transaction');
    buttons()[2].props.onPress();
    assert.deepEqual(h.navigated, [h.routes[2].name, h.routes[1].name]);
    h.prevent(true); buttons()[0].props.onPress();
    assert.equal(h.navigated.length, 2);
    buttons()[0].props.onLongPress();
    assert.equal(h.emitted.at(-1).type, 'tabLongPress');
    assert.equal(h.emitted.at(-1).target, h.routes[0].key);
    h.keyboard.get('keyboardDidShow')();
    assert.equal(h.render().tree, null);
    h.descriptors[h.routes[2].key].options.tabBarHideOnKeyboard = false;
    assert.ok(h.render().tree);
    h.keyboard.get('keyboardDidHide')();
    assert.ok(h.render().tree);
    h.hooks.unmount(); assert.equal(h.keyboard.size, 0);
  }
});

test('appearance applies immediately, persists locally and restores both mode and colour theme', async () => {
  const h = themeHarness({ isDarkMode: 'true', currentThemeId: 'ocean' });
  assert.equal(h.render().isLoading, true);
  await tick();
  let state = h.render();
  assert.equal(state.isLoading, false);
  assert.equal(state.isDarkMode, true);
  assert.equal(state.theme.isDarkMode, true);
  assert.equal(state.theme.primary, h.themeConfigs.ocean.primary);
  const oldBackground = state.theme.pageGradientColors[0];
  const toggling = state.toggleTheme();
  state = h.render();
  assert.equal(state.isDarkMode, false);
  assert.notEqual(state.theme.pageGradientColors[0], oldBackground);
  await toggling;
  await state.changeTheme('cotton');
  assert.equal(h.render().theme.primary, h.themeConfigs.cotton.primary);
  assert.deepEqual(h.writes, [['isDarkMode', 'false'], ['currentThemeId', 'cotton']]);
  const restored = themeHarness(Object.fromEntries(h.storage));
  restored.render(); await tick();
  assert.equal(restored.render().isDarkMode, false);
  assert.equal(restored.render().currentThemeId, 'cotton');
  h.hooks.unmount(); restored.hooks.unmount();
});

test('every catalogue theme has readable card/status/tab foregrounds in both modes without changing swatches', async () => {
  const h = themeHarness(); h.render(); await tick();
  for (const config of Object.values(h.themeConfigs)) {
    await h.render().changeTheme(config.id);
    for (const dark of [false, true]) {
      if (h.render().isDarkMode !== dark) await h.render().toggleTheme();
      const theme = h.render().theme;
      assert.equal(theme.primary, config.primary);
      assert.equal(theme.primaryLight, config.primaryLight);
      for (const foreground of ['text', 'textSecondary', 'accent', 'successForeground', 'errorForeground', 'warningForeground']) {
        assert.ok(contrast(theme[foreground], theme.cardBackground) >= 4.5, `${config.id}/${dark}/${foreground}`);
      }
      assert.ok(contrast(theme.accent, theme.tabBar) >= 4.5, `${config.id}/${dark}/tab`);
      assert.ok(contrast(theme.accent, blend(theme.primaryContainer, theme.tabBar)) >= 4.5, `${config.id}/${dark}/active tab`);
      for (const colour of theme.pageGradientColors) assert.ok(contrast('#FFFFFF', colour) >= 4.5);
      if (dark) for (const colour of theme.pageGradientColors) assert.ok(luminance(colour) < luminance(theme.cardBackground));
    }
  }
  h.hooks.unmount();
});

test('glass cards use one identical light/dark surface on iOS and Android and respect caller styles', () => {
  const { lightTheme, darkTheme } = themeHarness();
  for (const theme of [lightTheme, darkTheme]) {
    for (const platform of ['ios', 'android']) {
      const h = uiHarness(theme, platform);
      const card = h.GlassCard({ children: 'Fixture', testID: 'card', borderWidth: 1 });
      const layers = treeNodes(card).filter(node => flatten(node.props.style).backgroundColor);
      assert.equal(layers.length, 1);
      assert.equal(flatten(layers[0].props.style).backgroundColor, theme.cardBackground);
      assert.equal(flatten(card.props.style).borderColor, theme.border);
      assert.equal(card.props.testID, 'card');
      assert.equal(treeNodes(card).some(node => node.type === 'Blur'), false);
      const custom = h.GlassCard({ children: 'Fixture', intensity: 200, backgroundColor: '#123456',
        style: [{ padding: 8 }, { backgroundColor: '#234567', borderRadius: 12 }] });
      assert.equal(flatten(custom.props.style).padding, 8);
      assert.equal(flatten(custom.props.style).borderRadius, 12);
      const customLayers = treeNodes(custom).filter(node => flatten(node.props.style).backgroundColor);
      assert.equal(customLayers.length, 1);
      assert.equal(flatten(customLayers[0].props.style).backgroundColor, '#234567');
      const blur = treeNodes(custom).find(node => node.type === 'Blur');
      if (platform === 'ios') { assert.equal(blur.props.intensity, 100); assert.equal(blur.props.tint, theme.isDarkMode ? 'dark' : 'light'); }
      else assert.equal(blur, undefined);
      h.hooks.unmount();
    }
  }
});

test('finance and account cards share the themed surface without an extra dark content tint', () => {
  const { lightTheme, darkTheme } = themeHarness();
  for (const theme of [lightTheme, darkTheme]) {
    const palettes = [];
    for (const platform of ['ios', 'android']) {
      const h = uiHarness(theme, platform);
      const card = h.ui.Card({ children: 'Fixture', padding: 22 });
      const palette = card.props.children.props.value;
      palettes.push(plain(palette));
      assert.equal(palette.ink, theme.text);
      assert.equal(palette.card, theme.cardBackground);
      assert.equal(palette.light, !theme.isDarkMode);
      const content = card.props.children.props.children;
      assert.equal(flatten(content.props.style).backgroundColor, undefined);
      assert.equal(flatten(content.props.style).padding, 22);
      for (const component of [card, h.account.AccountCard({ children: 'Fixture' }),
        h.account.AccountRow({ title: 'Appearance' })]) {
        const backgrounds = treeNodes(component).filter(node => flatten(node.props.style).backgroundColor);
        assert.equal(backgrounds.length, 1);
        assert.equal(flatten(backgrounds[0].props.style).backgroundColor, theme.cardBackground);
      }
      h.hooks.unmount();
    }
    assert.deepEqual(palettes[0], palettes[1]);
  }
});

test('finance pages and account settings change backdrop with mode while preserving readable gradient labels', () => {
  const { lightTheme, darkTheme } = themeHarness();
  const h = uiHarness(lightTheme);
  for (const theme of [lightTheme, darkTheme, lightTheme]) {
    h.setTheme(theme);
    const page = h.ui.FinancePage({ title: 'Budget', children: 'Fixture' });
    const account = h.account.AccountScreen({ title: 'Settings', children: 'Fixture' });
    for (const screen of [page, account]) {
      const gradient = treeNodes(screen, false).find(node => node.type === 'Gradient');
      assert.deepEqual(plain(gradient.props.colors), plain(theme.pageGradientColors));
      for (const colour of gradient.props.colors) assert.ok(contrast('#FFFFFF', colour) >= 4.5);
      const bar = treeNodes(screen, false).find(node => node.type === 'StatusBar');
      assert.equal(bar.props.backgroundColor, gradient.props.colors[0]);
    }
    assert.ok(flatten(treeNodes(page, false).find(node => node.type === 'ScrollView').props.contentContainerStyle).paddingBottom >= 160);
  }
  h.hooks.unmount();
});

test('Home overview, transactions and AI entry use the same mode palette and keep their existing actions', () => {
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-06T12:00:00'])); }
  }
  const { lightTheme, darkTheme } = themeHarness();
  for (const platform of ['ios', 'android']) {
    const h = uiHarness(lightTheme, platform), navigated = [];
    const entry = load('components/finance/HomeAIEntry.js', {
      react: h.hooks.react, 'react-native': h.environment, '../../constants/Icons': icons,
      '../../config/releaseFeatures': { SERVER_FEATURES_ENABLED: false, AI_FEATURES_ENABLED: false },
      '../../config/publicConfig': { API_BASE_URL: '', AI_API_BASE_URL: '' }, './FinanceUI': h.ui,
    }).default;
    const Dashboard = load('components/finance/PersonalDashboard.js', {
      react: h.hooks.react, 'react-native': h.environment,
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      'expo-linear-gradient': { LinearGradient: 'Gradient' }, '../../constants/Icons': icons,
      '../../contexts/ThemeContext': { useTheme: h.useTheme },
      '../../contexts/AuthContext': { useAuth: () => ({ user: { uid: 'fixture' }, userData: {} }) },
      '../../hooks/useTransactions': { useTransactions: () => ({ complete: true, refreshing: false, refresh: async () => {},
        transactions: [{ id: 'income', type: 'income', date: '2026-10-06', amount: 100, category: 'salary', description: 'Synthetic income' }] }) },
      '../../hooks/useBudgets': { useBudgets: () => ({ complete: true, refreshing: false, refresh: async () => {}, budgets: [] }) },
      '../../utils/finance': finance, '../../utils/profileImage': profileImage,
      '../../utils/budgetRecommendations': { getBudgetRecommendations: () => [] }, '../BudgetAdvisor': esm('BudgetAdvisor'),
      '../GlassCard': esm(h.GlassCard), './FinanceUI': { ...h.ui, useFocusRefresh: () => {} }, './HomeAIEntry': esm(entry),
    }, { Date: FixedDate }).default;
    for (const theme of [lightTheme, darkTheme, lightTheme]) {
      h.setTheme(theme);
      const tree = h.hooks.render(() => Dashboard({ navigation: { navigate: route => navigated.push(route) } }));
      const nodes = treeNodes(tree);
      const balance = nodes.find(node => node.props.testID === 'home-balance');
      assert.equal(treeText(balance), '₹100.00');
      assert.equal(flatten(balance.props.style).color, theme.text);
      const description = nodes.find(node => node.type === 'Text' && treeText(node) === 'Synthetic income');
      assert.equal(flatten(description.props.style).color, theme.text);
      const gradient = nodes.find(node => node.type === 'Gradient');
      assert.deepEqual(plain(gradient.props.colors), plain(theme.pageGradientColors));
      const ai = nodes.find(node => node.props.testID === 'home-ai-entry');
      assert.match(ai.props.accessibilityHint, /No data is sent automatically/);
      const backgrounds = treeNodes(ai).filter(node => flatten(node.props.style).backgroundColor === theme.cardBackground);
      assert.equal(backgrounds.length, 1);
      ai.props.onPress();
      nodes.find(node => node.props.accessibilityLabel === 'See all transactions').props.onPress();
    }
    assert.deepEqual(navigated, ['AIChat', 'Transactions', 'AIChat', 'Transactions', 'AIChat', 'Transactions']);
    h.hooks.unmount();
  }
});

test('Themes light/dark controls update and persist appearance with readable pastel-theme selection icons', async () => {
  const h = themeHarness({ currentThemeId: 'cotton' }); h.render(); await tick();
  let state = h.render();
  const Screen = load('screens/personal/ThemesScreen.js', {
    react: h.hooks.react, 'react-native': nativeUI, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, '../../components/GlassCard': esm('GlassCard'),
    '../../contexts/ThemeContext': { useTheme: () => state },
    '../../components/account/AccountPrimitives': { AccountScreen: 'AccountScreen', AccountText: 'Text',
      useAccountTask: () => ({ busy: false, run: task => task() }) },
  }).default;
  const controls = () => treeNodes(Screen({ navigation: {} })).filter(node => node.type === 'TouchableOpacity');
  for (const dark of [true, false]) {
    controls().find(node => node.props.accessibilityLabel === `Use ${dark ? 'dark' : 'light'} mode`).props.onPress();
    await tick(); state = h.render();
    assert.equal(state.isDarkMode, dark);
    assert.equal(h.storage.get('isDarkMode'), String(dark));
    const selected = controls().find(node => node.props.accessibilityLabel === `Use ${dark ? 'dark' : 'light'} mode`);
    assert.equal(selected.props.accessibilityState.selected, true);
    const symbols = treeNodes(selected).filter(node => node.type === 'Icon');
    for (const symbol of symbols) {
      assert.equal(symbol.props.color, state.theme.accent);
      assert.ok(contrast(symbol.props.color, state.theme.surface) >= 4.5);
    }
  }
  h.hooks.unmount();
});
