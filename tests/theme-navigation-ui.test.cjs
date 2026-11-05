const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createHooks, treeNodes, treeText, plain, esm, native, animatedMock } = require('./helpers/react-ui.cjs');
const backgroundColours = load('components/AppBackground.js', { react: {}, 'react-native': native, 'expo-linear-gradient': {}, 'react-native-svg': {}, '@react-navigation/native': { NavigationContext: {} },
  '../contexts/ThemeContext': {}, './GlassSurface': load('components/GlassSurface.js', { react: {}, 'react-native': native, 'expo-blur': {}, 'expo-linear-gradient': {}, 'expo-glass-effect': {} }) });

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

function uiHarness(initialTheme, platform = 'ios', { liquidGlass = false } = {}) {
  const hooks = createHooks();
  let theme = initialTheme;
  const environment = { ...nativeUI, Platform: { OS: platform } };
  const useTheme = () => ({ theme, isDarkMode: theme.isDarkMode, isLoading: false });
  const GlassSurface = load('components/GlassSurface.js', {
    react: hooks.react, 'react-native': environment, 'expo-blur': { BlurView: 'Blur' }, 'expo-linear-gradient': { LinearGradient: 'Sheen' },
    'expo-glass-effect': { GlassView: 'GlassView', isLiquidGlassAvailable: () => liquidGlass },
  });
  const GlassCard = load('components/GlassCard.js', {
    react: hooks.react, 'react-native': environment, './GlassSurface': GlassSurface,
    '../contexts/ThemeContext': { useTheme },
  }).default;
  const account = load('components/account/AccountPrimitives.js', {
    react: hooks.react, 'react-native': environment,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, '../../contexts/ThemeContext': { useTheme },
    '../../constants/Icons': icons, '../../utils/profileImage': profileImage, '../GlassCard': esm(GlassCard), '../AppBackground': esm('AppBackground'), '../LogoLoader': esm('LogoLoader'), '../BrandLogo': esm('BrandLogo'),
  });
  const ui = load('components/finance/FinanceUI.js', {
    react: hooks.react, 'react-native': environment,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, 'react-native-svg': { ...esm('Svg'), Circle: 'Circle' },
    '../../constants/Icons': icons, '../GlassCard': esm(GlassCard), '../AppBackground': esm('AppBackground'), '../LogoLoader': esm('LogoLoader'), '../../utils/finance': finance,
    '../../contexts/ThemeContext': { useTheme }, '../../contexts/AuthContext': { useAuth: () => ({}) },
    '../../config/firebase': { auth: {} },
  });
  // Cards draw the theme card colour as a translucent glass tint over the page background.
  const cardTint = colour => GlassSurface.withAlpha(colour, platform === 'ios' ? 0.62 : 0.86);
  return { hooks, ui, account, GlassCard, cardTint, environment, useTheme,
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
  const Animated = animatedMock();
  const Bar = load('navigation/SharedTabBar.js', {
    '../components/AppBackground': backgroundColours, '../theme/fonts': { brandFontsReady: () => false },
    react: hooks.react, 'react-native': { ...nativeUI, Animated, Easing: { out: x => x, quad: x => x, cubic: x => x },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false }, Keyboard: { isVisible: () => false,
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
  return { hooks, keyboard, navigated, emitted, state, descriptors, routes, insets, Animated, props, Bar,
    setTheme: next => { theme = next; }, prevent: value => { prevent = value; },
    render: () => hooks.render(() => { const tree = Bar(props); return { tree, nodes: treeNodes(tree) }; }),
  };
}

// The liquid dock: the blob layer, and each tab's two label layers (idle grey / active white).
const blobLayer = tree => [tree.props.children.props.children].flat().find(node => node?.props?.pointerEvents === 'none');
function tabVisuals(tree) {
  return treeNodes(tree).filter(node => node.type === 'Pressable').map(tab => {
    const nodes = treeNodes(tab);
    const [idle, active] = nodes.filter(node => node.type === 'AnimatedText');
    const icons = nodes.filter(node => node.type === 'Icon');
    return { label: treeText(active), activeLabelVisible: flatten(active.props.style).opacity.value,
      idleLabelColor: flatten(idle.props.style).color, activeLabelColor: flatten(active.props.style).color,
      activeIconColor: icons.at(-1)?.props.color };
  });
}

test('personal/company liquid dock: dark capsule, glowing blob behind the active icon, named tabs, 44pt targets and safe-area clearance', () => {
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
         assert.equal(wrapper.height, 68 + Math.max(insets.bottom, 12) + 8);
         assert.ok(wrapper.paddingLeft >= Math.max(insets.left, 16));
         assert.ok(wrapper.paddingRight >= Math.max(insets.right, 16));
         assert.ok(bar.maxWidth <= 520);
        assert.equal(bar.backgroundColor, '#141414');
        assert.equal(bar.borderColor, 'rgba(255,255,255,0.08)');
         assert.equal(bar.height, 68);
        const buttons = nodes.filter(node => node.type === 'Pressable');
        assert.equal(buttons.length, 5);
        // A pointer-free layer holds the ripple and the glowing accent blob behind the active icon.
        const layer = blobLayer(tree);
        const [ring, blob] = [layer.props.children].flat();
        assert.equal(flatten(blob.props.style).backgroundColor, backgroundColours.visibleAccent(theme));
        assert.equal(flatten(ring.props.style).borderColor, backgroundColours.visibleAccent(theme));
        const tabs = tabVisuals(tree);
        assert.deepEqual(tabs.map(tab => tab.label), company ? ['Home', 'Reports', 'Add', 'Team', 'Budget'] : ['Home', 'History', 'Add', 'Budget', 'Stats']);
        // Every tab shows its name; only the active one's white layer is visible.
        assert.deepEqual(tabs.map(tab => tab.activeLabelVisible), [0, 1, 0, 0, 0]);
        for (const tab of tabs) { assert.equal(tab.idleLabelColor, '#A8A29E'); assert.equal(tab.activeLabelColor, '#FFFFFF'); }
        // The active icon reads clearly on the blob.
        const contrast = (a, b) => { const [x, y] = [backgroundColours.luminance(a), backgroundColours.luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
        assert.ok(contrast(tabs[1].activeIconColor, backgroundColours.visibleAccent(theme)) >= 4.5);
        const flexUnits = buttons.reduce((sum, button) => sum + (flatten(button.props.style).flex || 1), 0);
        assert.equal(flexUnits, 5); // five equal slots, so nothing re-lays out when the tab changes
        for (const button of buttons) {
          const style = flatten(button.props.style);
          assert.ok(style.minHeight >= 44 && style.minWidth >= 44);
           const viewportWidth = insets.left || insets.right ? 852 : 320;
           const horizontalPadding = wrapper.paddingLeft + wrapper.paddingRight;
           // Every slot keeps at least a 44pt target.
           assert.ok((Math.min(viewportWidth - horizontalPadding, bar.maxWidth) - 2 * bar.paddingHorizontal - 2 * bar.borderWidth) / flexUnits >= 44);
          assert.equal(style.marginTop, undefined);
          assert.ok(button.props.accessibilityLabel);
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
    assert.equal(tabVisuals(h.render().tree)[2].label, 'Close');
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

test('a new install starts on the Expenzo blue-and-white theme', async () => {
  const h = themeHarness();
  h.render();
  await tick();
  const state = h.render();
  assert.equal(state.isDarkMode, false);
  assert.equal(state.currentThemeId, 'expenzo');
  assert.equal(Object.keys(state.themeConfigs)[0], 'expenzo');
  assert.equal(state.themeConfigs.expenzo.name, 'Expenzo');
  assert.equal(state.theme.primary, '#3157FF');
  // Blue pages with white cards, and white page text stays readable on the blue.
  assert.equal(state.theme.cardBackground, '#FFFFFF');
  assert.deepEqual(Array.from(state.theme.pageGradientColors, colour => colour.toUpperCase()), ['#3157FF', '#1F3FD1']);
  for (const colour of state.theme.pageGradientColors) assert.ok(contrast('#FFFFFF', colour) >= 4.5, colour);
  // The old purple "Default" theme keeps its id for people who chose it, shown as Classic.
  assert.equal(state.themeConfigs.default.name, 'Classic');
  assert.deepEqual(h.writes, []);
  h.hooks.unmount();
});

test('a saved theme choice is kept, and an unknown saved theme falls back to Expenzo', async () => {
  const saved = themeHarness({ isDarkMode: 'true', currentThemeId: 'black' });
  saved.render();
  await tick();
  let state = saved.render();
  assert.equal(state.isDarkMode, true);
  assert.equal(state.currentThemeId, 'black');
  assert.deepEqual(Array.from(state.theme.pageGradientColors), ['#050505', '#151515']);
  saved.hooks.unmount();
  const unknown = themeHarness({ currentThemeId: 'retired-theme' });
  unknown.render();
  await tick();
  state = unknown.render();
  assert.equal(state.theme.primary, '#3157FF');
  unknown.hooks.unmount();
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

test('cards are Expo liquid glass where available, with blur/translucent fallbacks and caller styles kept', () => {
  const { lightTheme, darkTheme } = themeHarness();
  const GlassEdge = dark => (dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)');
  const expand = node => treeNodes(node.type === 'View' ? node : { props: { children: node } });
  for (const theme of [lightTheme, darkTheme]) {
    const dark = theme.isDarkMode;
    // iOS with Liquid Glass: one native GlassView over a translucent card-colour base.
    const liquid = uiHarness(theme, 'ios', { liquidGlass: true });
    const card = liquid.GlassCard({ children: 'Fixture', testID: 'card', borderWidth: 1 });
    assert.equal(card.props.testID, 'card');
    // Glass panes get a thin light rim instead of the theme border.
    assert.equal(flatten(card.props.style).borderColor, GlassEdge(dark));
    assert.equal(flatten(card.props.style).borderWidth, 1);
    const glass = expand(card).filter(node => node.type === 'GlassView');
    assert.equal(glass.length, 1);
    assert.equal(glass[0].props.glassEffectStyle, 'regular');
    assert.equal(glass[0].props.colorScheme, dark ? 'dark' : 'light');
    assert.match(glass[0].props.tintColor, /^rgba\(/);
    assert.equal(flatten(glass[0].props.style).borderRadius, 20);
    // One translucent card-colour base behind the glass keeps every card's look consistent.
    assert.equal(expand(card).filter(node => node.type === 'View' && flatten(node.props.style).backgroundColor).length, 1);
    liquid.hooks.unmount();
    for (const platform of ['ios', 'android']) {
      const h = uiHarness(theme, platform);
      const custom = h.GlassCard({ children: 'Fixture', intensity: 200, backgroundColor: '#123456',
        style: [{ padding: 8 }, { backgroundColor: '#234567', borderRadius: 12 }] });
      assert.equal(flatten(custom.props.style).padding, 8);
      assert.equal(flatten(custom.props.style).borderRadius, 12);
      const tint = expand(custom).filter(node => flatten(node.props.style).backgroundColor);
      assert.equal(tint.length, 1);
      // Caller colour wins, made translucent so the background effects show through.
      assert.equal(flatten(tint[0].props.style).backgroundColor, platform === 'ios' ? 'rgba(35, 69, 103, 0.62)' : 'rgba(35, 69, 103, 0.86)');
      const blur = expand(custom).find(node => node.type === 'Blur');
      if (platform === 'ios') { assert.equal(blur.props.intensity, 100); assert.equal(blur.props.tint, dark ? 'dark' : 'light'); }
      else assert.equal(blur, undefined);
      // Opting out keeps the previous solid themed surface.
      const solid = h.GlassCard({ children: 'Fixture', glass: false });
      const layers = treeNodes(solid).filter(node => flatten(node.props.style).backgroundColor);
      assert.equal(layers.length, 1);
      assert.equal(flatten(layers[0].props.style).backgroundColor, theme.cardBackground);
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
        assert.equal(flatten(backgrounds[0].props.style).backgroundColor, h.cardTint(theme.cardBackground));
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
      const gradient = treeNodes(screen, false).find(node => node.type === 'AppBackground');
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
      '../../contexts/AuthContext': { useAuth: () => ({ user: { uid: 'fixture' } }) },
      '../../utils/aiConsent': { useStoredChatConsent: () => false },
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
      '../GlassCard': esm(h.GlassCard), '../AppBackground': esm('AppBackground'), '../LogoLoader': esm('LogoLoader'), './FinanceUI': { ...h.ui, useFocusRefresh: () => {} }, './HomeAIEntry': esm(entry),
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
      const gradient = nodes.find(node => node.type === 'AppBackground');
      assert.deepEqual(plain(gradient.props.colors), plain(theme.pageGradientColors));
      const ai = nodes.find(node => node.props.testID === 'home-ai-entry');
      assert.match(ai.props.accessibilityHint, /No data is sent automatically/);
      const backgrounds = treeNodes(ai).filter(node => flatten(node.props.style).backgroundColor === h.cardTint(theme.cardBackground));
      assert.equal(backgrounds.length, 1);
      ai.props.onPress();
      nodes.find(node => node.props.accessibilityLabel === 'See all transactions').props.onPress();
    }
    assert.deepEqual(navigated, ['AIChat', 'Transactions', 'AIChat', 'Transactions', 'AIChat', 'Transactions']);
    h.hooks.unmount();
  }
});

test('Themes light/dark controls update and persist appearance with readable pastel-theme selection icons', async () => {
  const h = themeHarness({ isDarkMode: 'false', currentThemeId: 'cotton' }); h.render(); await tick();
  let state = h.render();
  const Screen = load('screens/personal/ThemesScreen.js', {
    react: h.hooks.react, 'react-native': nativeUI, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, '../../components/GlassCard': esm('GlassCard'), '../../components/AppBackground': esm('AppBackground'), '../../components/LogoLoader': esm('LogoLoader'), '../../components/GlassSurface': esm('GlassSurface'),
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

test('pull-to-refresh shows the Expenzo logo on iOS and Android and pages scroll under the tab bar', () => {
  const { darkTheme } = themeHarness();
  for (const platform of ['ios', 'android']) {
    const h = uiHarness(darkTheme, platform);
    const page = h.ui.FinancePage({ title: 'History', children: 'Fixture', onRefresh: () => {}, refreshing: true });
    const nodes = treeNodes(page, false);
    const control = nodes.find(node => node.type === 'ScrollView').props.refreshControl;
    // The native spinner is invisible on both platforms…
    assert.equal(control.props.tintColor, 'transparent');
    assert.deepEqual(Array.from(control.props.colors), ['transparent']);
    assert.equal(control.props.progressBackgroundColor, 'transparent');
    // Android always draws its disc, so it is parked off-screen; iOS needs no offset.
    assert.equal(control.props.progressViewOffset, platform === 'android' ? -1000 : undefined);
    // …and the logo loader takes its place while refreshing.
    const loader = treeNodes(page).find(node => node.type === 'LogoLoader');
    assert.equal(loader.props.accessibilityLabel, 'Refreshing');
    // No bottom safe-area inset, so content is not cut off above the home indicator.
    const safeArea = nodes.find(node => node.type === 'SafeAreaView');
    assert.deepEqual(Array.from(safeArea.props.edges), ['top', 'left', 'right']);
    const idle = h.ui.FinancePage({ title: 'History', children: 'Fixture', onRefresh: () => {}, refreshing: false });
    assert.equal(treeNodes(idle).some(node => node.type === 'LogoLoader'), false);
    h.hooks.unmount();
  }
});

test('pull-to-refresh keeps the logo up for the whole refresh and at least one animation pass', async () => {
  const { darkTheme } = themeHarness();
  const h = uiHarness(darkTheme, 'android');
  let calls = 0;
  const read = (external = false) => h.hooks.render(() => h.ui.usePullRefresh(async () => { calls += 1; }, external));
  assert.equal(read().refreshing, false);
  assert.equal(read(true).refreshing, true); // the screen's own loading flag still shows it
  const started = Date.now();
  read().onRefresh();
  assert.equal(read().refreshing, true); // shows the moment the pull is released
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(read().refreshing, true); // instant local data does not cut the animation short
  while (read().refreshing && Date.now() - started < 3000) await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(read().refreshing, false);
  assert.ok(Date.now() - started >= 1150);
  assert.equal(calls, 1);
  h.hooks.unmount();
});

test('tab motion runs on the native driver: liquid blob glide, stretch wobble, landing ripple, crossfading names', () => {
  const { darkTheme } = themeHarness();
  const h = tabHarness(darkTheme);
  h.render();
  h.Animated.started.length = 0;
  h.state.index = 3;
  h.render();
  const started = h.Animated.started;
  assert.ok(started.length > 0);
  // Every animation that moves a value is native-driven (pauses like Animated.delay have no driver).
  for (const config of started.filter(config => 'toValue' in config)) assert.equal(config.useNativeDriver, true);
  // The blob glides to the new slot's centre (393pt test window → 347pt inner bar, five equal slots).
  const inner = Math.min(393 - 16 - 16, 420) - 2 * 6 - 2;
  const glide = started.find(config => config.stiffness === 300);
  assert.ok(Math.abs(glide.toValue - ((inner / 5) * 3.5 - 20)) < 0.01);
  assert.ok(started.some(config => config.toValue === 0 && config.damping === 10)); // the wobble back to round
  assert.ok(started.some(config => config.duration === 460 && config.toValue === 1)); // the landing ripple
  // Names crossfade: the new tab's focus goes to 1, every other tab's to 0.
  const fades = started.filter(config => config.duration === 260);
  assert.deepEqual(fades.map(config => config.toValue), [0, 0, 0, 1, 0]);
  h.hooks.unmount();
});

test('the dock has equal slots, so the blob lands at each slot centre', () => {
  const Bar = load('navigation/SharedTabBar.js', { react: { memo: component => component }, 'react-native': native, '@expo/vector-icons': {}, 'react-native-safe-area-context': {},
    '../contexts/ThemeContext': {}, '../screens/personal/SplashScreen': {}, '../components/AppBackground': backgroundColours, '../theme/fonts': {} });
  assert.deepEqual([0, 1, 2, 3, 4].map(index => Bar.slotCentre(index, 350, 5)), [35, 105, 175, 245, 315]);
});
