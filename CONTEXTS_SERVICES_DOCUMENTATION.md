# 🔄 Contexts & Services Documentation - App Logic & State

## 🎯 **What are Contexts?**
Contexts provide global state management - data that needs to be accessed from multiple screens throughout the app.

## 🎯 **What are Services?**
Services contain business logic and handle communication with external APIs (like Firebase).

## 📁 **Contexts Folder Structure**
```
contexts/
├── 🔐 AuthContext.js           # User authentication state
└── 🎨 ThemeContext.js          # App theming and colors
```

## 📁 **Services Folder Structure**
```
services/
├── 🔐 authService.js           # Firebase authentication
├── 💰 transactionService.js    # Transaction operations
├── 💳 budgetService.js         # Budget management
└── 💬 MessageService.js        # Global messaging
```

## 🔐 **AuthContext.js - Authentication State Management**

### **Purpose:**
Manages user authentication state globally - who's logged in, their profile data, and authentication functions.

### **Key State Variables:**
```javascript
const AuthContext = {
  user: null,                    // Firebase user object
  userData: null,                // User profile from Firestore
  loading: false,                // Authentication in progress
  initializing: true,            // App starting up
  isAuthenticated: false,        // Is user logged in?
  isPersonalUser: false,         // Is user type 'personal'?
  isCompanyUser: false          // Is user type 'company'?
}
```

### **Key Functions:**
```javascript
// Sign up new user
const signUp = async (email, password, additionalData) => {
  // Create Firebase account
  // Save profile to Firestore
  // Update context state
};

// Sign in existing user
const signIn = async (email, password) => {
  // Authenticate with Firebase
  // Load user profile
  // Update context state
};

// Sign out user
const signOut = async () => {
  // Sign out from Firebase
  // Clear context state
  // Navigate to login
};

// Update user profile
const updateUserProfile = async (updateData) => {
  // Update Firestore document
  // Update local state
};
```

### **How it's used:**
```javascript
// In any screen
import { useAuth } from '../contexts/AuthContext';

function MyScreen() {
  const { user, userData, signOut, isPersonalUser } = useAuth();
  
  if (!user) {
    return <Text>Please log in</Text>;
  }
  
  return (
    <View>
      <Text>Welcome, {userData?.fullName}!</Text>
      {isPersonalUser && <PersonalFeatures />}
      <Button title="Logout" onPress={signOut} />
    </View>
  );
}
```

### **What it does:**
1. **Global Auth State** - All screens know if user is logged in
2. **Auto-Login** - Remembers user between app sessions
3. **User Profile** - Stores name, email, user type, etc.
4. **Auth Functions** - Login, logout, register from anywhere
5. **Type Checking** - Easy to check if personal vs company user

## 🎨 **ThemeContext.js - App Theming System**

### **Purpose:**
Manages app appearance - colors, themes, dark/light mode, and visual styling throughout the app.

### **Key State Variables:**
```javascript
const ThemeContext = {
  theme: {},                     // Current theme colors
  isDarkMode: false,             // Dark or light mode
  currentThemeId: 'default',     // Which theme is active
  themeConfigs: {},              // Available themes
  isLoading: false              // Theme loading state
}
```

### **Available Themes:**
```javascript
const themeConfigs = {
  default: { primary: '#667eea', primaryLight: '#764ba2' },
  ocean: { primary: '#2196F3', primaryLight: '#00BCD4' },
  forest: { primary: '#4CAF50', primaryLight: '#009688' },
  sunset: { primary: '#FF9800', primaryLight: '#E91E63' },
  royal: { primary: '#9C27B0', primaryLight: '#3F51B5' },
  // ... more themes
}
```

### **Key Functions:**
```javascript
// Toggle between light and dark mode
const toggleTheme = async () => {
  // Switch isDarkMode
  // Save preference to storage
  // Update all colors
};

// Change color theme
const changeTheme = async (themeId) => {
  // Set new theme
  // Save preference to storage
  // Update all colors
};
```

### **Theme Colors Structure:**
```javascript
const theme = {
  // Backgrounds
  background: '#FFFFFF',         // Main background
  surface: '#FFFFFF',           // Card backgrounds
  card: '#FFFFFF',              // Specific card color
  
  // Text colors
  text: '#1A1A1A',             // Primary text
  textSecondary: '#666666',     // Secondary text
  textLight: '#999999',         // Light text
  
  // Primary colors
  primary: '#667eea',           // Main brand color
  primaryLight: '#764ba2',      // Lighter brand color
  
  // Status colors
  success: '#4CAF50',           // Green for success
  error: '#F44336',             // Red for errors
  warning: '#FF9800',           // Orange for warnings
  info: '#2196F3',              // Blue for info
  
  // UI elements
  border: '#E0E0E0',            // Border color
  divider: '#E0E0E0',           // Divider lines
  shadow: '#000000',            // Shadow color
  
  // Component specific
  tabBar: '#FFFFFF',            // Bottom tab bar
  cardBackground: '#FFFFFF',    // Card backgrounds
  inputBackground: '#F5F5F5',   // Input field backgrounds
  buttonText: '#FFFFFF',        // Button text color
}
```

### **How it's used:**
```javascript
// In any screen or component
import { useTheme } from '../contexts/ThemeContext';

function MyScreen() {
  const { theme, isDarkMode, toggleTheme, changeTheme } = useTheme();
  
  return (
    <View style={{ backgroundColor: theme.background }}>
      <Text style={{ color: theme.text }}>Hello World</Text>
      <Button 
        title={isDarkMode ? "Light Mode" : "Dark Mode"}
        onPress={toggleTheme}
      />
      <Button 
        title="Ocean Theme"
        onPress={() => changeTheme('ocean')}
      />
    </View>
  );
}
```

