# 📱 Expenzo Finance App - Complete Project Documentation

## 🎯 **What is Expenzo?**

Expenzo is a **React Native finance tracking application** that helps both **individuals** and **companies** manage their finances. Think of it as a digital wallet that tracks your income, expenses, budgets, and provides insights about your spending habits.

## 🏗️ **Project Architecture Overview**

```
MyReactApp/
├── 📱 App.js                    # Main app entry point
├── 📱 index.js                  # React Native entry point
├── 📁 components/               # Reusable UI components
├── 📁 contexts/                 # React contexts (global state)
├── 📁 hooks/                    # Custom React hooks
├── 📁 navigation/               # App navigation setup
├── 📁 screens/                  # All app screens/pages
├── 📁 services/                 # Business logic & API calls
├── 📁 config/                   # Configuration files
├── 📁 theme/                    # App theming
└── 📁 utils/                    # Utility functions
```

## 🎭 **Two Types of Users**

### **Personal Users** 👤
- Track personal income and expenses
- Set personal budgets
- View spending statistics
- Manage personal financial goals

### **Company Users** 🏢
- Track company finances
- Manage team budgets
- Generate business reports
- Handle multiple departments

## 🔥 **Core Features**

### **Authentication System** 🔐
- User registration and login
- Firebase authentication
- Separate flows for personal vs company users
- Password reset functionality

### **Transaction Management** 💰
- Add income and expense transactions
- Categorize transactions (food, bills, shopping, etc.)
- Edit and delete transactions
- Search and filter transactions

### **Budget Management** 📊
- Create budgets for different categories
- Track budget vs actual spending
- Budget alerts and notifications
- Visual budget progress indicators

### **Dashboard & Analytics** 📈
- Overview of financial health
- Spending trends and patterns
- Category-wise breakdowns
- Monthly/yearly comparisons

### **Theming System** 🎨
- Multiple color themes
- Light and dark mode
- Customizable appearance
- Theme persistence

## 🛠️ **Technology Stack**

### **Frontend Framework**
- **React Native** - Cross-platform mobile development
- **Expo** - Development platform and tools

### **Backend & Database**
- **Firebase Authentication** - User management
- **Firestore Database** - NoSQL database for data storage
- **Firebase Storage** - File storage (if needed)

### **Navigation**
- **React Navigation v7** - Screen navigation
- **Stack Navigator** - Screen transitions
- **Tab Navigator** - Bottom tab navigation

### **State Management**
- **React Context** - Global state management
- **React Hooks** - Local state management

### **UI & Styling**
- **React Native Vector Icons** - Icons
- **Linear Gradient** - Gradient backgrounds
- **Animated API** - Smooth animations

## 📱 **App Flow Overview**

### **First Time User Journey:**
1. **Splash Screen** → Shows app logo and loading
2. **User Type Selection** → Choose Personal or Company
3. **Registration** → Create account with email/password
4. **Dashboard** → Main screen with financial overview
5. **Add Transactions** → Start tracking finances

### **Returning User Journey:**
1. **Splash Screen** → Auto-login if remembered
2. **Dashboard** → Direct to main screen
3. **Navigate** → Use tabs to access different features

## 🗂️ **Data Structure**

### **User Data (Firestore)**
```javascript
users/{userId} = {
  uid: "user123",
  email: "user@example.com",
  fullName: "John Doe",
  userType: "personal" | "company",
  createdAt: "2024-01-01T00:00:00Z",
  profileComplete: true
}
```

### **Transaction Data**
```javascript
transactions/{transactionId} = {
  id: "trans123",
  userId: "user123",
  amount: 50.00,
  category: "food",
  type: "expense" | "income",
  description: "Lunch at restaurant",
  date: "2024-01-01T12:00:00Z"
}
```

### **Budget Data**
```javascript
budgets/{budgetId} = {
  id: "budget123",
  userId: "user123",
  category: "food",
  amount: 500.00,
  period: "monthly",
  createdAt: "2024-01-01T00:00:00Z"
}
```

This is the overview. Let me create detailed documentation for each folder next.