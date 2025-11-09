# 🔄 Data Flow Documentation - How Information Moves Through the App

## 🎯 **Understanding Data Flow**
Data flow is how information moves through your app - from user input to database storage to displaying results. Understanding this helps you see how everything connects.

## 📊 **Complete Data Journey Example: Adding a Transaction**

### **Step 1: User Input (AddTransactionScreen.js)**
```javascript
// User fills out form
const [amount, setAmount] = useState('');
const [category, setCategory] = useState('food');
const [description, setDescription] = useState('');

// User taps "Save Transaction" button
const handleSubmit = async () => {
  // Validate input
  if (!amount || !description) {
    Alert.alert('Error', 'Please fill all fields');
    return;
  }
  
  // Create transaction object
  const transactionData = {
    amount: parseFloat(amount),
    category: category,
    description: description,
    type: 'expense',
    date: new Date().toISOString()
  };
  
  // Call the transaction hook
  const result = await addTransaction(transactionData);
  
  if (result.success) {
    Alert.alert('Success', 'Transaction added!');
    navigation.goBack();
  } else {
    Alert.alert('Error', result.error);
  }
};
```

### **Step 2: Hook Processing (useTransactions.js)**
```javascript
// Hook receives the transaction data
const addTransaction = async (transactionData) => {
  setLoading(true);
  
  try {
    // Call the service layer
    const result = await transactionService.addTransaction(userId, transactionData);
    
    if (result.success) {
      // Update local state immediately (optimistic update)
      setTransactions(prevTransactions => [
        result.transaction,
        ...prevTransactions
      ]);
      
      // Update totals
      updateTotals();
      
      return { success: true };
    }
    
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    setLoading(false);
  }
};
```

### **Step 3: Service Layer (transactionService.js)**
```javascript
// Service handles Firebase operations
async addTransaction(userId, transactionData) {
  try {
    // Generate unique ID
    const transactionId = generateUniqueId();
    
    // Create complete transaction object
    const transaction = {
      id: transactionId,
      userId: userId,
      ...transactionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save to Firebase Firestore
    await setDoc(doc(db, 'transactions', transactionId), transaction);
    
    // Update user's balance
    await updateUserBalance(userId, transactionData.amount, transactionData.type);
    
    return { success: true, transaction };
  } catch (error) {
    console.error('Transaction service error:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to update user balance
async updateUserBalance(userId, amount, type) {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const userData = userDoc.data();
  
  const currentBalance = userData.balance || 0;
  const newBalance = type === 'income' 
    ? currentBalance + amount 
    : currentBalance - amount;
  
  await updateDoc(userRef, {
    balance: newBalance,
    updatedAt: new Date().toISOString()
  });
}
```

### **Step 4: Firebase Storage**
```javascript
// Data is stored in Firestore collections:

// transactions collection
{
  "transactions": {
    "trans_123": {
      "id": "trans_123",
      "userId": "user_456",
      "amount": 25.50,
      "category": "food",
      "type": "expense",
      "description": "Lunch at cafe",
      "date": "2024-01-15T12:30:00Z",
      "createdAt": "2024-01-15T12:30:00Z"
    }
  }
}

// users collection (balance updated)
{
  "users": {
    "user_456": {
      "uid": "user_456",
      "email": "john@example.com",
      "fullName": "John Doe",
      "balance": 1474.50,  // Updated balance
      "updatedAt": "2024-01-15T12:30:00Z"
    }
  }
}
```

### **Step 5: Real-time Updates**
```javascript
// Other screens automatically update because they use the same hook
// DashboardScreen.js
function DashboardScreen() {
  const { transactions, calculateTotals } = useTransactions();
  
  // This automatically includes the new transaction
  const totals = calculateTotals();
  
  return (
    <View>
      <Text>Balance: ${totals.netBalance}</Text>
      <Text>Recent Transactions: {transactions.length}</Text>
    </View>
  );
}
```

## 🔄 **Authentication Data Flow**

### **Login Process:**
```
1. User enters email/password in LoginScreen
2. LoginScreen calls AuthContext.signIn()
3. AuthContext calls authService.signIn()
4. authService authenticates with Firebase Auth
5. authService fetches user profile from Firestore
6. AuthContext updates global state
7. All screens now know user is logged in
8. Navigation automatically goes to Dashboard
```

### **Registration Process:**
```
1. User fills form in SignUpScreen
2. SignUpScreen calls AuthContext.signUp()
3. AuthContext calls authService.signUp()
4. authService creates Firebase Auth account
5. authService saves profile to Firestore
6. AuthContext updates global state
7. User is automatically logged in
8. Navigation goes to Dashboard
```

## 🎨 **Theme Data Flow**

### **Theme Change Process:**
```
1. User selects new theme in ThemesScreen
2. ThemesScreen calls ThemeContext.changeTheme()
3. ThemeContext updates theme state
4. ThemeContext saves preference to AsyncStorage
5. All screens re-render with new colors
6. Navigation theme updates automatically
```

### **Dark Mode Toggle:**
```
1. User taps dark mode toggle
2. Component calls ThemeContext.toggleTheme()
3. ThemeContext switches isDarkMode state
4. All theme colors automatically adjust
5. Entire app switches to dark/light mode
```

## 💾 **Data Persistence**

### **What Gets Saved Locally (AsyncStorage):**
- Theme preferences (dark mode, selected theme)
- User preferences and settings
- Temporary data during offline usage

### **What Gets Saved to Firebase:**
- User accounts and profiles
- All transactions
- All budgets
- User settings and preferences

### **Offline Handling:**
```javascript
// The app handles offline scenarios
try {
  // Try to save to Firebase
  await saveToFirebase(data);
} catch (error) {
  if (error.code === 'unavailable') {
    // Save locally for later sync
    await saveToLocalStorage(data);
    showMessage('Saved locally. Will sync when online.');
  }
}
```

## 🔄 **State Management Flow**

### **Global State (Contexts):**
- **AuthContext** - User authentication and profile
- **ThemeContext** - App appearance and colors

### **Local State (useState):**
- **Screen State** - Form inputs, loading states, UI state
- **Component State** - Button pressed states, animations

### **Server State (Firebase):**
- **User Data** - Profiles, settings, preferences
- **Transaction Data** - All financial transactions
- **Budget Data** - Budget limits and tracking

### **How They Work Together:**
```javascript
// Example: DashboardScreen
function DashboardScreen() {
  // Global state from contexts
  const { user, userData } = useAuth();           // Who's logged in
  const { theme } = useTheme();                   // Current colors
  
  // Server state from hooks
  const { transactions, loading } = useTransactions();  // User's transactions
  const { budgets } = useBudgets();                     // User's budgets
  
  // Local state for this screen
  const [refreshing, setRefreshing] = useState(false);  // Pull-to-refresh
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // Time filter
  
  // All states work together to create the UI
  return (
    <View style={{ backgroundColor: theme.background }}>
      <Text style={{ color: theme.text }}>
        Welcome, {userData?.fullName}!
      </Text>
      <Text>Transactions: {transactions.length}</Text>
      <Text>Budgets: {budgets.length}</Text>
    </View>
  );
}
```

This data flow ensures that:
1. **Data is consistent** across all screens
2. **Changes update everywhere** automatically
3. **Offline scenarios** are handled gracefully
4. **User experience** is smooth and responsive
5. **Data integrity** is maintained