import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import authService from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);

          // Get user data from Firestore
          const result = await authService.getUserData(firebaseUser.uid);
          if (result.success) {
            setUserData(result.userData);
          }
        } else {
          setUser(null);
          setUserData(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        setLoading(false);
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, []);

  const signUp = useCallback(async (email, password, additionalData) => {
    setLoading(true);
    try {
      const result = await authService.signUp(email, password, additionalData);
      if (result.success) {
        // User state will be updated by onAuthStateChanged
        return { success: true };
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const result = await authService.signIn(email, password);
      if (result.success) {
        // Optimistically update state
        setUser(result.user);
        setUserData(result.userData);
        return { success: true, userData: result.userData };
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async (idToken, userType) => {
    setLoading(true);
    try {
      const result = await authService.signInWithGoogle(idToken, userType);
      if (result.success) {
        // Optimistically update state
        setUser(result.user);
        setUserData(result.userData);
        return { success: true, userData: result.userData };
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      const result = await authService.signOut();
      if (result.success) {
        setUser(null);
        setUserData(null);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUserProfile = useCallback(async (updateData) => {
    if (!user) return { success: false, error: 'No user logged in' };

    try {
      const result = await authService.updateUserData(user.uid, updateData);

      if (result.success) {
        // Update local userData
        setUserData(prev => ({ ...prev, ...updateData }));
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [user]);

  const resetPassword = useCallback(async (email) => {
    try {
      return await authService.resetPassword(email);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const updatePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      return await authService.updateUserPassword(currentPassword, newPassword);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!user) return;

    try {
      const result = await authService.getUserData(user.uid);
      if (result.success) {
        setUserData(result.userData);
      }
    } catch (error) {
      console.error('Refresh user data error:', error);
    }
  }, [user]);

  const value = useMemo(() => ({
    user,
    userData,
    loading,
    initializing,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateUserProfile,
    resetPassword,
    updatePassword,
    refreshUserData,
    isAuthenticated: !!user,
    isPersonalUser: userData?.userType === 'personal',
    isCompanyUser: userData?.userType === 'company',
  }), [
    user,
    userData,
    loading,
    initializing,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateUserProfile,
    resetPassword,
    updatePassword,
    refreshUserData,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
