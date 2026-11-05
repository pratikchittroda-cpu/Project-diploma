const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load, createHooks, treeNodes, treeText, plain, esm, native, theme } = require('./helpers/react-ui.cjs');

const flush = () => new Promise(resolve => setImmediate(resolve));
const control = (tree, type, key, value) => treeNodes(tree).find(node => node.type === type && node.props[key] === value);

async function setupHarness({ saveError = null } = {}) {
  const providerHooks = createHooks(), navHooks = createHooks();
  const user = { uid: 'fixture-owner', email: 'fixture@example.test', providerData: [{ providerId: 'password' }] };
  const auth = { currentUser: user }, errors = [], writes = [], reads = [];
  let profile = { uid: user.uid, email: user.email, fullName: 'Saved Name', userType: 'personal',
    profileComplete: false, createdAt: '2026-10-06T00:00:00.000Z', updatedAt: '2026-10-06T00:00:00.000Z' };
  let listener, account, recoveryHooks, recovery;
  const snapshot = () => ({ exists: () => true, data: () => ({ ...profile }) });
  const firestore = {
    doc: (_, collection, uid) => `${collection}/${uid}`,
    getDoc: async reference => { reads.push(reference); return snapshot(); },
    runTransaction: async (_, callback) => {
      const staged = [];
      const result = await callback({ get: async () => snapshot(),
        update: (reference, changes) => staged.push([reference, changes]),
        set: (reference, changes) => staged.push([reference, changes]),
      });
      if (saveError) throw saveError;
      for (const [reference, changes] of staged) { writes.push([reference, plain(changes)]); profile = { ...profile, ...changes }; }
      return result;
    },
  };
  const service = load('services/authService.js', { 'firebase/auth': {}, 'firebase/firestore': firestore,
    '../config/firebase': { auth, db: {} }, './backendClient': {}, '../utils/accountLocalData': {}, '../utils/googleAuth': {} }).default;
  const { AuthProvider } = load('contexts/AuthContext.js', { react: providerHooks.react,
    'firebase/auth': { onAuthStateChanged: (_, callback) => { listener = callback; return () => {}; } },
    '../config/firebase': { auth }, '../services/authService': esm(service),
    '../utils/accountLocalData': { clearAccountLocalData: async () => ({ success: true }) } });
  const navMocks = { react: navHooks.react,
    '@react-navigation/native': { NavigationContainer: 'Container', DefaultTheme: { colors: {} }, DarkTheme: { colors: {} } },
    '@react-navigation/native-stack': { createNativeStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }) },
    'expo-splash-screen': { hideAsync: async () => {} },
    '../contexts/ThemeContext': { useTheme: () => ({ theme, isDarkMode: false, isLoading: false }) },
    '../contexts/AuthContext': { useAuth: () => account },
  };
  const navSource = fs.readFileSync(path.join(__dirname, '../navigation/AppNavigator.js'), 'utf8');
  for (const match of navSource.matchAll(/from '([^']+)'/g)) if (!(match[1] in navMocks)) navMocks[match[1]] = esm(match[1]);
  const Navigator = load('navigation/AppNavigator.js', navMocks).default;
  const mountRecovery = () => {
    recoveryHooks = createHooks();
    const primitives = load('components/account/AccountPrimitives.js', {
      react: recoveryHooks.react, 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      'expo-linear-gradient': { LinearGradient: 'Gradient' }, '../../contexts/ThemeContext': { useTheme: () => ({ theme }) },
      '../../constants/Icons': { Icon: 'Icon' }, '../../utils/profileImage': {}, '../GlassCard': esm('GlassCard'), '../AppBackground': esm('AppBackground'), '../LogoLoader': esm('LogoLoader'), '../BrandLogo': esm('BrandLogo'),
    });
    for (const name of ['AccountButton', 'AccountCard', 'AccountField', 'AccountRow', 'AccountScreen', 'AccountSection', 'AccountText']) primitives[name] = name;
    recovery = load('components/account/AccountRecovery.js', { react: recoveryHooks.react, 'react-native': native,
      '../../contexts/AuthContext': { useAuth: () => account }, '../../contexts/ThemeContext': { useTheme: () => ({ theme }) },
      '../../constants/Icons': { Icon: 'Icon' }, '../../services/MessageService': esm({ showError: (...args) => errors.push(args) }),
      './AccountPrimitives': primitives,
      './AccountActions': { useAccountActions: () => ({ requestSignOut() {}, requestDelete() {}, deletionAvailable: false }) },
    }).default;
  };
  const render = () => {
    account = providerHooks.render(() => AuthProvider({ children: null })).props.value;
    const nav = navHooks.render(() => Navigator());
    const route = treeNodes(nav).find(node => node.type === 'Screen')?.props.name || 'Splash';
    if (route !== 'AccountRecovery') { recoveryHooks?.unmount(); recoveryHooks = null; return { route, nav }; }
    if (!recoveryHooks) mountRecovery();
    return { route, nav, tree: recoveryHooks.render(() => recovery({ navigation: { navigate() {}, canGoBack: () => false } })) };
  };
  render(); listener(user); await flush(); render();
  return { render, auth, user, service, errors, writes, reads, get account() { return account; },
    unmount() { recoveryHooks?.unmount(); providerHooks.unmount(); navHooks.unmount(); },
  };
}

test('failed Complete Setup keeps the recovery screen mounted so its error and editable draft remain visible', async () => {
  const h = await setupHarness({ saveError: Object.assign(new Error('Profile write rejected.'), { code: 'permission-denied' }) });
  let view = h.render();
  control(view.tree, 'AccountField', 'label', 'Your name').props.onChangeText('My Edited Name');
  view = h.render();
  const submitting = control(view.tree, 'AccountButton', 'title', 'Complete Setup').props.onPress();
  await flush();
  const duringFailure = h.render();
  await submitting;
  const failed = h.render();
  assert.equal(duringFailure.route, 'AccountRecovery', 'A save error must not replace recovery with a splash/profile reload');
  assert.equal(failed.route, 'AccountRecovery');
  assert.equal(control(failed.tree, 'AccountField', 'label', 'Your name').props.value, 'My Edited Name');
  assert.match(treeText(failed.tree), /Profile write rejected|profile.*could not|profile.*cannot|could not.*profile/i);
  assert.equal(h.errors.length, 1);
  assert.equal(h.writes.length, 0);
  assert.equal(h.account.isAuthenticated, false);
  h.unmount();
});

test('successful Complete Setup commits once and replaces recovery with the dashboard', async () => {
  const h = await setupHarness();
  const view = h.render();
  assert.equal(view.route, 'AccountRecovery');
  const complete = control(view.tree, 'AccountButton', 'title', 'Complete Setup');
  const submitting = complete.props.onPress();
  await complete.props.onPress();
  await submitting;
  assert.equal(h.render().route, 'Dashboard');
  assert.equal(h.account.profileStatus, 'ready');
  assert.equal(h.account.userData.profileComplete, true);
  assert.equal(h.writes.length, 1);
  assert.equal(h.errors.length, 0);
  h.unmount();
});
