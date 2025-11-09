# 📱 Screens Documentation - Complete Guide

## 🎯 **What are Screens?**
Screens are the different pages/views that users see in the app. Each screen is a React component that represents a full page of the app.

## 📁 **Screens Folder Structure**
```
screens/
├── 🚀 SplashScreen.js           # App loading screen
├── 👤 UserTypeScreen.js         # Choose Personal or Company
├── 🔐 LoginScreen.js            # Personal user login
├── 📝 SignUpScreen.js           # Personal user registration
├── 🏢 CompanyLoginScreen.js     # Company user login
├── 🏢 CompanySignUpScreen.js    # Company registration
├── 🏠 DashboardScreen.js        # Personal dashboard
├── 🏢 CompanyDashboardScreen.js # Company dashboard
├── 💰 AddTransactionScreen.js   # Add new transaction
├── 📊 TransactionsScreen.js     # View all transactions
├── 💳 BudgetScreen.js           # Personal budget management
├── 📈 StatsScreen.js            # Personal statistics
├── 👤 ProfileScreen.js          # Personal profile
├── ⚙️ SettingsScreen.js         # Personal settings
└── ... (more screens)
```

## 🚀 **SplashScreen.js - App Loading Screen**

### **Purpose:**
- First screen users see when opening the app
- Shows app logo and loading animation
- Checks if user is already logged in
- Automatically navigates to appropriate screen

### **Key Functions:**
```javascript
// Main component function
export default function SplashScreen({ navigation })

// Auto-navigation logic
useEffect(() => {
  // Check authentication status
  // Navigate to Dashboard if logged in
  // Navigate to UserType if not logged in
}, []);
```

### **What it does:**
1. Shows beautiful animated logo
2. Checks Firebase authentication
3. If user logged in → go to Dashboard
4. If not logged in → go to UserType selection

## 👤 **UserTypeScreen.js - Choose User Type**

### **Purpose:**
- Let users choose between Personal or Company account
- First decision point for new users
- Beautiful UI with animations

### **Key Functions:**
```javascript
// Handle Personal selection
const handlePersonalSelect = () => {
  navigation.navigate('Login', { userType: 'personal' });
};

// Handle Company selection  
const handleCompanySelect = () => {
  navigation.navigate('CompanyLogin', { userType: 'company' });
};
```

### **What it does:**
1. Shows two beautiful cards: Personal vs Company
2. When user taps Personal → goes to LoginScreen
3. When user taps Company → goes to CompanyLoginScreen

## 🔐 **LoginScreen.js - Personal User Login**

### **Purpose:**
- Login form for personal users
- Email and password authentication
- Password reset functionality
- Navigation to registration

### **Key Functions:**
```javascript
// Main login function
const handleLogin = async () => {
  // Validate email and password
  // Call Firebase authentication
  // Check if user type is 'personal'
  // Navigate to Dashboard on success
};

// Password reset
const handleForgotPassword = () => {
  // Show email input dialog
  // Send password reset email via Firebase
};

// Navigate to registration
const handleSignUp = () => {
  navigation.navigate('Register', { userType: 'personal' });
};
```

### **What it does:**
1. Beautiful login form with email/password fields
2. "Show/Hide Password" toggle
3. "Forgot Password" functionality
4. "Sign Up" link to registration
5. Validates user is personal type
6. Success → Dashboard, Error → show message

## 📝 **SignUpScreen.js - Personal Registration**

### **Purpose:**
- Registration form for new personal users
- Creates Firebase account
- Stores user data in Firestore
- Auto-login after successful registration

### **Key Functions:**
```javascript
// Main registration function
const handleSignUp = async () => {
  // Validate all fields
  // Check password confirmation
  // Create Firebase account
  // Store user data in Firestore
  // Auto-login and navigate to Dashboard
};
```

### **Form Fields:**
- Full Name
- Email Address
- Password
- Confirm Password

