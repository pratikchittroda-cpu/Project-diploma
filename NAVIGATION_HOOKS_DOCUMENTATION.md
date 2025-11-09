# 🧭 Navigation & Hooks Documentation - App Flow & Custom Logic

## 🎯 **What is Navigation?**
Navigation controls how users move between different screens in the app. It's like the roads that connect different pages.

## 🎯 **What are Hooks?**
Hooks are custom functions that contain reusable logic. They help avoid repeating code across multiple screens.

## 📁 **Navigation Folder Structure**
```
navigation/
├── 🧭 AppNavigator.js          # Main navigation setup
├── 📱 TabNavigator.js          # Personal user bottom tabs
├── 🏢 CompanyTabNavigator.js   # Company user bottom tabs
└── ✨ AnimationConfig.js       # Screen transition animations
```

## 📁 **Hooks Folder Structure**
```
hooks/
├── 💰 useTransactions.js       # Transaction management logic
├── 💳 useBudgets.js            # Budget management logic
└── 💬 useThemedMessageBox.js   # Message box logic
```

## 🧭 **AppNavigator.js - Main Navigation Controller**

### **Purpose:**
This is the master navigation file that controls the entire app flow. It decides which screens users can access and how they move between them.

### **Navigation Structure:**
```
App Navigation Flow:
├── 🚀 Splash Screen (entry point)
├── 👤 User Type Selection
├── 🔐 Authentication Screens
│   ├── Personal Login/Register
│   └── Company Login/Register
├── 📱 Personal App (TabNavigator)
│   ├── Dashboard Tab
│   ├── Transactions Tab
│   ├── Add Transaction Tab
│   ├── Budget Tab
│   └── Stats Tab
└── 🏢 Company App (CompanyTabNavigator)
    ├── Company Dashboard Tab
    ├── Company Reports Tab
    ├── Add Company Transaction Tab
    ├── Team Management Tab
    └── Company Budget Tab
```

### **Key Functions:**
```javascript
// Main navigator component
export default function AppNavigator() {
  const { theme, isLoading } = useTheme();
  const { user, userData } = useAuth();

  // Don't show navigation until theme loads
  if (isLoading || !theme) {
    return <LoadingScreen />;
  }

  // Create navigation theme
  const navigationTheme = {
    colors: {
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border
    }
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator initialRouteName="Splash">
        {/* All screen definitions */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### **Screen Definitions:**
```javascript
// Authentication screens
<Stack.Screen name="Splash" component={SplashScreen} />
<Stack.Screen name="UserType" component={UserTypeScreen} />
<Stack.Screen name="Login" component={LoginScreen} />
<Stack.Screen name="Register" component={SignUpScreen} />

// Main app screens
<Stack.Screen name="Dashboard" component={TabNavigator} />
<Stack.Screen name="CompanyDashboard" component={CompanyTabNavigator} />

// Profile screens
<Stack.Screen name="Profile" component={ProfileScreen} />
<Stack.Screen name="Settings" component={SettingsScreen} />
```

### **What it does:**
1. **Route Management** - Defines all possible screens
2. **Theme Integration** - Navigation matches app theme
3. **Authentication Flow** - Handles login/logout navigation
4. **Screen Transitions** - Smooth animations between screens
5. **Deep Linking** - Supports navigation from external links

## 📱 **TabNavigator.js - Personal User Bottom Tabs**

### **Purpose:**
Creates the bottom tab navigation for personal users. This is the main interface personal users see after logging in.

### **Tab Structure:**
```javascript
const tabs = [
  {
    name: 'Home',
    component: DashboardScreen,
    icon: 'home',
    label: 'Dashboard'
  },
  {
    name: 'Transactions', 
    component: TransactionsScreen,
    icon: 'swap-vertical',
    label: 'Transactions'
  },
  {
    name: 'AddTransaction',
    component: AddTransactionScreen,
    icon: 'plus-circle',
    label: 'Add',
    special: true  // Special styling for add button
  },
  {
    name: 'Budget',
    component: BudgetScreen,
    icon: 'wallet',
    label: 'Budget'
  },
  {
    name: 'Stats',
    component: StatsScreen,
    icon: 'chart-pie',
    label: 'Stats'
  }
];
```

### **Custom Tab Bar Features:**
```javascript
// Animated tab icons
const AnimatedTabIcon = ({ focused, iconName }) => {
  // Scale animation when tab is selected
  // Color change animation
  // Bounce effect on press
};

