const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const { code } = babel.transformSync(source, { filename: file, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] });
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: (name) => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unmocked import: ${name} in ${file}`);
  }, setTimeout, clearTimeout, ...globals }, { filename: file });
  return module.exports;
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

function serviceHarness() {
  const events = [];
  const profiles = new Map();
  const user = { uid: 'owner', email: 'owner@example.test', providerData: [{ providerId: 'password' }],
    getIdToken: async (force) => events.push(['token', force]) };
  const auth = { currentUser: user };
  const authApi = {
    signOut: async () => { events.push('signOut'); auth.currentUser = null; },
    createUserWithEmailAndPassword: async () => { events.push('createUser'); auth.currentUser = user; return { user }; },
    signInWithEmailAndPassword: async () => { events.push('signIn'); auth.currentUser = user; return { user }; },
    signInWithCredential: async () => ({ user }),
    sendPasswordResetEmail: async () => events.push('resetPassword'),
    updatePassword: async (_, value) => events.push(['password', value]),
    reauthenticateWithCredential: async (_, credential) => events.push(['reauth', credential]),
    EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
    GoogleAuthProvider: { credential: (token) => ({ token }) },
  };
  const firestore = {
    doc: (_, collection, uid) => `${collection}/${uid}`,
    getDoc: async (reference) => ({ exists: () => profiles.has(reference), data: () => profiles.get(reference) }),
    runTransaction: async (_, body) => body({ get: firestore.getDoc,
      set: (reference, value) => { events.push('profileWrite'); profiles.set(reference, value); },
      update: (reference, value) => { events.push('profileUpdate'); profiles.set(reference, { ...profiles.get(reference), ...value }); },
    }),
    updateDoc: async (reference, value) => { events.push('profileUpdate'); profiles.set(reference, { ...profiles.get(reference), ...value }); },
  };
  const backend = { requestBackend: async (route, payload) => { events.push(['backend', route, JSON.stringify(payload)]); return { success: true }; } };
  const cleanup = { clearAccountLocalData: async (uid) => { events.push(['cleanup', uid]); return { success: true }; } };
  const google = { signInToGoogle: async () => 'test-id-token', signOutOfGoogle: async () => events.push('googleSignOut') };
  const loaded = load('services/authService.js', { 'firebase/auth': authApi, 'firebase/firestore': firestore,
    '../config/firebase': { auth, db: {} }, './backendClient': backend, '../utils/accountLocalData': cleanup, '../utils/googleAuth': google });
  return { service: loaded.default, sanitize: loaded.sanitizeProfileUpdate, user, auth, authApi, firestore, profiles, events, backend, cleanup, google };
}

test('wrong account-type email login signs out before returning a rejected result', async () => {
  const h = serviceHarness();
  h.profiles.set('users/owner', { userType: 'company' });
  const result = await h.service.signIn('owner@example.test', 'password', 'personal');
  assert.equal(result.success, false);
  assert.equal(result.rejectedAccount, true);
  assert.equal(h.auth.currentUser, null);
  assert.ok(h.events.includes('signOut'));
});

test('wrong-type Google login is rejected and cancellation performs no Firebase login', async () => {
  const h = serviceHarness();
  h.profiles.set('users/owner', { userType: 'personal' });
  assert.equal((await h.service.signInWithGoogle('company')).rejectedAccount, true);
  h.google.signInToGoogle = async () => null;
  h.authApi.signInWithCredential = () => { throw new Error('must not sign in'); };
  assert.equal((await h.service.signInWithGoogle('personal')).canceled, true);
});

test('failed signup profile write exposes repair; retry is idempotent and cannot change role', async () => {
  const h = serviceHarness();
  const transaction = h.firestore.runTransaction;
  h.firestore.runTransaction = async () => { throw new Error('offline'); };
  const created = await h.service.signUp('owner@example.test', 'password', { fullName: 'Owner', userType: 'personal' });
  assert.equal(created.needsProfile, true);
  assert.equal(created.user.uid, 'owner');
  h.firestore.runTransaction = transaction;
  assert.equal((await h.service.completeProfile({ fullName: 'Owner', userType: 'personal' })).success, true);
  assert.equal((await h.service.completeProfile({ fullName: 'Other', userType: 'personal' })).success, true);
  assert.equal(h.events.filter((event) => event === 'createUser').length, 1);
  assert.equal(h.events.filter((event) => event === 'profileWrite').length, 1);
  assert.equal((await h.service.completeProfile({ fullName: 'Other', userType: 'company', companyName: 'Firm' })).success, false);
  assert.equal(h.profiles.get('users/owner').userType, 'personal');
});

test('explicitly incomplete profiles are kept out of protected flows and can be repaired without changing account type', async () => {
  const h = serviceHarness();
  h.profiles.set('users/owner', { uid: 'owner', email: 'owner@example.test', fullName: 'Owner', userType: 'personal',
    createdAt: '2026-10-06T00:00:00.000Z', updatedAt: '2026-10-06T00:00:00.000Z', profileComplete: false,
    provider: 'password', obsoleteField: true });
  const loaded = await h.service.getUserData('owner');
  assert.equal(loaded.success, false);
  assert.equal(loaded.incomplete, true);
  assert.equal(loaded.userData.userType, 'personal');

  const repaired = await h.service.completeProfile({ fullName: 'Owner Repaired', userType: 'personal' });
  assert.equal(repaired.success, true);
  assert.equal(repaired.userData.profileComplete, true);
  assert.equal(repaired.userData.fullName, 'Owner Repaired');
  assert.equal(repaired.userData.obsoleteField, undefined);
  assert.equal(h.events.filter((event) => event === 'profileWrite').length, 1);
  assert.equal((await h.service.completeProfile({ fullName: 'Wrong Role', userType: 'company', companyName: 'Firm' })).success, false);
  assert.equal(h.profiles.get('users/owner').userType, 'personal');
});

test('missing profile and read failure are different recovery states', async () => {
  const h = serviceHarness();
  assert.equal((await h.service.getUserData('owner')).missing, true);
  h.firestore.getDoc = async () => { throw new Error('network unavailable'); };
  const failed = await h.service.getUserData('owner');
  assert.equal(failed.success, false);
  assert.equal(failed.missing, undefined);
});

test('deletion contacts backend first; recent-auth or unconfigured failures never erase client cloud data', async () => {
  const h = serviceHarness();
  const error = Object.assign(new Error('Please verify again'), { code: 'auth/requires-recent-login' });
  h.backend.requestBackend = async () => { h.events.push('backend'); throw error; };
  const result = await h.service.deleteAccount();
  assert.equal(result.requiresRecentLogin, true);
  assert.deepEqual(h.events, ['backend']);
  assert.equal(h.auth.currentUser.uid, 'owner');
  h.backend.requestBackend = async () => { throw Object.assign(new Error('Backend unavailable'), { code: 'backend/unconfigured' }); };
  assert.equal((await h.service.deleteAccount()).success, false);
});

test('confirmed deletion clears local data and session, with no client Firestore deletion API', async () => {
  const h = serviceHarness();
  const result = await h.service.deleteAccount();
  assert.equal(result.success, true);
  assert.equal(result.deletedUid, 'owner');
  assert.deepEqual(h.events[0], ['backend', '/account/delete', '{}']);
  assert.deepEqual(h.events[1], ['cleanup', 'owner']);
  assert.equal(h.auth.currentUser, null);
});

test('backend confirmation remains truthful if device sign-out fails', async () => {
  const h = serviceHarness();
  h.authApi.signOut = async () => { throw new Error('storage failure'); };
  const result = await h.service.deleteAccount();
  assert.equal(result.success, true);
  assert.match(result.cleanupWarning, /account was deleted/);
});

test('password change verifies old password and refreshes token before a real update', async () => {
  const h = serviceHarness();
  const result = await h.service.updateUserPassword('old password', 'new password');
  assert.equal(result.success, true);
  assert.equal(h.events[0][0], 'reauth');
  assert.equal(h.events[0][1].password, 'old password');
  assert.deepEqual(h.events[1], ['token', true]);
  assert.deepEqual(h.events[2], ['password', 'new password']);
  h.user.providerData = [{ providerId: 'google.com' }];
  assert.equal((await h.service.updateUserPassword('x', 'new password')).success, false);
  assert.equal((await h.service.reauthenticate()).success, true);
  assert.equal(h.events[3][1].token, 'test-id-token');
});

test('failed reauthentication never updates password and stale UID cannot update a profile', async () => {
  const h = serviceHarness();
  h.authApi.reauthenticateWithCredential = async () => { throw new Error('wrong password'); };
  assert.equal((await h.service.updateUserPassword('wrong', 'new password')).success, false);
  assert.equal(h.events.length, 0);
  h.auth.currentUser = { uid: 'other' };
  assert.equal((await h.service.updateUserData('owner', { fullName: 'New name' })).success, false);
  assert.equal(h.events.length, 0);
});

test('profile updates strip ownership/role fields and refuse local image URIs', () => {
  const h = serviceHarness();
  const changes = h.sanitize({ uid: 'other', userType: 'company', fullName: ' Owner ' });
  assert.equal(changes.fullName, 'Owner');
  assert.equal(changes.uid, undefined);
  assert.equal(changes.userType, undefined);
  assert.throws(() => h.sanitize({ profileImageUri: 'file:///private/image.jpg' }), /unavailable/);
  for (const [field, max] of Object.entries({ fullName: 120, contactPerson: 120, industry: 120, phone: 40, companyName: 160 })) {
    assert.equal(h.sanitize({ [field]: 'x'.repeat(max) })[field].length, max);
    assert.throws(() => h.sanitize({ [field]: 'x'.repeat(max + 1) }), /maximum/);
  }
  assert.throws(() => h.sanitize({ fullName: '  ' }), /Enter your name/);
});

function hookRuntime() {
  let index = 0;
  const slots = [];
  const effects = [];
  const react = { createContext: () => ({ Provider: 'Provider' }),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'Fragment',
    useState: (initial) => { const at = index++; if (!(at in slots)) slots[at] = initial;
      return [slots[at], (value) => { slots[at] = typeof value === 'function' ? value(slots[at]) : value; }]; },
    useRef: (initial) => { const at = index++; if (!(at in slots)) slots[at] = { current: initial }; return slots[at]; },
    useCallback: (callback) => callback, useMemo: (callback) => callback(),
    useEffect: (callback, dependencies) => { const at = index++;
      const old = slots[at];
      if (!old || dependencies.some((value, i) => value !== old.dependencies[i])) {
        slots[at] = { dependencies, cleanup: old?.cleanup };
        effects.push(() => { slots[at].cleanup?.(); slots[at].cleanup = callback(); });
      }
    },
  };
  return { react, render: (component) => { index = 0; const result = component({ children: null });
    while (effects.length) effects.shift()(); return result; } };
}

function contextHarness() {
  const runtime = hookRuntime();
  const auth = { currentUser: null };
  let listener;
  const service = { getUserData: async (uid) => ({ success: true, userData: { uid, userType: 'personal' } }) };
  const provider = load('contexts/AuthContext.js', { react: runtime.react, 'firebase/auth': {
    onAuthStateChanged: (_, callback) => { listener = callback; return () => {}; },
  }, '../config/firebase': { auth }, '../services/authService': service,
  '../utils/accountLocalData': { clearAccountLocalData: async () => ({ success: true }) } }).AuthProvider;
  const render = () => runtime.render(provider).props.value;
  render();
  return { auth, service, render, emit: (user) => { auth.currentUser = user; listener(user); } };
}

test('obsolete profile reads cannot overwrite a new UID or revive a logged-out session', async () => {
  const h = contextHarness();
  const a = deferred();
  h.service.getUserData = (uid) => uid === 'A' ? a.promise : Promise.resolve({ success: true, userData: { uid, userType: 'company' } });
  h.emit({ uid: 'A' });
  h.emit({ uid: 'B' });
  await flush();
  assert.equal(h.render().userData.uid, 'B');
  a.resolve({ success: true, userData: { uid: 'A', userType: 'personal' } });
  await flush();
  assert.equal(h.render().userData.uid, 'B');
  const late = deferred();
  h.service.getUserData = () => late.promise;
  h.emit({ uid: 'C' });
  h.emit(null);
  late.resolve({ success: true, userData: { uid: 'C', userType: 'personal' } });
  await flush();
  assert.equal(h.render().user, null);
});

test('signup ignores early Auth event and publishes the completed Firestore profile', async () => {
  const h = contextHarness();
  h.service.getUserData = async () => ({ success: false, missing: true });
  h.service.signUp = async () => {
    h.emit({ uid: 'new' });
    await flush();
    assert.equal(h.render().isAuthenticated, false);
    return { success: true, user: h.auth.currentUser, userData: { uid: 'new', userType: 'personal' } };
  };
  await h.render().signUp('test@example.test', 'password', {});
  assert.equal(h.render().profileStatus, 'ready');
  assert.equal(h.render().userData.uid, 'new');
});

test('failed wrong-type signout blocks protected navigation rather than authenticating the account', async () => {
  const h = contextHarness();
  h.service.signIn = async () => {
    h.emit({ uid: 'wrong-type' });
    return { success: false, rejectedAccount: true };
  };
  await h.render().signIn('test@example.test', 'password', 'personal');
  assert.equal(h.render().isAuthenticated, false);
  assert.equal(h.render().profileStatus, 'blocked');
});

test('a missing document opens explicit setup rather than a protected dashboard', async () => {
  const h = contextHarness();
  h.service.getUserData = async () => ({ success: false, missing: true });
  h.emit({ uid: 'partial' });
  await flush();
  assert.equal(h.render().profileStatus, 'missing');
  assert.equal(h.render().isAuthenticated, false);
});

test('an explicit incomplete profile opens recovery with its existing account type', async () => {
  const h = contextHarness();
  h.service.getUserData = async () => ({ success: false, incomplete: true,
    userData: { uid: 'partial', userType: 'company', fullName: 'Fixture Company' }, error: 'Complete your account setup.' });
  h.emit({ uid: 'partial' });
  await flush();
  const session = h.render();
  assert.equal(session.profileStatus, 'incomplete');
  assert.equal(session.isAuthenticated, false);
  assert.equal(session.userData.userType, 'company');
});

test('message lifecycle preserves callbacks once and stale dismissals never hide nested prompts', async () => {
  const { createMessageQueue } = load('hooks/useThemedMessageBox.js', { react: {} });
  let current;
  let dismissed = 0, pressed = 0;
  const queue = createMessageQueue((value) => { current = value; });
  queue.showMessage({ title: 'First', onDismiss: () => dismissed++, buttons: [{ text: 'Continue', onPress: async () => {
    pressed++; await flush(); queue.showMessage({ title: 'Second' });
  } }] });
  const old = current;
  const completion = old.buttons[0].onPress();
  await old.buttons[0].onPress();
  await completion;
  old.onDismiss();
  assert.equal(dismissed, 1);
  assert.equal(pressed, 1);
  assert.equal(current.title, 'Second');
});

test('messages queue independently, replacement completes prior callback once, custom confirmation handlers fall back', async () => {
  const { createMessageQueue, confirmationButtons } = load('hooks/useThemedMessageBox.js', { react: {} });
  let current;
  let dismissed = 0, confirmed = 0, canceled = 0;
  const queue = createMessageQueue((value) => { current = value; });
  queue.showMessage({ title: 'One', onDismiss: () => dismissed++ });
  const old = current;
  queue.showMessage({ title: 'Two' });
  assert.equal(current.title, 'One');
  old.onDismiss(); old.onDismiss();
  assert.equal(current.title, 'Two');
  assert.equal(dismissed, 1);
  const second = current;
  queue.showMessage({ title: 'Replacement', replace: true });
  second.onDismiss();
  assert.equal(current.title, 'Replacement');
  const buttons = confirmationButtons(() => confirmed++, () => canceled++, { buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete' }] });
  buttons[0].onPress(); buttons[1].onPress();
  assert.equal(confirmed, 1); assert.equal(canceled, 1);
  queue.showMessage({ title: 'Failure', replace: true, buttons: [{ text: 'Run', onPress: async () => { throw new Error('private details'); } }] });
  await current.buttons[0].onPress();
  assert.equal(current.title, 'Action failed');
  assert.ok(!current.message.includes('private'));
});

test('profile image utility accepts only existing HTTPS display links', () => {
  const image = load('utils/profileImage.js', {});
  assert.equal(image.remoteProfileImage('file:///old.jpg'), null);
  assert.equal(image.remoteProfileImage('https://storage.example.test/profile.jpg'), 'https://storage.example.test/profile.jpg');
});

test('account cleanup removes account preferences and legacy images but preserves Firebase and device theme keys', async () => {
  let removed;
  const deleted = [];
  const { clearAccountLocalData } = load('utils/accountLocalData.js', {
    '@react-native-async-storage/async-storage': { getAllKeys: async () => ['firebase:authUser', 'currentThemeId', 'account:owner:cache', 'account:other:cache', 'personal_recent_actions', 'company_recent_actions', 'aiConsent:v1:owner', 'aiConsent:v2:owner', 'aiConsent:v2:other', 'aiConsent:v2:owner2'],
      multiRemove: async (keys) => { removed = keys; } },
    'expo-file-system/legacy': { documentDirectory: 'file:///documents/', cacheDirectory: 'file:///cache/', deleteAsync: async (directory) => deleted.push(directory) },
  });
  assert.equal((await clearAccountLocalData('owner')).success, true);
  assert.deepEqual(Array.from(removed), ['account:owner:cache', 'personal_recent_actions', 'company_recent_actions', 'aiConsent:v1:owner', 'aiConsent:v2:owner']);
  assert.ok(deleted.includes('file:///documents/profile-images/'));
});

test('navigation only registers matching protected routes and resets key by UID/type/logout', () => {
  const react = hookRuntime().react;
  let session = { user: null, userData: null, profileStatus: 'signedOut', initializing: false };
  const mocks = { react, '@react-navigation/native': { NavigationContainer: 'Container', DefaultTheme: { colors: {} }, DarkTheme: { colors: {} } },
    '@react-navigation/native-stack': { createNativeStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }) },
    'expo-splash-screen': { hideAsync: async () => {} },
    '../contexts/ThemeContext': { useTheme: () => ({ theme: {}, isDarkMode: false, isLoading: false }) },
    '../contexts/AuthContext': { useAuth: () => session },
  };
  const source = fs.readFileSync(path.join(root, 'navigation/AppNavigator.js'), 'utf8');
  for (const match of source.matchAll(/from '([^']+)'/g)) if (!(match[1] in mocks)) mocks[match[1]] = match[1];
  const Navigator = load('navigation/AppNavigator.js', mocks).default;
  const routes = (node) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
    ? node.flatMap(routes) : [...(node.type === 'Screen' ? [node.props.name] : []), ...routes(node.props?.children)];
  const signedOut = Navigator();
  assert.ok(routes(signedOut).includes('Privacy'));
  assert.ok(!routes(signedOut).includes('Dashboard'));
  assert.ok(!routes(signedOut).includes('AIChat'));
  assert.ok(!routes(signedOut).includes('BackupRestore'));
  assert.ok(!routes(signedOut).includes('BillingSubscription'));
  session = { ...session, user: { uid: 'A' }, userData: { userType: 'personal' }, profileStatus: 'ready' };
  const personal = Navigator();
  assert.ok(routes(personal).includes('Dashboard'));
  assert.ok(routes(personal).includes('AIChat'));
  assert.ok(routes(personal).includes('BackupRestore'));
  assert.ok(!routes(personal).includes('BillingSubscription'));
  assert.ok(!routes(personal).includes('CompanyDashboard'));
  session = { ...session, user: { uid: 'legacy' }, userData: { userType: 'personal', profileComplete: false }, profileStatus: 'ready' };
  const incomplete = Navigator();
  assert.ok(routes(incomplete).includes('AccountRecovery'));
  assert.ok(!routes(incomplete).includes('Dashboard'));
  assert.ok(!routes(incomplete).includes('AIChat'));
  session = { ...session, user: { uid: 'B' }, userData: { userType: 'company' } };
  const company = Navigator();
  assert.notEqual(company.props.key, personal.props.key);
  assert.notEqual(company.props.key, signedOut.props.key);
  assert.ok(routes(company).includes('CompanyDashboard'));
  assert.ok(!routes(company).includes('Dashboard'));
  assert.ok(routes(company).includes('AIChat'));
  assert.ok(routes(company).includes('BillingSubscription'));
  assert.ok(!routes(company).includes('BackupRestore'));
  session = { ...session, profileStatus: 'missing', userData: null };
  assert.ok(routes(Navigator()).includes('AccountRecovery'));
  assert.ok(!routes(Navigator()).includes('CompanyDashboard'));
  assert.ok(!routes(Navigator()).includes('AIChat'));
  assert.ok(!routes(Navigator()).includes('BackupRestore'));
  assert.ok(!routes(Navigator()).includes('BillingSubscription'));
  session = { ...session, profileStatus: 'ready', userData: { userType: 'unknown' } };
  assert.ok(!routes(Navigator()).includes('AIChat'));
});

test('unconfigured Google build is honestly unavailable without loading native module', async () => {
  let nativeLoaded = false;
  const google = load('utils/googleAuth.js', { '@env': { GOOGLE_WEB_CLIENT_ID: '', GOOGLE_IOS_CLIENT_ID: '' },
    'react-native': { Platform: { OS: 'android' } }, 'expo-constants': { appOwnership: 'standalone' },
    '@react-native-google-signin/google-signin': { get GoogleSignin() { nativeLoaded = true; throw new Error('not installed'); } },
  });
  assert.equal(google.getGoogleAuthSetup().isConfigured, false);
  await assert.rejects(google.signInToGoogle(), /not configured/);
  assert.equal(nativeLoaded, false);
});
