import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, updatePassword, EmailAuthProvider,
  reauthenticateWithCredential, GoogleAuthProvider, signInWithCredential,
} from 'firebase/auth';
import { doc, getDoc, runTransaction, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { requestBackend } from './backendClient';
import { clearAccountLocalData } from '../utils/accountLocalData';
import { signInToGoogle, signOutOfGoogle } from '../utils/googleAuth';

const failure = (error) => ({ success: false, error: error.message || 'Please try again.', code: error.code });
const validType = (type) => type === 'personal' || type === 'company';
const PROFILE_KEYS = new Set(['uid', 'email', 'fullName', 'userType', 'createdAt', 'updatedAt', 'profileComplete', 'provider',
  'phone', 'companyName', 'contactPerson', 'industry', 'companySize', 'address', 'website', 'profileImageUri', 'companyLogoUri',
  'employeeCount', 'activeProjects', 'monthlyBudget', 'budgets', 'preferences']);
const PROFILE_TEXT_LIMITS = { email: 254, fullName: 120, phone: 40, companyName: 160, contactPerson: 120, industry: 120,
  companySize: 40, address: 500, website: 500, profileImageUri: 2048, companyLogoUri: 2048 };
const assertCurrent = (uid) => {
  if (!uid || auth.currentUser?.uid !== uid) throw new Error('Your session changed. Please try again.');
};

function repairedProfile(existing, fields, updatedAt) {
  const repaired = {};
  for (const [key, value] of Object.entries(existing)) {
    if (!PROFILE_KEYS.has(key)) continue;
    const max = PROFILE_TEXT_LIMITS[key];
    // Optional legacy text fields can be cleared when an old client stored an
    // invalid value. Identity and required fields are preserved for the rules
    // to validate rather than silently rewritten by recovery.
    if (max && (typeof value !== 'string' || value.length > max)) {
      if (['email', 'fullName'].includes(key)) repaired[key] = value;
      else repaired[key] = '';
    } else repaired[key] = value;
  }
  return { ...repaired, ...fields, updatedAt, profileComplete: true };
}

export const sanitizeProfileUpdate = (data) => {
  if (data.profileImageUri !== undefined || data.companyLogoUri !== undefined) {
    throw new Error('Profile photo uploads are unavailable in this free-tier release.');
  }
  const limits = { fullName: 120, phone: 40, companyName: 160, contactPerson: 120, industry: 120 };
  const cleaned = {};
  for (const [key, max] of Object.entries(limits)) {
    if (data[key] === undefined) continue;
    if (typeof data[key] !== 'string' || data[key].trim().length > max) throw new Error(`Invalid ${key}: maximum ${max} characters.`);
    const value = data[key].trim();
    if (key === 'fullName' && !value) throw new Error('Enter your name.');
    cleaned[key] = value;
  }
  return cleaned;
};

class AuthService {
  // A transaction makes recovery safe to retry and never overwrites an existing account type.
  async completeProfile(data) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Please sign in again.');
      if (!validType(data.userType)) throw new Error('Choose Personal or Company.');
      const fields = sanitizeProfileUpdate(data);
      if (!fields.fullName) throw new Error('Enter your name.');
      if (data.userType === 'company' && !fields.companyName) throw new Error('Enter your company name.');
      const profile = await runTransaction(db, async (transaction) => {
        assertCurrent(user.uid);
        const reference = doc(db, 'users', user.uid);
        const snapshot = await transaction.get(reference);
        if (snapshot.exists()) {
          const existing = snapshot.data();
          if (!validType(existing.userType)) throw new Error('This profile needs support to repair its account type.');
          if (existing.userType !== data.userType) throw new Error(`This is a ${existing.userType} account.`);
          if (existing.profileComplete !== undefined && existing.profileComplete !== true) {
            const changes = repairedProfile(existing, fields, new Date().toISOString());
            assertCurrent(user.uid);
            // Replace only with the reviewed profile schema. This removes
            // unknown fields left by older clients while preserving immutable
            // identity and legacy fields that the rules protect.
            transaction.set(reference, changes);
            return changes;
          }
          return existing;
        }
        const now = new Date().toISOString();
        const profileData = {
          ...fields, uid: user.uid, email: user.email || '', userType: data.userType,
          createdAt: now, updatedAt: now, profileComplete: true,
          provider: user.providerData?.some((item) => item.providerId === 'google.com') ? 'google' : 'password',
        };
        assertCurrent(user.uid);
        transaction.set(reference, profileData);
        return profileData;
      });
      assertCurrent(user.uid);
      return { success: true, user, userData: profile };
    } catch (error) { return failure(error); }
  }

  async signUp(email, password, data) {
    try {
      if (!validType(data.userType)) throw new Error('Choose an account type.');
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const result = await this.completeProfile(data);
      if (!result.success) return { ...result, user, needsProfile: true, error: 'Your sign-in account was created, but your profile could not be saved. Complete setup or retry on the recovery screen.' };
      return result;
    } catch (error) { return failure(error); }
  }

  async validateAccount(user, expectedType) {
    assertCurrent(user.uid);
    const result = await this.getUserData(user.uid);
    assertCurrent(user.uid);
    if (result.userData && expectedType && result.userData.userType !== expectedType) {
      // Even a failed sign-out must never grant access to a wrong-type login in the context.
      const signedOut = await this.signOut();
      return { success: false, rejectedAccount: true, code: 'auth/account-type-mismatch',
        error: `This is a ${result.userData.userType} account. Use its matching sign-in screen.${signedOut.success ? '' : ' Sign-out failed; retry signing out.'}` };
    }
    return result.success ? { ...result, user } : { ...result, user, needsProfile: result.missing };
  }

  async signIn(email, password, expectedType) {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      return await this.validateAccount(user, expectedType);
    } catch (error) { return failure(error); }
  }

  async signInWithGoogle(userType) {
    try {
      const token = await signInToGoogle();
      if (!token) return { success: false, canceled: true };
      const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(token));
      // Missing profiles are completed explicitly, including company details, on recovery.
      return await this.validateAccount(user, userType);
    } catch (error) { return failure(error); }
  }

  async signOut() {
    const uid = auth.currentUser?.uid;
    try {
      await signOut(auth);
      await signOutOfGoogle();
      const cleanup = await clearAccountLocalData(uid);
      return { success: true, cleanupWarning: cleanup.success ? null : cleanup.error };
    } catch (error) { return failure(error); }
  }

  async resetPassword(email) {
    try { await sendPasswordResetEmail(auth, email.trim()); return { success: true }; }
    catch (error) { return failure(error); }
  }

  async reauthenticate(password) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Please sign in again.');
      const providers = user.providerData?.map((item) => item.providerId) || [];
      let credential;
      if (providers.includes('password')) {
        if (!password) throw new Error('Enter your current password.');
        credential = EmailAuthProvider.credential(user.email, password);
      } else if (providers.includes('google.com')) {
        const token = await signInToGoogle();
        if (!token) return { success: false, canceled: true, error: 'Verification canceled.' };
        credential = GoogleAuthProvider.credential(token);
      } else throw new Error('Reauthentication for this sign-in provider is unavailable.');
      assertCurrent(user.uid);
      await reauthenticateWithCredential(user, credential);
      assertCurrent(user.uid);
      await user.getIdToken(true);
      return { success: true };
    } catch (error) { return failure(error); }
  }

  async updateUserPassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user?.providerData?.some((item) => item.providerId === 'password')) {
        throw new Error('Manage your password with your sign-in provider.');
      }
      if (typeof newPassword !== 'string' || newPassword.length < 6) throw new Error('Use at least 6 characters.');
      const verified = await this.reauthenticate(currentPassword);
      if (!verified.success) return verified;
      assertCurrent(user.uid);
      await updatePassword(user, newPassword);
      return { success: true };
    } catch (error) { return failure(error); }
  }

  getCurrentUser() { return auth.currentUser; }

  async getUserData(uid) {
    try {
      assertCurrent(uid);
      const snapshot = await getDoc(doc(db, 'users', uid));
      assertCurrent(uid);
      if (!snapshot.exists()) return { success: false, missing: true, error: 'Complete your account setup.' };
      const data = snapshot.data();
      if (!validType(data.userType)) return { success: false, error: 'Your account type is missing or invalid. Contact support through Privacy & data.' };
      if (data.profileComplete !== undefined && data.profileComplete !== true) {
        return { success: false, incomplete: true, userData: data, error: 'Complete your account setup.' };
      }
      return { success: true, userData: data };
    } catch (error) { return failure(error); }
  }

  async updateUserData(uid, data) {
    try {
      assertCurrent(uid);
      const changes = sanitizeProfileUpdate(data);
      await updateDoc(doc(db, 'users', uid), { ...changes, updatedAt: new Date().toISOString() });
      assertCurrent(uid);
      return { success: true, changes };
    } catch (error) { return failure(error); }
  }

  async deleteAccount() {
    const uid = auth.currentUser?.uid;
    try {
      if (!uid) throw new Error('Please sign in again.');
      const result = await requestBackend('/account/delete', {});
      if (result?.success !== true) throw new Error('Deletion was not confirmed. Please retry.');
      // The server has confirmed cloud deletion. Never delete cloud records client-first.
      const cleanup = await clearAccountLocalData(uid);
      let signOutWarning;
      if (auth.currentUser?.uid === uid) {
        try { await signOut(auth); }
        catch (_) { signOutWarning = 'Your account was deleted, but this device could not remove the saved sign-in. Clear app storage before using it again.'; }
      }
      await signOutOfGoogle();
      return { success: true, deletedUid: uid, cleanupWarning: signOutWarning || (cleanup.success ? null : cleanup.error) };
    } catch (error) {
      return { ...failure(error), requiresRecentLogin: error.code === 'auth/requires-recent-login' };
    }
  }
}

export default new AuthService();