// Special Add button
const AnimatedAddButton = ({ isFocused, onPress }) => {
  // Larger, floating button in center
  // Rotation animation (+ to X when focused)
  // Color change animation
  // Special press effects
};
```

### **What it does:**
1. **Bottom Navigation** - 5 tabs for main features
2. **Animated Icons** - Icons animate when selected
3. **Special Add Button** - Center button is larger and special
4. **Theme Integration** - Colors match current theme
5. **Badge Support** - Can show notification badges

## 🏢 **CompanyTabNavigator.js - Company User Bottom Tabs**

### **Purpose:**
Creates bottom tab navigation specifically for company users with business-focused features.

### **Company Tab Structure:**
```javascript
const companyTabs = [
  {
    name: 'CompanyHome',
    component: CompanyDashboardScreen,
    icon: 'view-dashboard',
    label: 'Dashboard'
  },
  {
    name: 'CompanyReports',
    component: CompanyReportsScreen,
    icon: 'chart-line',
    label: 'Reports'
  },
  {
    name: 'AddCompanyTransaction',
    component: AddCompanyTransactionScreen,
    icon: 'plus-circle',
    label: 'Add',
    special: true
  },
  {
    name: 'TeamManagement',
    component: TeamManagementScreen,
    icon: 'account-group',
    label: 'Team'
  },
  {
    name: 'CompanyBudget',
    component: CompanyBudgetScreen,
    icon: 'calculator',
    label: 'Budget'
  }
];
```

### **What it does:**
1. **Business Navigation** - Company-specific features
2. **Same Animations** - Consistent with personal tabs
3. **Different Icons** - Business-appropriate icons
4. **Team Features** - Access to team management
5. **Company Reports** - Business analytics and reports

## ✨ **AnimationConfig.js - Screen Transition Animations**

### **Purpose:**
Defines beautiful animations for screen transitions to make the app feel smooth and professional.

### **Animation Types:**
```javascript
// Fade animations
export const dissolveAnimations = {
  crossfade: {
    animation: 'fade',
    animationDuration: 500
  },
  fadeFromBottom: {
    animation: 'fade_from_bottom',
    animationDuration: 600
  },
  quickFade: {
    animation: 'fade',
    animationDuration: 300
  }
};

