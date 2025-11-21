import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from '../config/firebase';

export const userService = {
  // Update user profile in both Auth and Firestore
  updateUserProfile: async (user, profileData) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      
      // Update Firestore document
      await updateDoc(userRef, {
        ...profileData,
        updatedAt: new Date().toISOString(),
      });

      // Update Firebase Auth profile if displayName is provided
      if (profileData.fullName) {
        await updateProfile(user, {
          displayName: profileData.fullName,
        });
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Failed to update profile' 
      };
    }
  },

  // Get user profile data
  getUserProfile: async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return { 
          success: true, 
          data: userSnap.data() 
        };
      } else {
        return { 
          success: false, 
          error: 'User profile not found' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Failed to get profile' 
      };
    }
  },

  // Update company-specific information
  updateCompanyInfo: async (userId, companyData) => {
    try {
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        ...companyData,
        updatedAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Failed to update company information' 
      };
    }
  },

  // Update user preferences
  updateUserPreferences: async (userId, preferences) => {
    try {
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        preferences: {
          ...preferences,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Failed to update preferences' 
      };
    }
  },
};