### **What it does:**
1. **Consistent Colors** - All screens use same color scheme
2. **Theme Switching** - Users can change app appearance
3. **Dark/Light Mode** - Automatic color adjustments
4. **Persistence** - Remembers user's theme choice
5. **Easy Styling** - Components automatically get right colors

## 🔐 **authService.js - Firebase Authentication Service**

### **Purpose:**
Handles all Firebase authentication operations - creating accounts, logging in, password resets, etc.

### **Key Functions:**
```javascript
// Create new user account
async signUp(email, password, userData) {
  // Step 1: Create Firebase Auth account
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  // Step 2: Update user profile
  await updateProfile(user, { displayName: userData.fullName });
  
  // Step 3: Save user data to Firestore
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email,
    fullName: userData.fullName,
    userType: userData.userType,
    createdAt: new Date().toISOString()
  });
  
  return { success: true, user };
}

// Sign in existing user
async signIn(email, password) {
  // Authenticate with Firebase
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  
  // Get user profile from Firestore
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.data();
  
  return { success: true, user, userData };
}

// Send password reset email
async resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
  return { success: true };
}

// Update user password
async updateUserPassword(currentPassword, newPassword) {
  // Re-authenticate user first
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  
  // Update password
  await updatePassword(user, newPassword);
  return { success: true };
}
```

### **What it does:**
1. **Account Creation** - Creates Firebase accounts
2. **Authentication** - Verifies user credentials
3. **Profile Management** - Stores user data in Firestore
4. **Password Reset** - Sends reset emails
5. **Error Handling** - Returns success/error status

## 💰 **transactionService.js - Transaction Management Service**

### **Purpose:**
Handles all transaction-related operations - adding, editing, deleting, and fetching transactions.

### **Key Functions:**
```javascript
// Add new transaction
async addTransaction(userId, transactionData) {
  const transaction = {
    id: generateId(),
    userId: userId,
    amount: transactionData.amount,
    category: transactionData.category,
    type: transactionData.type, // 'income' or 'expense'
    description: transactionData.description,
    date: transactionData.date,
    createdAt: new Date().toISOString()
  };
  
  // Save to Firestore
  await setDoc(doc(db, 'transactions', transaction.id), transaction);
  return { success: true, transaction };
}

// Get user's transactions
async getUserTransactions(userId, filters = {}) {
  let query = collection(db, 'transactions');
  
  // Filter by user
  query = query.where('userId', '==', userId);
  
  // Apply date filters
  if (filters.startDate) {
    query = query.where('date', '>=', filters.startDate);
  }
  
  // Apply category filter
  if (filters.category) {
    query = query.where('category', '==', filters.category);
  }
  
  // Order by date
  query = query.orderBy('date', 'desc');
  
  const snapshot = await getDocs(query);
  const transactions = snapshot.docs.map(doc => doc.data());
  
  return { success: true, transactions };
}

// Update transaction
async updateTransaction(transactionId, updateData) {
  await updateDoc(doc(db, 'transactions', transactionId), {
    ...updateData,
    updatedAt: new Date().toISOString()
  });
  return { success: true };
}

// Delete transaction
async deleteTransaction(transactionId) {
  await deleteDoc(doc(db, 'transactions', transactionId));
  return { success: true };
}
```

### **What it does:**
1. **CRUD Operations** - Create, Read, Update, Delete transactions
2. **Data Validation** - Ensures transaction data is correct
3. **Filtering** - Get transactions by date, category, type
4. **User Isolation** - Each user only sees their transactions
5. **Error Handling** - Graceful error management

## 💳 **budgetService.js - Budget Management Service**

### **Purpose:**
Handles budget creation, tracking, and analysis - helps users manage their spending limits.

### **Key Functions:**
```javascript
// Create new budget
async createBudget(userId, budgetData) {
  const budget = {
    id: generateId(),
    userId: userId,
    category: budgetData.category,
    amount: budgetData.amount,
    period: budgetData.period, // 'weekly', 'monthly', 'yearly'
    startDate: budgetData.startDate,
    endDate: budgetData.endDate,
    createdAt: new Date().toISOString()
  };
  
  await setDoc(doc(db, 'budgets', budget.id), budget);
  return { success: true, budget };
}

// Get budget progress
async getBudgetProgress(userId, budgetId) {
  // Get budget details
  const budgetDoc = await getDoc(doc(db, 'budgets', budgetId));
  const budget = budgetDoc.data();
  
  // Get transactions for this budget period and category
  const transactions = await getTransactionsForBudget(userId, budget);
  
  // Calculate spent amount
  const totalSpent = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate progress
  const progress = {
    budgetAmount: budget.amount,
    spentAmount: totalSpent,
    remainingAmount: budget.amount - totalSpent,
    percentageUsed: (totalSpent / budget.amount) * 100,
    isOverBudget: totalSpent > budget.amount
  };
  
  return { success: true, progress };
}
```

### **What it does:**
1. **Budget Creation** - Set spending limits by category
2. **Progress Tracking** - Calculate spent vs budget amounts
3. **Period Management** - Handle weekly, monthly, yearly budgets
4. **Overspending Detection** - Alert when over budget
5. **Analytics** - Provide spending insights

This covers the core contexts and services that power the app's functionality. They work together to provide a seamless user experience.