// Screen-specific animations
export const screenAnimations = {
  splash: dissolveAnimations.quickFade,
  login: { animation: 'fade', animationDuration: 400 },
  signup: { animation: 'fade', animationDuration: 400 },
  modal: { 
    presentation: 'modal',
    animation: 'fade_from_bottom'
  }
};
```

### **What it does:**
1. **Smooth Transitions** - Beautiful screen changes
2. **Consistent Timing** - All animations feel cohesive
3. **Performance Optimized** - Uses native animations
4. **Customizable** - Different animations for different screens

## 💰 **useTransactions.js - Transaction Management Hook**

### **Purpose:**
Custom hook that provides transaction-related functionality to any screen that needs it.

### **Key Features:**
```javascript
export const useTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load user's transactions
  const loadTransactions = async (filters = {}) => {
    setLoading(true);
    try {
      const result = await transactionService.getUserTransactions(userId, filters);
      setTransactions(result.transactions);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Add new transaction
  const addTransaction = async (transactionData) => {
    try {
      const result = await transactionService.addTransaction(userId, transactionData);
      setTransactions(prev => [result.transaction, ...prev]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Delete transaction
  const deleteTransaction = async (transactionId) => {
    try {
      await transactionService.deleteTransaction(transactionId);
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netBalance: income - expenses
    };
  };

  return {
    transactions,
    loading,
    error,
    loadTransactions,
    addTransaction,
    deleteTransaction,
    calculateTotals,
    refresh: loadTransactions
  };
};
```

### **Usage in Screens:**
```javascript
// In any screen that needs transactions
function TransactionsScreen() {
  const { 
    transactions, 
    loading, 
    addTransaction, 
    deleteTransaction,
    calculateTotals 
  } = useTransactions();

  const totals = calculateTotals();

  return (
    <View>
      <Text>Total Income: ${totals.totalIncome}</Text>
      <Text>Total Expenses: ${totals.totalExpenses}</Text>
      {transactions.map(transaction => (
        <TransactionItem 
          key={transaction.id}
          transaction={transaction}
          onDelete={() => deleteTransaction(transaction.id)}
        />
      ))}
    </View>
  );
}
```

### **What it provides:**
1. **Transaction State** - List of user's transactions
2. **CRUD Operations** - Add, edit, delete transactions
3. **Loading States** - Shows when operations are in progress
4. **Error Handling** - Manages and reports errors
5. **Calculations** - Automatic totals and balances
6. **Real-time Updates** - State updates immediately

## 💳 **useBudgets.js - Budget Management Hook**

### **Purpose:**
Custom hook for budget-related functionality across multiple screens.

### **Key Features:**
```javascript
export const useBudgets = () => {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create new budget
  const createBudget = async (budgetData) => {
    try {
      const result = await budgetService.createBudget(userId, budgetData);
      setBudgets(prev => [...prev, result.budget]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Get budget progress
  const getBudgetProgress = async (budgetId) => {
    try {
      const result = await budgetService.getBudgetProgress(userId, budgetId);
      return result.progress;
    } catch (error) {
      return null;
    }
  };

  // Check if over budget
  const checkBudgetAlerts = () => {
    return budgets.filter(budget => {
      const progress = getBudgetProgress(budget.id);
      return progress && progress.isOverBudget;
    });
  };

  return {
    budgets,
    loading,
    createBudget,
    getBudgetProgress,
    checkBudgetAlerts
  };
};
```

### **What it provides:**
1. **Budget State** - User's budget information
2. **Budget Creation** - Easy budget setup
3. **Progress Tracking** - Spent vs budget amounts
4. **Alert System** - Overspending notifications
5. **Multi-Screen Access** - Use budgets anywhere

## 💬 **useThemedMessageBox.js - Message Box Hook**

### **Purpose:**
Provides themed message box functionality that matches the app's design.

### **Key Features:**
```javascript
export const useThemedMessageBox = () => {
  const [messageBoxConfig, setMessageBoxConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: []
  });

  const showSuccess = (title, message) => {
    setMessageBoxConfig({
      visible: true,
      type: 'success',
      title,
      message,
      autoHide: true
    });
  };

  const showError = (title, message) => {
    setMessageBoxConfig({
      visible: true,
      type: 'error',
      title,
      message
    });
  };

  const showConfirm = (title, message, onConfirm, onCancel) => {
    setMessageBoxConfig({
      visible: true,
      type: 'confirm',
      title,
      message,
      buttons: [
        { text: 'Cancel', onPress: onCancel },
        { text: 'OK', onPress: onConfirm }
      ]
    });
  };

  return {
    messageBoxConfig,
    showSuccess,
    showError,
    showConfirm,
    hideMessage: () => setMessageBoxConfig(prev => ({ ...prev, visible: false }))
  };
};
```

### **What it provides:**
1. **Themed Messages** - Beautiful, consistent dialogs
2. **Multiple Types** - Success, error, warning, confirm
3. **Easy API** - Simple functions to show messages
4. **Auto-Hide** - Success messages disappear automatically
5. **Custom Buttons** - Flexible button configuration

These navigation and hooks systems work together to create a smooth, consistent user experience throughout the app.