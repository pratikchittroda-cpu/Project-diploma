import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  signInWithCredential,
  deleteUser
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

class AuthService {
  // Sign in with Google
  async signInWithGoogle(idToken, userType = 'personal') {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      // Get or create user data from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userData;
      if (!userDocSnap.exists()) {
        userData = {
          uid: user.uid,
          email: user.email,
          fullName: user.displayName || 'Google User',
          userType: userType,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          profileComplete: false,
          provider: 'google'
        };
        await setDoc(userDocRef, userData);
      } else {
        userData = userDocSnap.data();
        if (userData.userType && userData.userType !== userType) {
          await signOut(auth);
          return {
            success: false,
            error: `This Google account is registered as a ${userData.userType} account.`,
          };
        }
      }

      return { success: true, user, userData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Sign up with email and password
  async signUp(email, password, userData) {
    try {
      // Step 1: Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Step 2: Update user profile
      await updateProfile(user, {
        displayName: userData.fullName
      });

      // Step 3: Create user document in Firestore
      const userDoc = {
        uid: user.uid,
        email: user.email,
        fullName: userData.fullName,
        userType: userData.userType || 'personal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        profileComplete: false,
        ...userData
      };

      await setDoc(doc(db, 'users', user.uid), userDoc);
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Sign in with email and password
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;

      return { success: true, user, userData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Sign out
  async signOut() {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send password reset email
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Update user password
  async updateUserPassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  }

  // Get user data from Firestore
  async getUserData(uid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return { success: true, userData: userDoc.data() };
      } else {
        return { success: false, error: 'User not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Update user data in Firestore
  async updateUserData(uid, userData) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...userData,
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteAccount() {
    try {
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'No user logged in' };
      }

      const tokenResult = await user.getIdTokenResult();
      const authTime = new Date(tokenResult.authTime).getTime();
      const recentLoginWindowMs = 5 * 60 * 1000;

      if (Date.now() - authTime > recentLoginWindowMs) {
        return {
          success: false,
          requiresRecentLogin: true,
          error: 'Please sign in again before deleting your account.',
        };
      }

      await this.deleteUserOwnedData(user.uid);
      await deleteUser(user);

      return { success: true };
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        return {
          success: false,
          requiresRecentLogin: true,
          error: 'Please sign in again before deleting your account.',
        };
      }

      return { success: false, error: error.message };
    }
  }

  async deleteUserOwnedData(uid) {
    const userOwnedCollections = ['transactions', 'budgets', 'teams', 'members'];
    let batch = writeBatch(db);
    let operationCount = 0;

    const commitIfNeeded = async (force = false) => {
      if (operationCount === 0 || (!force && operationCount < 450)) return;

      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    };

    for (const collectionName of userOwnedCollections) {
      const snapshot = await getDocs(
        query(collection(db, collectionName), where('userId', '==', uid))
      );

      for (const documentSnapshot of snapshot.docs) {
        batch.delete(documentSnapshot.ref);
        operationCount += 1;
        await commitIfNeeded();
      }
    }

    batch.delete(doc(db, 'users', uid));
    operationCount += 1;
    await commitIfNeeded(true);
  }
}

export default new AuthService();