### **What it does:**
1. Validates all input fields
2. Checks passwords match
3. Creates Firebase authentication account
4. Saves user profile to Firestore database
5. Automatically logs in user
6. Navigates to Dashboard

## 🏠 **DashboardScreen.js - Personal Dashboard**

### **Purpose:**
- Main screen for personal users
- Overview of financial health
- Quick access to key features
- Beautiful cards and statistics

### **Key Sections:**
```javascript
// Financial overview cards
const renderOverviewCards = () => {
  // Total Balance
  // Monthly Income
  // Monthly Expenses
  // Savings
};

// Recent transactions
const renderRecentTransactions = () => {
  // Last 5 transactions
  // Quick view with categories
};

// Budget progress
const renderBudgetProgress = () => {
  // Budget vs spending
  // Progress bars
  // Alerts if over budget
};
```

### **What it displays:**
1. **Welcome Message** - "Hello, [User Name]"
2. **Balance Overview** - Total balance, income, expenses
3. **Quick Actions** - Add Transaction, View Budget
4. **Recent Transactions** - Last few transactions
5. **Budget Status** - How much spent vs budget
6. **Spending Insights** - Charts and trends

## 💰 **AddTransactionScreen.js - Add New Transaction**

### **Purpose:**
- Form to add new income or expense
- Categorize transactions
- Save to Firebase database
- Update user's financial data

### **Key Functions:**
```javascript
// Main submit function
const handleSubmit = async () => {
  // Validate form data
  // Create transaction object
  // Save to Firestore
  // Update user's balance
  // Navigate back with success message
};

// Category selection
const selectCategory = (category) => {
  setSelectedCategory(category);
};

// Amount input handling
const handleAmountChange = (amount) => {
  // Format currency
  // Validate numeric input
};
```

### **Form Fields:**
- **Amount** - How much money
- **Type** - Income or Expense
- **Category** - food, bills, shopping, etc.
- **Description** - What was it for
- **Date** - When it happened

### **Categories Available:**
- 🍔 Food & Dining
- 🏠 Bills & Utilities  
- 🛍️ Shopping
- 🚗 Transportation
- 🎬 Entertainment
- 🏥 Healthcare
- 📚 Education
- 💼 Business
- 🎁 Gifts
- 📱 Other

## 📊 **TransactionsScreen.js - View All Transactions**

### **Purpose:**
- List all user's transactions
- Search and filter functionality
- Edit and delete transactions
- Export transaction data

### **Key Functions:**
```javascript
// Load transactions from database
const loadTransactions = async () => {
  // Fetch from Firestore
  // Sort by date
  // Apply filters
};

// Search functionality
const handleSearch = (query) => {
  // Filter transactions by description
  // Update displayed list
};

// Delete transaction
const handleDelete = async (transactionId) => {
  // Confirm with user
  // Delete from Firestore
  // Update local state
  // Show success message
};
```

### **Features:**
1. **Transaction List** - All transactions with details
2. **Search Bar** - Find specific transactions
3. **Filter Options** - By category, date, type
4. **Sort Options** - By date, amount, category
5. **Edit/Delete** - Modify existing transactions
6. **Pull to Refresh** - Update data

## 💳 **BudgetScreen.js - Budget Management**

### **Purpose:**
- Create and manage budgets
- Track spending vs budget
- Visual progress indicators
- Budget alerts and warnings

### **Key Functions:**
```javascript
// Create new budget
const createBudget = async (category, amount, period) => {
  // Validate inputs
  // Save to Firestore
  // Update UI
};

// Calculate budget progress
const calculateProgress = (budget, transactions) => {
  // Sum transactions for category
  // Calculate percentage spent
  // Determine if over/under budget
};
```

### **Budget Features:**
1. **Budget Creation** - Set amount for each category
2. **Progress Tracking** - Visual bars showing spent vs budget
3. **Alerts** - Warnings when approaching limits
4. **Period Selection** - Weekly, monthly, yearly budgets
5. **Budget History** - Past budget performance

This covers the main screens. Each screen follows similar patterns but serves different purposes in the user journey.