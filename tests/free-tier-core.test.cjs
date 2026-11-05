const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function load(file, mocks = {}, { jsx = false } = {}) {
  const { code } = babel.transformSync(read(file), { filename: file, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', ...(jsx ? [['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]] : [])] });
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unmocked import ${name} in ${file}`);
  } }, { filename: file });
  return module.exports;
}

const releaseFeatures = load('config/releaseFeatures.js');
const jsxRuntime = require('react/jsx-runtime');

test('the tracked release boundary explicitly disables server features', () => {
  assert.equal(releaseFeatures.SERVER_FEATURES_ENABLED, false);
});

test('core app startup never registers backend App Check', () => {
  const calls = [];
  const app = load('App.js', {
    react: { useEffect() {}, useRef: current => ({ current }), useState: value => [value, () => {}] }, 'react/jsx-runtime': jsxRuntime,
    'react-native': { View: 'View', Text: 'Text', StatusBar: 'StatusBar', Animated: { View: 'AnimatedView', Value: class {} },
      StyleSheet: { absoluteFill: {} } },
    './screens/personal/SplashScreen': { default: 'SplashScreen', __esModule: true },
    'expo-splash-screen': { preventAutoHideAsync: async () => {}, hideAsync: async () => {} },
    'react-native-screens': { enableFreeze() {}, enableScreens() {} },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' },
    './contexts/ThemeContext': { ThemeProvider: 'ThemeProvider', useTheme: () => ({}) },
    './contexts/AuthContext': { AuthProvider: 'AuthProvider' },
    './navigation/AppNavigator': { default: 'AppNavigator', __esModule: true },
    './components/MessageBoxProvider': { default: 'MessageBoxProvider', __esModule: true },
    './components/ErrorBoundary': { default: 'ErrorBoundary', __esModule: true },
    './config/firebase': { firebaseConfigured: true },
    './config/releaseFeatures': releaseFeatures,
    './utils/appCheck': { registerBackendAppCheck: () => calls.push('register') },
    './theme/fonts': { useAppFonts: () => true },
  }, { jsx: true });
  assert.equal(app.default().type, 'SafeAreaProvider');
  assert.deepEqual(calls, []);
});

test('interactive AI chat uses the existing secure client without direct provider access', () => {
  const navigator = read('navigation/AppNavigator.js');
  assert.match(navigator, /name=["']AIChat["']/);
  const direct = read('screens/personal/AIChatScreen.js');
  assert.ok(/aiService\.getFinancialChatResponse/.test(direct));
  assert.ok(/AI_FEATURES_ENABLED/.test(direct));
  assert.ok(!/AsyncStorage|NVIDIA_API_KEY|HUGGINGFACE_API_KEY|\bfetch\s*\(/.test(direct));
});

test('Spark release disables account deletion without prompting or invoking auth even with a configured API URL', () => {
  for (const url of ['', 'https://fixture.cloudfunctions.net/ai']) {
    const calls = [];
    const actions = load('components/account/AccountActions.js', {
      '../../contexts/AuthContext': { useAuth: () => ({
        user: { providerData: [{ providerId: 'password' }] },
        signOut: async () => { calls.push('signOut'); return {}; },
        deleteAccount: async () => { calls.push('deleteAccount'); return {}; },
        reauthenticate: async () => { calls.push('reauthenticate'); return {}; },
      }) },
      '../../config/publicConfig': { API_BASE_URL: url },
      '../../config/releaseFeatures': releaseFeatures,
      '../../services/MessageService': { showConfirm: (...args) => calls.push(['confirm', ...args]), showPrompt: (...args) => calls.push(['prompt', ...args]), showError: (...args) => calls.push(['error', ...args]) },
    });
    const result = actions.useAccountActions();
    assert.equal(result.deletionAvailable, false);
    result.requestDelete();
    assert.deepEqual(calls, []);
  }
});

test('sign-out remains usable while server deletion is disabled', async () => {
  const calls = [];
  let confirm;
  const actions = load('components/account/AccountActions.js', {
    '../../contexts/AuthContext': { useAuth: () => ({ user: null, signOut: async () => { calls.push('signOut'); return { success: true }; } }) },
    '../../config/publicConfig': { API_BASE_URL: 'https://fixture.cloudfunctions.net/ai' },
    '../../config/releaseFeatures': releaseFeatures,
    '../../services/MessageService': { showConfirm: (_, __, action) => { confirm = action; }, showSuccess: title => calls.push(title) },
  });
  const result = actions.useAccountActions();
  assert.equal(result.deletionAvailable, false);
  result.requestSignOut();
  assert.equal(typeof confirm, 'function');
  await confirm();
  assert.deepEqual(calls, ['signOut', 'Signed out']);
});

test('public privacy, external deletion, and support links remain usable in the core release', async () => {
  const opened = [];
  const privacy = load('screens/personal/PrivacyScreen.js', {
    react: require('react'), 'react/jsx-runtime': jsxRuntime,
    'react-native': { ScrollView: 'ScrollView', View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
      Linking: { openURL: async url => { opened.push(url); } }, StyleSheet: { create: styles => styles } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '../../components/GlassCard': { default: 'GlassCard', __esModule: true },
    '../../components/account/AccountPrimitives': { AccountScreen: 'AccountScreen', accountGradientColors: () => ['#6755D7', '#3C74D8'] },
    '../../contexts/ThemeContext': { useTheme: () => ({ theme: {} }) },
    '../../config/publicConfig': { PRIVACY_POLICY_URL: 'https://fixture.expenzo.app/privacy', ACCOUNT_DELETION_URL: 'https://fixture.expenzo.app/delete', SUPPORT_EMAIL: 'support@fixture.expenzo.app' },
    '../../services/MessageService': { showError: message => assert.fail(message) },
  }, { jsx: true }).default;
  const links = [];
  const visit = node => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node?.props) return;
    if (node.props.accessibilityRole === 'link') links.push(node);
    visit(node.props.children);
  };
  visit(privacy({ navigation: { goBack() {} } }));
  assert.equal(links.length, 3);
  for (const link of links) await link.props.onPress();
  assert.deepEqual(opened, ['https://fixture.expenzo.app/privacy', 'https://fixture.expenzo.app/delete', 'mailto:support@fixture.expenzo.app?subject=Expenzo%20privacy%20request']);
});

test('profile image release path has no picker or Firebase Storage upload', () => {
  const imageUtil = read('utils/profileImage.js');
  const editor = read('components/account/AccountProfileEditor.js');
  assert.doesNotMatch(imageUtil, /firebase\/storage|uploadBytes|getDownloadURL|launchImageLibrary/);
  assert.doesNotMatch(editor, /pickEditableProfileImage|Choose profile photo|updateUserProfile\(\{ profileImageUri/);
  const auth = load('services/authService.js', {
    'firebase/auth': {}, 'firebase/firestore': {}, '../config/firebase': {}, './backendClient': {},
    '../utils/accountLocalData': {}, '../utils/googleAuth': {},
  });
  assert.throws(() => auth.sanitizeProfileUpdate({ profileImageUri: 'file:///tmp/photo.jpg' }), /unavailable/);
});

test('in-app privacy explains consented hosted AI and keeps deletion/upload limits truthful', () => {
  const privacy = read('screens/personal/PrivacyScreen.js');
  assert.match(privacy, /free-tier release/);
  assert.match(privacy, /Only after you choose sharing consent/);
  assert.match(privacy, /Expo EAS Hosting/);
  assert.match(privacy, /Provider keys stay on the server/);
  assert.match(privacy, /Server account deletion is unavailable/);
  assert.match(privacy, /external account-deletion route/);
});
