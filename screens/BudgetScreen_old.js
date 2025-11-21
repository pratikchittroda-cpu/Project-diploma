import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import budgetService from '../services/budgetService';

const { width } = Dimensions.get('window');

export default function BudgetScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  
  // Don't render until theme is loaded - check this BEFORE other hooks
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', paddingTop: StatusBar.currentHeight || 0 }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  const { user, userData, updateUserProfile } = useAuth();
  const { transactions, refresh: refreshTransactions } = useTransactions();
  const [selectedPeriod, setSelectedPeriod] = useState('Monthly');
  const [selectedView, setSelectedView] = useState('overview');
  const [showAddBudgetModal, setShowAddBudgetModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('food');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Track this screen visit
    trackScreenVisit();

    // Load budgets from database
    loadBudgetsFromDatabase();

    // Listen for navigation focus to auto-refresh and track tab bar navigation
    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
      // Auto-refresh budget data when screen becomes active
      autoRefresh();
      // Reload budgets when screen becomes active
      loadBudgetsFromDatabase();
    });

    return unsubscribe;
  }, [navigation]);

  // Auto refresh functionality when screen becomes active
  const autoRefresh = async () => {
    try {
      // Refresh transactions silently (this will trigger budget recalculation)
      await refreshTransactions();
      // Reload budgets from database
      await loadBudgetsFromDatabase();
    } catch (error) {
      }
  };

  const trackScreenVisit = async () => {
    try {
      const stored = await AsyncStorage.getItem('personal_recent_actions');
      let recentActions = stored ? JSON.parse(stored) : [];
      
      const newAction = {
        id: 'budget',
        name: 'Budget',
        icon: 'wallet',
        color: '#2196F3',
        timestamp: Date.now()
      };
      
      recentActions = recentActions.filter(action => action.id !== 'budget');
      recentActions.unshift(newAction);
      recentActions = recentActions.slice(0, 4);
      
      await AsyncStorage.setItem('personal_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      }
  };

  // Budget data state - starts empty until user creates budgets
  const [budgets, setBudgets] = useState([]);

  // Load budgets from database
  const loadBudgetsFromDatabase = async () => {
    try {
      if (user?.uid) {
        const result = await budgetService.getUserBudgets(user.uid);
        if (result.success) {
          setBudgets(result.budgets);
        } else {
          }
      }
    } catch (error) {
      }
  };

  // Calculate budget data from real transactions
  const calculateBudgetData = () => {
    // Get current period transactions
    const now = new Date();
    let startDate, endDate;

    switch (selectedPeriod) {
      case 'Weekly':
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        startDate = startOfWeek.toISOString().split('T')[0];
        endDate = endOfWeek.toISOString().split('T')[0];
        break;
      case 'Yearly':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
        break;
      default: // Monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }

    // Filter transactions for the period
    const periodTransactions = transactions.filter(t => {
      const transactionDate = t.date || t.createdAt?.split('T')[0];
      return transactionDate >= startDate && transactionDate <= endDate && t.type === 'expense';
    });

    // Calculate spending by category
    const categorySpending = {};
    periodTransactions.forEach(transaction => {
      const category = transaction.category || 'other';
      categorySpending[category] = (categorySpending[category] || 0) + transaction.amount;
    });

    // Create budget categories with real data
    const categoryData = [
      { id: 'food', name: 'Food & Dining', color: '#FF9800', icon: 'food' },
      { id: 'transport', name: 'Transportation', color: '#2196F3', icon: 'car' },
      { id: 'shopping', name: 'Shopping', color: '#9C27B0', icon: 'shopping' },
      { id: 'entertainment', name: 'Entertainment', color: '#FF5722', icon: 'movie' },
      { id: 'bills', name: 'Bills & Utilities', color: '#607D8B', icon: 'receipt' },
      { id: 'health', name: 'Healthcare', color: '#4CAF50', icon: 'medical-bag' },
    ];

    const categories = categoryData.map((cat, index) => {
      const spent = categorySpending[cat.id] || 0;
      const budget = budgets.find(b => b.category === cat.id && b.period === selectedPeriod)?.amount || 0;
      const remaining = Math.max(0, budget - spent);
      const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      const transactionCount = periodTransactions.filter(t => t.category === cat.id).length;

      return {
        id: index + 1,
        ...cat,
        budget,
        spent,
        remaining,
        percentage,
        transactions: transactionCount
      };
    }).filter(cat => cat.budget > 0 || cat.spent > 0);

    const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
    const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
    const totalRemaining = Math.max(0, totalBudget - totalSpent);

    // Generate alerts
    const alerts = categories
      .filter(cat => cat.percentage >= 80)
      .map((cat, index) => ({
        id: index + 1,
        category: cat.name,
        message: cat.percentage >= 100 
          ? 'Budget exceeded!' 
          : `You've used ${cat.percentage}% of your budget`,
        severity: cat.percentage >= 100 ? 'danger' : 'warning'
      }));

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      categories,
      alerts
    };
  };

  const [budgetData, setBudgetData] = useState({
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    categories: [],
    alerts: []
  });

  // Recalculate budget data when transactions or budgets change
  useEffect(() => {
    const newBudgetData = calculateBudgetData();
    setBudgetData(newBudgetData);
  }, [transactions, budgets, selectedPeriod]);

  // Load existing budgets from user profile
  useEffect(() => {
    if (userData) {
      const existingBudgets = [];
      
      // Add weekly budget if exists
      if (userData.weeklyBudget) {
        existingBudgets.push({
          id: 'weekly_total',
          category: 'total',
          amount: userData.weeklyBudget,
          period: 'Weekly'
        });
      }
      
      // Add monthly budget if exists
      if (userData.monthlyBudget) {
        existingBudgets.push({
          id: 'monthly_total',
          category: 'total',
          amount: userData.monthlyBudget,
          period: 'Monthly'
        });
      }
      
      // Add yearly budget if exists
      if (userData.yearlyBudget) {
        existingBudgets.push({
          id: 'yearly_total',
          category: 'total',
          amount: userData.yearlyBudget,
          period: 'Yearly'
        });
      }
      
      if (existingBudgets.length > 0) {
        setBudgets(existingBudgets);
      }
    }
  }, [userData]);

  const periods = ['Weekly', 'Monthly', 'Yearly'];
  const views = [
    { id: 'overview', name: 'Overview', icon: 'chart-pie' },
    { id: 'categories', name: 'Categories', icon: 'format-list-bulleted' },
    { id: 'alerts', name: 'Alerts', icon: 'alert-circle' },
  ];

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2).replace(/\\d(?=(\\d{3})+\\.)/g, '$&,')}`;
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case 'danger': return '#F44336';
      case 'warning': return '#FF9800';
      case 'info': return '#2196F3';
      default: return theme.textSecondary;
    }
  };

  const handleCreateBudget = () => {
    setShowAddBudgetModal(true);
  };

  // Function to set total budget for a period (using modal for better compatibility)
  const handleSetTotalBudget = () => {
    setShowAddBudgetModal(true);
  };

  const handleSaveTotalBudget = async () => {
    if (!budgetAmount || parseFloat(budgetAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid budget amount');
      return;
    }

    try {
      const amount = parseFloat(budgetAmount);
      const profileUpdate = {};
      
      if (selectedPeriod === 'Weekly') {
        profileUpdate.weeklyBudget = amount;
      } else if (selectedPeriod === 'Monthly') {
        profileUpdate.monthlyBudget = amount;
      } else if (selectedPeriod === 'Yearly') {
        profileUpdate.yearlyBudget = amount;
      }

      const result = await updateUserProfile(profileUpdate);
      
      if (result.success) {
        Alert.alert('Success!', `${selectedPeriod} budget has been set to ${formatCurrency(amount)}`);
        
        // Update local budgets state
        const newBudget = {
          id: `${selectedPeriod.toLowerCase()}_total`,
          category: 'total',
          amount: amount,
          period: selectedPeriod
        };
        
        const updatedBudgets = budgets.filter(b => !(b.category === 'total' && b.period === selectedPeriod));
        setBudgets([...updatedBudgets, newBudget]);
        
        // Close modal and reset form
        setShowAddBudgetModal(false);
        setBudgetAmount('');
      } else {
        Alert.alert('Error', result.error || 'Failed to set budget');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to set budget. Please try again.');
    }
  };

  const handleAddBudget = async () => {
    if (!budgetAmount || parseFloat(budgetAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid budget amount');
      return;
    }

    try {
      const budgetData = {
        category: budgetCategory,
        amount: parseFloat(budgetAmount),
        period: selectedPeriod,
        name: getCategoryName(budgetCategory)
      };

      // Save to database
      const result = await budgetService.createBudget(user.uid, budgetData);
      
      if (result.success) {
        // Update local state
        const newBudget = {
          id: result.budgetId,
          ...budgetData
        };

        // Remove existing budget for same category and period
        const updatedBudgets = budgets.filter(b => !(b.category === budgetCategory && b.period === selectedPeriod));
        setBudgets([...updatedBudgets, newBudget]);

        // Reset form
        setBudgetAmount('');
        setBudgetCategory('food');
        setShowAddBudgetModal(false);

        // Update user profile with total budget for this period
        updateUserBudgetProfile(newBudget, [...updatedBudgets, newBudget]);

        Alert.alert('Success!', `${selectedPeriod} budget for ${getCategoryName(budgetCategory)} has been saved to database and set to ${formatCurrency(parseFloat(budgetAmount))}`);
      } else {
        Alert.alert('Error', `Failed to save budget: ${result.error}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save budget. Please try again.');
    }
  };

  // Function to update user profile with budget totals
  const updateUserBudgetProfile = async (newBudget, allBudgets) => {
    try {
      const periodBudgets = allBudgets.filter(b => b.period === selectedPeriod);
      const totalBudget = periodBudgets.reduce((sum, b) => sum + b.amount, 0);

      // Update user profile with the total budget for this period
      const profileUpdate = {};
      if (selectedPeriod === 'Weekly') {
        profileUpdate.weeklyBudget = totalBudget;
      } else if (selectedPeriod === 'Monthly') {
        profileUpdate.monthlyBudget = totalBudget;
      } else if (selectedPeriod === 'Yearly') {
        profileUpdate.yearlyBudget = totalBudget;
      }

      const result = await updateUserProfile(profileUpdate);
      if (!result.success) {
        }
    } catch (error) {
      }
  };

  const getCategoryName = (categoryId) => {
    const categoryMap = {
      food: 'Food & Dining',
      transport: 'Transportation',
      shopping: 'Shopping',
      entertainment: 'Entertainment',
      bills: 'Bills & Utilities',
      health: 'Healthcare'
    };
    return categoryMap[categoryId] || categoryId;
  };

  const getCategoryIcon = (categoryId) => {
    const iconMap = {
      food: 'food',
      transport: 'car',
      shopping: 'shopping',
      entertainment: 'movie',
      bills: 'receipt',
      health: 'medical-bag'
    };
    return iconMap[categoryId] || 'folder';
  };

  const getCategoryColor = (categoryId) => {
    const colorMap = {
      food: '#FF9800',
      transport: '#2196F3',
      shopping: '#9C27B0',
      entertainment: '#FF5722',
      bills: '#607D8B',
      health: '#4CAF50'
    };
    return colorMap[categoryId] || '#666';
  };

  const availableCategories = [
    { id: 'food', name: 'Food & Dining', icon: 'food', color: '#FF9800' },
    { id: 'transport', name: 'Transportation', icon: 'car', color: '#2196F3' },
    { id: 'shopping', name: 'Shopping', icon: 'shopping', color: '#9C27B0' },
    { id: 'entertainment', name: 'Entertainment', icon: 'movie', color: '#FF5722' },
    { id: 'bills', name: 'Bills & Utilities', icon: 'receipt', color: '#607D8B' },
    { id: 'health', name: 'Healthcare', icon: 'medical-bag', color: '#4CAF50' }
  ];

  const handleEditBudget = (category) => {
    Alert.alert('Edit Budget', `Edit budget for ${category.name}`);
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-left" size={24} color={theme.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Budget</Text>
      <TouchableOpacity style={styles.createButton} onPress={handleSetTotalBudget}>
        <Icon name="wallet" size={20} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderPeriodSelector = () => {
    // Calculate data for each period
    const getPeriodData = (period) => {
      const now = new Date();
      let startDate, endDate;

      switch (period) {
        case 'Weekly':
          const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
          const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
          startDate = startOfWeek.toISOString().split('T')[0];
          endDate = endOfWeek.toISOString().split('T')[0];
          break;
        case 'Yearly':
          startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
          endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
          break;
        default: // Monthly
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      }

      // Filter transactions for this period
      const periodTransactions = transactions.filter(t => {
        const transactionDate = t.date || t.createdAt?.split('T')[0];
        return transactionDate >= startDate && transactionDate <= endDate && t.type === 'expense';
      });

      // Calculate spending for this period
      const totalSpent = periodTransactions.reduce((sum, t) => sum + t.amount, 0);
      
      // Get budgets for this period
      const periodBudgets = budgets.filter(b => b.period === period);
      const totalBudget = periodBudgets.reduce((sum, b) => sum + b.amount, 0);

      return {
        spent: totalSpent,
        budget: totalBudget,
        transactions: periodTransactions.length
      };
    };

    return (
      <Animated.View style={[styles.periodSelector, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.periodBoxContainer}>
          {periods.map((period) => {
            const data = getPeriodData(period);
            const isSelected = selectedPeriod === period;
            
            return (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodBox,
                  isSelected && styles.periodBoxActive
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text style={[
                  styles.periodBoxTitle,
                  isSelected && styles.periodBoxTitleActive
                ]}>
                  {period}
                </Text>
                <Text style={[
                  styles.periodBoxAmount,
                  isSelected && styles.periodBoxAmountActive
                ]}>
                  ₹{data.spent.toFixed(0)}
                </Text>
                <Text style={[
                  styles.periodBoxSubtext,
                  isSelected && styles.periodBoxSubtextActive
                ]}>
                  {data.transactions} transactions
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    );
  };

  const renderViewSelector = () => (
    <Animated.View style={[styles.viewSelector, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.viewButtonContainer}>
        {views.map((view) => (
          <TouchableOpacity
            key={view.id}
            style={[
              styles.viewButton,
              selectedView === view.id && styles.viewButtonActive
            ]}
            onPress={() => setSelectedView(view.id)}
          >
            <Icon 
              name={view.icon} 
              size={18} 
              color={selectedView === view.id ? 'white' : theme.primary} 
            />
            <Text style={[
              styles.viewButtonText,
              selectedView === view.id && styles.viewButtonTextActive
            ]}>
              {view.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderBudgetOverview = () => (
    <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Total Budget Card */}
      <View style={styles.totalBudgetCard}>
        <LinearGradient colors={[theme.primary, theme.primaryLight]} style={styles.totalBudgetGradient}>
          <View style={styles.totalBudgetHeader}>
            <Text style={styles.totalBudgetTitle}>{selectedPeriod} Budget</Text>
            <Icon name="wallet" size={24} color="white" />
          </View>
          <Text style={styles.totalBudgetAmount}>{formatCurrency(budgetData.totalBudget)}</Text>
          
          {budgetData.totalBudget === 0 ? (
            <View style={styles.noBudgetMessage}>
              <Text style={styles.noBudgetText}>No budget set for this period</Text>
              <Text style={styles.noBudgetSubtext}>Tap the + button to create your first budget</Text>
            </View>
          ) : (
            <View style={styles.budgetBreakdown}>
              <View style={styles.budgetBreakdownItem}>
                <Text style={styles.budgetBreakdownLabel}>Spent</Text>
                <Text style={styles.budgetBreakdownValue}>{formatCurrency(budgetData.totalSpent)}</Text>
              </View>
              <View style={styles.budgetBreakdownDivider} />
              <View style={styles.budgetBreakdownItem}>
                <Text style={styles.budgetBreakdownLabel}>Remaining</Text>
                <Text style={styles.budgetBreakdownValue}>{formatCurrency(budgetData.totalRemaining)}</Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </View>

      {/* Budget Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { backgroundColor: '#E8F5E8' }]}>
          <Icon name="wallet-outline" size={24} color="#4CAF50" />
          <Text style={styles.summaryValue}>
            ₹{budgetData.totalSpent.toFixed(0)}
          </Text>
          <Text style={styles.summaryLabel}>Budget Used</Text>
          <Text style={styles.summaryPercentage}>
            {budgetData.totalBudget > 0 ? ((budgetData.totalSpent / budgetData.totalBudget) * 100).toFixed(1) : '0.0'}%
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#E3F2FD' }]}>
          <Icon name="cash" size={24} color="#2196F3" />
          <Text style={styles.summaryValue}>₹{budgetData.totalRemaining.toFixed(0)}</Text>
          <Text style={styles.summaryLabel}>Remaining</Text>
          <Text style={styles.summaryPercentage}>
            {budgetData.totalBudget > 0 ? (((budgetData.totalBudget - budgetData.totalSpent) / budgetData.totalBudget) * 100).toFixed(1) : '100.0'}%
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#FFF3E0' }]}>
          <Icon name="alert-circle" size={24} color="#FF9800" />
          <Text style={styles.summaryValue}>{budgetData.alerts.length}</Text>
          <Text style={styles.summaryLabel}>Alerts</Text>
          <Text style={styles.summaryPercentage}>
            {budgetData.categories.length > 0 ? 'Active' : 'None'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderCategoryBudgets = () => (
    <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>Budget Categories</Text>
      
      {budgetData.categories.length === 0 ? (
        <View style={styles.emptyBudgetContainer}>
          <Icon name="wallet-plus" size={64} color={theme.textSecondary} />
          <Text style={styles.emptyBudgetTitle}>No Budgets Set</Text>
          <Text style={styles.emptyBudgetMessage}>
            Create your first {selectedPeriod.toLowerCase()} budget to start tracking your spending
          </Text>
          <TouchableOpacity 
            style={styles.createFirstBudgetButton}
            onPress={handleSetTotalBudget}
          >
            <Icon name="wallet" size={20} color="white" />
            <Text style={styles.createFirstBudgetText}>Set Total Budget</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.createFirstBudgetButton, { backgroundColor: theme.textSecondary, marginTop: 10 }]}
            onPress={handleCreateBudget}
          >
            <Icon name="plus" size={20} color="white" />
            <Text style={styles.createFirstBudgetText}>Create Category Budget</Text>
          </TouchableOpacity>
        </View>
      ) : (
        budgetData.categories.map((category) => (
        <View key={category.id} style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <View style={styles.categoryInfo}>
              <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                <Icon name={category.icon} size={20} color={category.color} />
              </View>
              <View style={styles.categoryDetails}>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryBudgetText}>
                  {formatCurrency(category.spent)} of {formatCurrency(category.budget)}
                </Text>
              </View>
            </View>
            <View style={styles.categoryActions}>
              <Text style={[styles.categoryPercentage, { color: category.color }]}>
                {category.percentage}%
              </Text>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => handleEditBudget(category)}
              >
                <Icon name="pencil" size={16} color={theme.textLight} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${category.percentage}%`,
                    backgroundColor: category.color
                  }
                ]} 
              />
            </View>
          </View>

          <View style={styles.categoryFooter}>
            <Text style={styles.remainingAmount}>
              {formatCurrency(category.remaining)} remaining
            </Text>
            <Text style={styles.transactionCount}>
              {category.transactions} transactions
            </Text>
          </View>
        </View>
        ))
      )}
    </Animated.View>
  );

  const renderBudgetAlerts = () => (
    <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>Budget Alerts ({budgetData.alerts.length})</Text>
      {budgetData.alerts.map((alert) => (
        <View key={alert.id} style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <View style={[styles.alertIcon, { backgroundColor: `${getAlertColor(alert.severity)}20` }]}>
              <Icon 
                name={alert.severity === 'warning' ? 'alert' : 'alert-circle'} 
                size={20} 
                color={getAlertColor(alert.severity)} 
              />
            </View>
            <View style={styles.alertContent}>
              <View style={styles.alertTitleRow}>
                <Text style={styles.alertCategory}>{alert.category}</Text>
                <View style={[styles.severityBadge, { backgroundColor: getAlertColor(alert.severity) }]}>
                  <Text style={styles.severityText}>{alert.severity}</Text>
                </View>
              </View>
              <Text style={styles.alertMessage}>{alert.message}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.alertAction}>
            <Text style={styles.alertActionText}>Adjust Budget</Text>
            <Icon name="arrow-right" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>
      ))}

      {budgetData.alerts.length === 0 && (
        <View style={styles.noAlertsContainer}>
          <Icon name="check-circle" size={64} color="#4CAF50" />
          <Text style={styles.noAlertsTitle}>All Good!</Text>
          <Text style={styles.noAlertsMessage}>Your budget is on track</Text>
        </View>
      )}
    </Animated.View>
  );

  const renderContent = () => {
    switch (selectedView) {
      case 'overview':
        return renderBudgetOverview();
      case 'categories':
        return renderCategoryBudgets();
      case 'alerts':
        return renderBudgetAlerts();
      default:
        return renderBudgetOverview();
    }
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderPeriodSelector()}
      {renderViewSelector()}
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderContent()}
      </ScrollView>

      {/* Add Budget Modal */}
      <Modal
        visible={showAddBudgetModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowAddBudgetModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddBudgetModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set {selectedPeriod} Budget</Text>
              <TouchableOpacity 
                onPress={() => setShowAddBudgetModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Total Budget Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={budgetAmount}
                  onChangeText={setBudgetAmount}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  autoFocus={true}
                />
              </View>

              <Text style={styles.inputLabel}>Period</Text>
              <View style={styles.periodInfo}>
                <Icon name="calendar" size={20} color={theme.primary} />
                <Text style={styles.periodInfoText}>{selectedPeriod}</Text>
              </View>
              
              <Text style={styles.modalHelpText}>
                Set your total {selectedPeriod.toLowerCase()} budget to track your spending.
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddBudgetModal(false);
                  setBudgetAmount('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.addButton}
                onPress={handleSaveTotalBudget}
              >
                <Text style={styles.addButtonText}>Set Budget</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.categoryModalContent}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Select Category</Text>
              <TouchableOpacity 
                onPress={() => setShowCategoryModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.categoryList}>
              {availableCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryOption,
                    budgetCategory === category.id && styles.categoryOptionSelected
                  ]}
                  onPress={() => {
                    setBudgetCategory(category.id);
                    setShowCategoryModal(false);
                  }}
                >
                  <View style={[styles.categoryOptionIcon, { backgroundColor: `${category.color}20` }]}>
                    <Icon name={category.icon} size={24} color={category.color} />
                  </View>
                  <Text style={styles.categoryOptionText}>{category.name}</Text>
                  {budgetCategory === category.id && (
                    <Icon name="check" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 20,
    backgroundColor: theme.headerBackground || theme.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  // Period Selector Styles
  periodSelector: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  periodBoxContainer: {
    flexDirection: 'row',
  },
  periodBox: {
    flex: 1,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  periodBoxActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
    elevation: 4,
    shadowOpacity: 0.2,
  },
  periodBoxTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 6,
  },
  periodBoxTitleActive: {
    color: 'white',
  },
  periodBoxAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 3,
  },
  periodBoxAmountActive: {
    color: 'white',
  },
  periodBoxSubtext: {
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  periodBoxSubtextActive: {
    color: 'rgba(255,255,255,0.8)',
  },

  // View Selector Styles
  viewSelector: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  viewButtonContainer: {
    flexDirection: 'row',
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  viewButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginLeft: 8,
  },
  viewButtonTextActive: {
    color: 'white',
  },

  // Content Styles
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  content: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },

  // Total Budget Card Styles
  totalBudgetCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  totalBudgetGradient: {
    padding: 25,
  },
  totalBudgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  totalBudgetTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  totalBudgetAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  budgetBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetBreakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  budgetBreakdownLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 5,
  },
  budgetBreakdownValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  budgetBreakdownDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Summary Grid Styles
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 8,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  summaryPercentage: {
    fontSize: 10,
    color: theme.textLight,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Category Card Styles
  categoryCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryDetails: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 2,
  },
  categoryBudgetText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  categoryActions: {
    alignItems: 'flex-end',
  },
  categoryPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  editButton: {
    padding: 5,
  },
  progressBarContainer: {
    marginBottom: 15,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remainingAmount: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  transactionCount: {
    fontSize: 14,
    color: theme.textSecondary,
  },

  // Alert Card Styles
  alertCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  severityText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  alertMessage: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  alertAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  alertActionText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },

  // No Alerts Styles
  noAlertsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noAlertsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 15,
    marginBottom: 8,
  },
  noAlertsMessage: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20 + (StatusBar.currentHeight || 0),
  },
  modalContent: {
    backgroundColor: theme.cardBackground,
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    elevation: 15,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  modalCloseButton: {
    padding: 5,
  },
  modalBody: {
    padding: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
    marginTop: 15,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: theme.border,
    elevation: 1,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categorySelectorText: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
    marginLeft: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 18,
    elevation: 1,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
    paddingVertical: 15,
  },
  periodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: theme.border,
  },
  periodInfoText: {
    fontSize: 16,
    color: theme.text,
    marginLeft: 12,
  },
  modalHelpText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  addButton: {
    flex: 1,
    backgroundColor: theme.primary,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },

  // Category Selection Modal Styles
  categoryModalContent: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  categoryList: {
    maxHeight: 400,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  categoryOptionSelected: {
    backgroundColor: `${theme.primary}10`,
  },
  categoryOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryOptionText: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
  },

  // Empty Budget State Styles
  emptyBudgetContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyBudgetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyBudgetMessage: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  createFirstBudgetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  createFirstBudgetText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },

  // No Budget Message Styles
  noBudgetMessage: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  noBudgetText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  noBudgetSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
});