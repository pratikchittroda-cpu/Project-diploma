import React, { createContext, useContext, useState, useEffect } from 'react';
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
        if (initializing) setInitializing(false);
      }
    });

    return unsubscribe;
  }, [initializing]);

  const signUp = async (email, password, additionalData) => {
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
  };

  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const result = await authService.signIn(email, password);
      if (result.success) {
        // User state will be updated by onAuthStateChanged
        return { success: true, userData: result.userData };
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
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
  };

  const updateUserProfile = async (updateData) => {
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
  };

  const resetPassword = async (email) => {
    try {
      return await authService.resetPassword(email);
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const updatePassword = async (currentPassword, newPassword) => {
    try {
      return await authService.updateUserPassword(currentPassword, newPassword);
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const refreshUserData = async () => {
    if (!user) return;

    try {
      const result = await authService.getUserData(user.uid);
      if (result.success) {
        setUserData(result.userData);
      }
    } catch (error) {
      console.error('Refresh user data error:', error);
    }
  };

  const value = {
    user,
    userData,
    loading,
    initializing,
    signUp,
    signIn,
    signOut,
    updateUserProfile,
    resetPassword,
    updatePassword,
    refreshUserData,
    isAuthenticated: !!user,
    isPersonalUser: userData?.userType === 'personal',
    isCompanyUser: userData?.userType === 'company',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};