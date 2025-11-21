// 🧪 Firebase Connection Test
// Run this in your browser console or as a standalone test

import { auth, db } from './config/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

// Test Firebase Connection
export const testFirebaseConnection = async () => {
  console.log('🔥 Testing Firebase Connection...');
  
  try {
    // Test 1: Check if Firebase is initialized
    console.log('✅ Firebase Auth:', auth);
    console.log('✅ Firebase DB:', db);
    
    // Test 2: Try to create a test user
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'test123456';
    
    console.log(`🧪 Creating test user: ${testEmail}`);
    
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    const user = userCredential.user;
    
    console.log('✅ User created successfully:', user.uid);
    
    // Test 3: Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email: testEmail,
      fullName: 'Test User',
      userType: 'personal',
      createdAt: new Date(),
      profileComplete: false
    });
    
    console.log('✅ User document created in Firestore');
    
    // Test 4: Try to sign in with the same credentials
    console.log('🧪 Testing sign in...');
    
    const signInResult = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    console.log('✅ Sign in successful:', signInResult.user.uid);
    
    console.log('🎉 ALL TESTS PASSED! Firebase is working correctly.');
    
    return {
      success: true,
      testEmail,
      testPassword,
      userId: user.uid
    };
    
  } catch (error) {
    console.error('❌ Firebase test failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    return {
      success: false,
      error: error.message,
      errorCode: error.code
    };
  }
};

// Usage: Call this function to test your Firebase setup
// testFirebaseConnection().then(result => console.log('Test result:', result));