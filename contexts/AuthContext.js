import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import authService from '../services/authService';
import { clearAccountLocalData } from '../utils/accountLocalData';

const AuthContext = createContext();
const emptySession = { user: null, userData: null, profileStatus: 'signedOut', profileError: null };

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState({ ...emptySession, profileStatus: 'loading' });
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const revision = useRef(0);
  const mounted = useRef(true);
  const mutating = useRef(false);
  const blockedUid = useRef(null);
  const activeUid = useRef(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const loadSession = useCallback(async (firebaseUser) => {
    const ticket = ++revision.current;
    const previousUid = activeUid.current;
    activeUid.current = firebaseUser?.uid || null;
    if (previousUid && previousUid !== activeUid.current) await clearAccountLocalData(previousUid);
    if (!mounted.current || ticket !== revision.current) return;
    if (!firebaseUser) {
      blockedUid.current = null;
      setSession(emptySession);
      setInitializing(false);
      return;
    }
    if (blockedUid.current === firebaseUser.uid) {
      setSession({ user: firebaseUser, userData: null, profileStatus: 'blocked', profileError: 'This login was rejected for the selected account type. Sign out and use the matching sign-in screen.' });
      setInitializing(false);
      return;
    }
    setSession({ user: firebaseUser, userData: null, profileStatus: 'loading', profileError: null });
    const result = await authService.getUserData(firebaseUser.uid);
    if (!mounted.current || ticket !== revision.current || auth.currentUser?.uid !== firebaseUser.uid) return;
    const profileStatus = result.success ? 'ready' : result.missing ? 'missing' : result.incomplete ? 'incomplete' : 'error';
    setSession({ user: firebaseUser, userData: result.success || result.incomplete ? result.userData : null,
      profileStatus, profileError: result.error || null });
    setInitializing(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (mutating.current) return; // Signup/Auth events can arrive before the Firestore write.
      if (firebaseUser?.uid && firebaseUser.uid === activeUid.current && sessionRef.current.profileStatus === 'ready') return;
      void loadSession(firebaseUser);
    });
    return () => { mounted.current = false; revision.current += 1; unsubscribe(); };
  }, [loadSession]);

  const runAuthAction = useCallback(async (action, { preserveFailure = false } = {}) => {
    if (mutating.current) return { success: false, error: 'Another account operation is in progress.' };
    mutating.current = true;
    revision.current += 1; // Invalidate every earlier profile read/update.
    if (mounted.current) setLoading(true);
    let result;
    try {
      result = await action();
      if (result.rejectedAccount) blockedUid.current = auth.currentUser?.uid || null;
      if (result.success && result.deletedUid && (!auth.currentUser || auth.currentUser.uid === result.deletedUid)) {
        blockedUid.current = result.deletedUid;
        activeUid.current = null;
        if (mounted.current) setSession(emptySession);
      } else if (result.success && result.user && result.userData && auth.currentUser?.uid === result.user.uid) {
        blockedUid.current = null;
        activeUid.current = result.user.uid;
        if (mounted.current) setSession({ user: result.user, userData: result.userData, profileStatus: 'ready', profileError: null });
      } else if (!result.success && preserveFailure && auth.currentUser?.uid === sessionRef.current.user?.uid) {
        // Keep the recovery screen mounted so it can show the write error and let
        // the user edit/retry without losing the incomplete-profile state.
      } else {
        await loadSession(auth.currentUser);
      }
      return result;
    } catch (error) {
      await loadSession(auth.currentUser);
      return { success: false, error: error.message || 'The account operation failed.' };
    } finally {
      mutating.current = false;
      if (mounted.current) { setLoading(false); setInitializing(false); }
    }
  }, [loadSession]);

  const signUp = useCallback((email, password, data) => runAuthAction(() => authService.signUp(email, password, data)), [runAuthAction]);
  const signIn = useCallback((email, password, type) => runAuthAction(() => authService.signIn(email, password, type)), [runAuthAction]);
  const signInWithGoogle = useCallback((type) => runAuthAction(() => authService.signInWithGoogle(type)), [runAuthAction]);
  const signOut = useCallback(() => runAuthAction(() => authService.signOut()), [runAuthAction]);
  const deleteAccount = useCallback(() => runAuthAction(() => authService.deleteAccount()), [runAuthAction]);
  const completeProfile = useCallback((data) => runAuthAction(() => authService.completeProfile(data), { preserveFailure: true }), [runAuthAction]);

  const updateUserProfile = useCallback(async (data) => {
    const uid = session.user?.uid;
    if (!uid || mutating.current) return { success: false, error: 'Please wait for your account to finish loading.' };
    const ticket = ++revision.current;
    const result = await authService.updateUserData(uid, data);
    if (!mounted.current || ticket !== revision.current || auth.currentUser?.uid !== uid) return { success: false, stale: true, error: 'Your session changed. Reopen your profile.' };
    if (result.success) setSession((previous) => previous.user?.uid === uid
      ? { ...previous, userData: { ...previous.userData, ...result.changes } } : previous);
    return result;
  }, [session.user?.uid]);

  const refreshUserData = useCallback(async () => {
    if (!mutating.current) await loadSession(auth.currentUser);
  }, [loadSession]);
  const resetPassword = useCallback((email) => authService.resetPassword(email), []);
  const updatePassword = useCallback((current, next) => authService.updateUserPassword(current, next), []);
  const reauthenticate = useCallback((password) => authService.reauthenticate(password), []);

  const value = useMemo(() => ({ ...session, loading, initializing, signUp, signIn, signInWithGoogle,
    signOut, deleteAccount, completeProfile, updateUserProfile, resetPassword, updatePassword,
    reauthenticate, refreshUserData, isAuthenticated: session.profileStatus === 'ready' && !!session.user,
    isPersonalUser: session.userData?.userType === 'personal', isCompanyUser: session.userData?.userType === 'company',
  }), [session, loading, initializing, signUp, signIn, signInWithGoogle, signOut, deleteAccount,
    completeProfile, updateUserProfile, resetPassword, updatePassword, reauthenticate, refreshUserData]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
