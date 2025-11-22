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
  SafeAreaView,
  RefreshControl,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import budgetService from '../services/budgetService';
import CircularProgress from '../components/budget/CircularProgress';
import AddBudgetModal from '../components/budget/AddBudgetModal';
import BudgetInsights from '../components/budget/BudgetInsights';

export default function BudgetScreen({ navigation }) {
  const { theme, isLoading } = useTheme();

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.loadingBackground || '#f8f9fa', paddingTop: StatusBar.currentHeight || 0 }}>
        <ActivityIndicator size="large" color={theme?.loadingIndicator || '#667eea'} />
      </View>
    );
  }

  const { user, userData } = useAuth();
  const { transactions, refresh: refreshTransactions } = useTransactions();
  const [selectedPeriod, setSelectedPeriod] = useState('Monthly');
  const [budgets, setBudgets] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [budgetStats, setBudgetStats] = useState({
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    percentage: 0,
    categories: [],
    alerts: [],
    daysRemaining: 0,
  });

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

    trackScreenVisit();
    loadBudgetsFromDatabase();

    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
      autoRefresh();
    });

    return unsubscribe;
  }, [navigation]);

  // Recalculate budget stats when transactions or budgets change
  useEffect(() => {
    const stats = calculateBudgetStats();
    setBudgetStats(stats);
  }, [transactions, budgets, selectedPeriod]);

  const trackScreenVisit = async () => {
    try {
      const stored = await AsyncStorage.getItem('personal_recent_actions');
      let recentActions = stored ? JSON.parse(stored) : [];

      const newAction = {
        id: 'budget',
        name: 'Budget',
        icon: 'wallet',
        color: theme.primary,
        timestamp: Date.now()
      };

      recentActions = recentActions.filter(action => action.id !== 'budget');
      recentActions.unshift(newAction);
      recentActions = recentActions.slice(0, 4);

      await AsyncStorage.setItem('personal_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      // Error tracking screen visit
    }
  };

  const loadBudgetsFromDatabase = async () => {
    try {
      if (user?.uid) {
        const result = await budgetService.getUserBudgets(user.uid);
        if (result.success) {
          setBudgets(result.budgets);
        }
      }
    } catch (error) {
      // Error loading budgets
    }
  };

  const autoRefresh = async () => {
    try {
      await refreshTransactions();
      await loadBudgetsFromDatabase();
    } catch (error) {
      // Error refreshing
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await autoRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  const getPeriodDates = () => {
    const now = new Date();
    let startDate, endDate;

    switch (selectedPeriod) {
      case 'Weekly':
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        endDate = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        break;
      case 'Yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default: // Monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return { startDate, endDate };
  };

  const calculateBudgetStats = () => {
    const { startDate, endDate } = getPeriodDates();

    // Filter transactions for period
    const periodTransactions = transactions.filter(t => {
      const transactionDate = t.date || t.createdAt?.split('T')[0];
      return transactionDate >= startDate.toISOString().split('T')[0] &&
        transactionDate <= endDate.toISOString().split('T')[0] &&
        t.type === 'expense';
    });

    // Calculate spending by category
    const categorySpending = {};
    periodTransactions.forEach(transaction => {
      const category = transaction.category || 'other';
      categorySpending[category] = (categorySpending[category] || 0) + transaction.amount;
    });

    const categoryData = [
      { id: 'food', name: 'Food & Dining', color: '#FF9800', icon: 'food' },
      { id: 'transport', name: 'Transportation', color: '#2196F3', icon: 'car' },
      { id: 'shopping', name: 'Shopping', color: '#9C27B0', icon: 'shopping' },
      { id: 'entertainment', name: 'Entertainment', color: '#FF5722', icon: 'movie' },
      { id: 'bills', name: 'Bills & Utilities', color: '#607D8B', icon: 'receipt' },
      { id: 'health', name: 'Healthcare', color: '#4CAF50', icon: 'medical-bag' },
    ];

    // Map categories with their budget and spending data
    const categoriesWithData = categoryData.map(cat => {
      const spent = categorySpending[cat.id] || 0;
      const budget = budgets.find(b => b.category === cat.id && b.period === selectedPeriod)?.amount || 0;
      const remaining = Math.max(0, budget - spent);
      const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      const transactionCount = periodTransactions.filter(t => t.category === cat.id).length;

      return {
        ...cat,
        budget,
        spent,
        remaining,
        percentage,
        transactions: transactionCount,
        status: percentage < 75 ? 'good' : percentage < 90 ? 'warning' : 'danger',
      };
    });

    // Only include categories that have a budget set
    const categories = categoriesWithData.filter(cat => cat.budget > 0);

    // Calculate unbudgeted spending (spending from categories without budgets)
    const budgetedCategoryIds = categories.map(cat => cat.id);
    const unbudgetedSpending = Object.keys(categorySpending).reduce((sum, categoryId) => {
      if (!budgetedCategoryIds.includes(categoryId)) {
        return sum + categorySpending[categoryId];
      }
      return sum;
    }, 0);

    // Add "Out of Budget" category if there is unbudgeted spending
    if (unbudgetedSpending > 0) {
      const unbudgetedTransactionCount = periodTransactions.filter(
        t => !budgetedCategoryIds.includes(t.category || 'other')
      ).length;

      categories.push({
        id: 'out-of-budget',
        name: 'Out of Budget',
        color: '#9E9E9E',
        icon: 'alert-circle-outline',
        budget: 0,
        spent: unbudgetedSpending,
        remaining: 0,
        percentage: 0,
        transactions: unbudgetedTransactionCount,
        status: 'warning',
      });
    }

    const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
    const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const percentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    // Generate alerts (exclude "Out of Budget" from alerts)
    const alerts = categories
      .filter(cat => cat.id !== 'out-of-budget' && cat.percentage >= 75)
      .map(cat => ({
        id: cat.id,
        category: cat.name,
        message: cat.percentage >= 100
          ? `Budget exceeded by ₹${(cat.spent - cat.budget).toFixed(2)}`
          : `${cat.percentage}% of budget used`,
        severity: cat.percentage >= 90 ? 'danger' : 'warning',
      }));

    // Calculate days remaining
    const today = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      percentage,
      categories,
      alerts,
      daysRemaining,
    };
  };

  const getBudgetStatusColor = (percentage) => {
    if (percentage < 75) return theme.success || '#4CAF50';
    if (percentage < 90) return theme.warning || '#FF9800';
    return theme.error || '#F44336';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddBudget = () => {
    setEditingBudget(null);
    setShowAddModal(true);
  };

  const handleEditBudget = (budget) => {
    setEditingBudget(budget);
    setShowAddModal(true);
  };

  const handleSaveBudget = async (budgetData) => {
    try {
      if (editingBudget) {
        // Update existing budget
        const result = await budgetService.updateBudget(user.uid, editingBudget.id, budgetData);
        if (result.success) {
          // Update local state
          const updatedBudgets = budgets.map(b =>
            b.id === editingBudget.id ? { ...b, ...budgetData } : b
          );

          // Sync with other period
          const syncedBudgets = await syncBudgetWithOtherPeriod(updatedBudgets, budgetData);
          setBudgets(syncedBudgets);
          setShowAddModal(false);
        }
      } else {
        // Create new budget
        const result = await budgetService.createBudget(user.uid, budgetData);
        if (result.success) {
          const newBudget = { id: result.budgetId, ...budgetData };
          const updatedBudgets = [...budgets, newBudget];

          // Sync with other period
          const syncedBudgets = await syncBudgetWithOtherPeriod(updatedBudgets, budgetData);
          setBudgets(syncedBudgets);
          setShowAddModal(false);
        }
      }
    } catch (error) {
      console.error('Error saving budget:', error);
    }
  };

  const syncBudgetWithOtherPeriod = async (currentBudgets, budgetData) => {
    try {
      let updatedBudgets = [...currentBudgets];

      if (budgetData.period === 'Weekly') {
        // Weekly budget created/updated - sync to Monthly (weekly * 4) and Yearly (weekly * 52)
        const monthlyAmount = budgetData.amount * 4;
        const yearlyAmount = budgetData.amount * 52;

        // Sync Monthly
        const existingMonthly = updatedBudgets.find(
          b => b.category === budgetData.category && b.period === 'Monthly'
        );

        if (existingMonthly) {
          const result = await budgetService.updateBudget(user.uid, existingMonthly.id, {
            ...existingMonthly,
            amount: monthlyAmount,
          });
          if (result.success) {
            updatedBudgets = updatedBudgets.map(b =>
              b.id === existingMonthly.id ? { ...b, amount: monthlyAmount } : b
            );
          }
        } else {
          const result = await budgetService.createBudget(user.uid, {
            category: budgetData.category,
            categoryName: budgetData.categoryName,
            amount: monthlyAmount,
            period: 'Monthly',
          });
          if (result.success) {
            updatedBudgets.push({
              id: result.budgetId,
              category: budgetData.category,
              categoryName: budgetData.categoryName,
              amount: monthlyAmount,
              period: 'Monthly',
            });
          }
        }

        // Sync Yearly
        const existingYearly = updatedBudgets.find(
          b => b.category === budgetData.category && b.period === 'Yearly'
        );

        if (existingYearly) {
          const result = await budgetService.updateBudget(user.uid, existingYearly.id, {
            ...existingYearly,
            amount: yearlyAmount,
          });
          if (result.success) {
            updatedBudgets = updatedBudgets.map(b =>
              b.id === existingYearly.id ? { ...b, amount: yearlyAmount } : b
            );
          }
        } else {
          const result = await budgetService.createBudget(user.uid, {
            category: budgetData.category,
            categoryName: budgetData.categoryName,
            amount: yearlyAmount,
            period: 'Yearly',
          });
          if (result.success) {
            updatedBudgets.push({
              id: result.budgetId,
              category: budgetData.category,
              categoryName: budgetData.categoryName,
              amount: yearlyAmount,
              period: 'Yearly',
            });
          }
        }
      } else if (budgetData.period === 'Monthly') {
        // Monthly budget created/updated - sync to Weekly (monthly / 4) and Yearly (monthly * 12)
        const weeklyAmount = budgetData.amount / 4;
        const yearlyAmount = budgetData.amount * 12;

        // Sync Weekly
        const existingWeekly = updatedBudgets.find(
          b => b.category === budgetData.category && b.period === 'Weekly'
        );

        if (existingWeekly) {
          const result = await budgetService.updateBudget(user.uid, existingWeekly.id, {
            ...existingWeekly,
            amount: weeklyAmount,
          });
          if (result.success) {
            updatedBudgets = updatedBudgets.map(b =>
              b.id === existingWeekly.id ? { ...b, amount: weeklyAmount } : b
            );
          }
        } else {
          const result = await budgetService.createBudget(user.uid, {
            category: budgetData.category,
            categoryName: budgetData.categoryName,
            amount: weeklyAmount,
            period: 'Weekly',
          });
          if (result.success) {
            updatedBudgets.push({
              id: result.budgetId,
              category: budgetData.category,
              categoryName: budgetData.categoryName,
              amount: weeklyAmount,
              period: 'Weekly',
            });
          }
        }

        // Sync Yearly
        const existingYearly = updatedBudgets.find(
          b => b.category === budgetData.category && b.period === 'Yearly'
        );

        if (existingYearly) {
          const result = await budgetService.updateBudget(user.uid, existingYearly.id, {
            ...existingYearly,
            amount: yearlyAmount,
          });
          if (result.success) {
            updatedBudgets = updatedBudgets.map(b =>
              b.id === existingYearly.id ? { ...b, amount: yearlyAmount } : b
            );
          }
        } else {
          const result = await budgetService.createBudget(user.uid, {
            category: budgetData.category,
            categoryName: budgetData.categoryName,
            amount: yearlyAmount,
            period: 'Yearly',
          });
          if (result.success) {
            updatedBudgets.push({
              id: result.budgetId,
              category: budgetData.category,
              categoryName: budgetData.categoryName,
              amount: yearlyAmount,
              period: 'Yearly',
            });
          }
        }
      } else if (budgetData.period === 'Yearly') {
        // Yearly budget created/updated - sync to Monthly (yearly / 12) and Weekly (yearly / 52)
        const monthlyAmount = budgetData.amount / 12;
        const weeklyAmount = budgetData.amount / 52;

        // Sync Monthly
        const existingMonthly = updatedBudgets.find(
          b => b.category === budgetData.category && b.period === 'Monthly'
        );

        if (existingMonthly) {
          const result = await budgetService.updateBudget(user.uid, existingMonthly.id, {
            ...existingMonthly,
            amount: monthlyAmount,
          });
          if (result.success) {
            updatedBudgets = updatedBudgets.map(b =>
              b.id === existingMonthly.id ? { ...b, amount: monthlyAmount } : b
            );
          }
        } else {
          const result = await budgetService.createBudget(user.uid, {
            category: budgetData.category,
            categoryName: budgetData.categoryName,
            amount: monthlyAmount,
            period: 'Monthly',
          });
          if (result.success) {
            updatedBudgets.push({
              id: result.budgetId,
              category: budgetData.category,
              categoryName: budgetData.categoryName,
              amount: monthlyAmount,
              period: 'Monthly',
            });
          }
        }

        // Sync Weekly
        const existingWeekly = updatedBudgets.find(
          b => b.category === budgetData.category && b.period === 'Weekly'
        );

        if (existingWeekly) {
          const result = await budgetService.updateBudget(user.uid, existingWeekly.id, {
            ...existingWeekly,
            amount: weeklyAmount,
          });
          if (result.success) {
            updatedBudgets = updatedBudgets.map(b =>
              b.id === existingWeekly.id ? { ...b, amount: weeklyAmount } : b
            );
          }
        } else {
          const result = await budgetService.createBudget(user.uid, {
            category: budgetData.category,
            categoryName: budgetData.categoryName,
            amount: weeklyAmount,
            period: 'Weekly',
          });
          if (result.success) {
            updatedBudgets.push({
              id: result.budgetId,
              category: budgetData.category,
              categoryName: budgetData.categoryName,
              amount: weeklyAmount,
              period: 'Weekly',
            });
          }
        }
      }

      return updatedBudgets;
    } catch (error) {
      console.error('Error syncing budget:', error);
      return currentBudgets;
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    try {
      const result = await budgetService.deleteBudget(user.uid, budgetId);
      if (result.success) {
        setBudgets(budgets.filter(b => b.id !== budgetId));
      }
    } catch (error) {
      console.error('Error deleting budget:', error);
    }
  };

  const toggleCardExpansion = (categoryId) => {
    setExpandedCards(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-left" size={24} color="white" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Budget</Text>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleAddBudget}
      >
        <Icon name="plus" size={20} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderPeriodSelector = () => {
    const periods = ['Weekly', 'Monthly', 'Yearly'];

    return (
      <Animated.View style={[styles.periodSelector, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.periodButtonTextActive
            ]}>
              {period}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    );
  };

  const [showBudgetPopup, setShowBudgetPopup] = useState(false);
  const [showSpentPopup, setShowSpentPopup] = useState(false);

  const renderBudgetOverview = () => (
    <Animated.View style={[styles.overviewCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.overviewGradient}
      >
        <View style={styles.overviewHeader}>
          <View>
            <Text style={styles.overviewTitle}>{selectedPeriod} Budget</Text>
            <Text style={styles.overviewSubtitle}>
              {budgetStats.daysRemaining} days remaining
            </Text>
          </View>
          <Icon name="calendar-month" size={24} color="rgba(255,255,255,0.8)" />
        </View>

        <View style={styles.progressContainer}>
          <CircularProgress
            percentage={budgetStats.percentage}
            segments={budgetStats.segments}
            size={160}
            strokeWidth={14}
            color="white"
            backgroundColor="rgba(255,255,255,0.3)"
            showPercentage={true}
            textColor="white"
            fontSize={32}
          />
        </View>

        <View style={styles.overviewStats}>
          <TouchableOpacity style={styles.overviewStatItem} onPress={() => setShowBudgetPopup(true)}>
            <Text style={styles.overviewStatLabel}>Budget</Text>
            <Text style={styles.overviewStatValue}>{formatCurrency(budgetStats.totalBudget)}</Text>
          </TouchableOpacity>
          <View style={styles.overviewStatDivider} />
          <TouchableOpacity style={styles.overviewStatItem} onPress={() => setShowSpentPopup(true)}>
            <Text style={styles.overviewStatLabel}>Spent</Text>
            <Text style={styles.overviewStatValue}>{formatCurrency(budgetStats.totalSpent)}</Text>
          </TouchableOpacity>
          <View style={styles.overviewStatDivider} />
          <View style={styles.overviewStatItem}>
            <Text style={styles.overviewStatLabel}>Remaining</Text>
            <Text style={styles.overviewStatValue}>{formatCurrency(budgetStats.totalRemaining)}</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  const renderQuickStats = () => (
    <Animated.View style={[styles.quickStatsGrid, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.quickStatCard}>
        <Icon name="wallet-outline" size={28} color="white" style={{ marginBottom: 8 }} />
        <Text style={styles.quickStatValue}>
          {budgetStats.totalBudget > 0 ? `${budgetStats.percentage}%` : '0%'}
        </Text>
        <Text style={styles.quickStatLabel}>Used</Text>
      </View>

      <View style={styles.quickStatCard}>
        <Icon name="cash" size={28} color="white" style={{ marginBottom: 8 }} />
        <Text style={styles.quickStatValue}>₹{budgetStats.totalRemaining.toFixed(0)}</Text>
        <Text style={styles.quickStatLabel}>Remaining</Text>
      </View>

      <View style={styles.quickStatCard}>
        <Icon name="alert-circle" size={28} color="white" style={{ marginBottom: 8 }} />
        <Text style={styles.quickStatValue}>{budgetStats.alerts.length}</Text>
        <Text style={styles.quickStatLabel}>Alerts</Text>
      </View>
    </Animated.View>
  );

  const renderBudgetAlerts = () => {
    if (budgetStats.alerts.length === 0) {
      return null;
    }

    return (
      <Animated.View style={[styles.alertsSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Budget Alerts</Text>
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{budgetStats.alerts.length}</Text>
          </View>
        </View>

        {budgetStats.alerts.map((alert, index) => (
          <View key={index} style={styles.alertCard}>
            <View style={styles.alertIconContainer}>
              <Icon
                name={alert.severity === 'danger' ? 'alert-circle' : 'alert'}
                size={24}
                color="white"
              />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertCategory}>{alert.category}</Text>
              <Text style={styles.alertMessage}>{alert.message}</Text>
            </View>
            <View style={[
              styles.alertSeverityBadge,
              {
                backgroundColor: alert.severity === 'danger' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(255, 152, 0, 0.2)',
                borderWidth: 1,
                borderColor: alert.severity === 'danger' ? 'rgba(244, 67, 54, 0.5)' : 'rgba(255, 152, 0, 0.5)'
              }
            ]}>
              <Text style={[
                styles.alertSeverityText,
                { color: 'white' }
              ]}>
                {alert.severity === 'danger' ? 'OVER' : 'WARNING'}
              </Text>
            </View>
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderCategoryBudgets = () => {
    if (budgetStats.categories.length === 0) {
      return (
        <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
          <Icon name="wallet-plus" size={64} color={theme.textSecondary} />
          <Text style={styles.emptyTitle}>No Budgets Set</Text>
          <Text style={styles.emptyMessage}>
            Create your first {selectedPeriod.toLowerCase()} budget to start tracking your spending
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleAddBudget}
          >
            <Icon name="plus" size={20} color="white" />
            <Text style={styles.createButtonText}>Create Budget</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={[styles.categoriesSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Category Budgets</Text>
          <TouchableOpacity onPress={handleAddBudget}>
            <Icon name="plus-circle" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {budgetStats.categories.map((category) => {
          const budget = budgets.find(b => b.category === category.id && b.period === selectedPeriod);
          const isExpanded = expandedCards[category.id];

          return (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => toggleCardExpansion(category.id)}
              activeOpacity={0.7}
            >
              <View style={styles.categoryHeader}>
                <View style={styles.categoryInfo}>
                  <View style={styles.categoryIconContainer}>
                    <Icon name={category.icon} size={24} color="white" />
                  </View>
                  <View style={styles.categoryDetails}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryAmount}>
                      {formatCurrency(category.spent)} of {formatCurrency(category.budget)}
                    </Text>
                  </View>
                </View>
                <View style={styles.categoryActions}>
                  <CircularProgress
                    percentage={category.percentage}
                    size={60}
                    strokeWidth={6}
                    color={getBudgetStatusColor(category.percentage)}
                    backgroundColor={theme.border}
                    showPercentage={true}
                    textColor={theme.text}
                    fontSize={14}
                  />
                  {budget && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.editIconButton}
                        onPress={() => handleEditBudget(budget)}
                      >
                        <Icon name="pencil" size={16} color="white" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteIconButton}
                        onPress={() => handleDeleteBudget(budget.id)}
                      >
                        <Icon name="delete" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(category.percentage, 100)}%`,
                        backgroundColor: getBudgetStatusColor(category.percentage)
                      }
                    ]}
                  />
                </View>
              </View>

              <View style={styles.categoryFooter}>
                <Text style={styles.categoryFooterText}>
                  ₹{category.remaining.toFixed(2)} remaining
                </Text>
                <TouchableOpacity onPress={() => toggleCardExpansion(category.id)}>
                  <Text style={[styles.categoryFooterText, { color: 'white', fontWeight: '600' }]}>
                    {isExpanded ? 'Show less' : `${category.transactions} transactions`}
                  </Text>
                </TouchableOpacity>
              </View>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.expandedDivider} />
                  <Text style={styles.expandedTitle}>Spending Details</Text>
                  <View style={styles.expandedStats}>
                    <View style={styles.expandedStatItem}>
                      <Text style={styles.expandedStatLabel}>Average per transaction</Text>
                      <Text style={styles.expandedStatValue}>
                        ₹{category.transactions > 0 ? (category.spent / category.transactions).toFixed(2) : '0.00'}
                      </Text>
                    </View>
                    <View style={styles.expandedStatItem}>
                      <Text style={styles.expandedStatLabel}>Daily average</Text>
                      <Text style={styles.expandedStatValue}>
                        ₹{(category.spent / Math.max(1, 30 - budgetStats.daysRemaining)).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Budget Sync Info */}
                  <View style={styles.syncInfoCard}>
                    <Icon name="sync" size={16} color={theme.primary} />
                    <View style={styles.syncInfoContent}>
                      <Text style={styles.syncInfoLabel}>Budget Sync</Text>
                      {selectedPeriod === 'Weekly' && (
                        <>
                          <Text style={styles.syncInfoText}>
                            Monthly: ₹{(category.budget * 4).toFixed(2)} (Weekly × 4)
                          </Text>
                          <Text style={styles.syncInfoText}>
                            Yearly: ₹{(category.budget * 52).toFixed(2)} (Weekly × 52)
                          </Text>
                        </>
                      )}
                      {selectedPeriod === 'Monthly' && (
                        <>
                          <Text style={styles.syncInfoText}>
                            Weekly: ₹{(category.budget / 4).toFixed(2)} (Monthly ÷ 4)
                          </Text>
                          <Text style={styles.syncInfoText}>
                            Yearly: ₹{(category.budget * 12).toFixed(2)} (Monthly × 12)
                          </Text>
                        </>
                      )}
                      {selectedPeriod === 'Yearly' && (
                        <>
                          <Text style={styles.syncInfoText}>
                            Monthly: ₹{(category.budget / 12).toFixed(2)} (Yearly ÷ 12)
                          </Text>
                          <Text style={styles.syncInfoText}>
                            Weekly: ₹{(category.budget / 52).toFixed(2)} (Yearly ÷ 52)
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {category.percentage > 100 && (
                    <View style={styles.overBudgetWarning}>
                      <Icon name="alert-circle" size={16} color={theme.error} />
                      <Text style={styles.overBudgetText}>
                        Over budget by ₹{(category.spent - category.budget).toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    );
  };

  const renderBudgetPopup = () => (
    <Modal
      visible={showBudgetPopup}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => setShowBudgetPopup(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.popupContainer}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>Budget Breakdown</Text>
            <TouchableOpacity onPress={() => setShowBudgetPopup(false)} style={styles.closeButton}>
              <Icon name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.popupScroll} showsVerticalScrollIndicator={false}>
            {budgetStats.categories.map((cat, index) => (
              <View key={index} style={styles.popupItem}>
                <View style={styles.popupItemLeft}>
                  <View style={[styles.popupIcon, { backgroundColor: cat.color }]}>
                    <Icon name={cat.icon} size={20} color="white" />
                  </View>
                  <Text style={styles.popupItemName}>{cat.name}</Text>
                </View>
                <Text style={styles.popupItemValue}>{formatCurrency(cat.budget || 0)}</Text>
              </View>
            ))}
            {budgetStats.categories.length === 0 && (
              <Text style={styles.emptyPopupText}>No budgets set for this period.</Text>
            )}
          </ScrollView>
          <View style={styles.popupFooter}>
            <Text style={styles.popupTotalLabel}>Total Budget</Text>
            <Text style={styles.popupTotalValue}>{formatCurrency(budgetStats.totalBudget)}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderSpentPopup = () => (
    <Modal
      visible={showSpentPopup}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => setShowSpentPopup(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.popupContainer}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>Spending Breakdown</Text>
            <TouchableOpacity onPress={() => setShowSpentPopup(false)} style={styles.closeButton}>
              <Icon name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.popupScroll} showsVerticalScrollIndicator={false}>
            {budgetStats.categories.map((cat, index) => (
              <View key={index} style={styles.popupItem}>
                <View style={styles.popupItemLeft}>
                  <View style={[styles.popupIcon, { backgroundColor: cat.color }]}>
                    <Icon name={cat.icon} size={20} color="white" />
                  </View>
                  <Text style={styles.popupItemName}>{cat.name}</Text>
                </View>
                <Text style={styles.popupItemValue}>{formatCurrency(cat.spent || 0)}</Text>
              </View>
            ))}
            {budgetStats.categories.length === 0 && (
              <Text style={styles.emptyPopupText}>No spending data available.</Text>
            )}
          </ScrollView>
          <View style={styles.popupFooter}>
            <Text style={styles.popupTotalLabel}>Total Spent</Text>
            <Text style={styles.popupTotalValue}>{formatCurrency(budgetStats.totalSpent)}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Background */}
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.background}
      />

      <SafeAreaView style={styles.safeArea}>
        {renderHeader()}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="white"
            />
          }
        >
          {renderPeriodSelector()}
          {renderBudgetOverview()}
          {renderQuickStats()}
          {renderBudgetAlerts()}
          <BudgetInsights categories={budgetStats.categories} theme={theme} />
          {renderCategoryBudgets()}
        </ScrollView>

        {/* Add/Edit Budget Modal */}
        <AddBudgetModal
          visible={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setEditingBudget(null);
          }}
          onSave={handleSaveBudget}
          editingBudget={editingBudget}
          period={selectedPeriod}
          theme={theme}
        />

        {/* Detail Popups */}
        {renderBudgetPopup()}
        {renderSpentPopup()}
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
  },

  // Header (matches other screens)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: (StatusBar.currentHeight || 0) + 10,
    paddingBottom: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: 'white',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  periodButtonTextActive: {
    color: theme.primary,
  },

  // Budget Overview Card
  overviewCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  overviewGradient: {
    padding: 24,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  overviewSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  progressContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  overviewStatItem: {
    alignItems: 'center',
  },
  overviewStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  overviewStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  overviewStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Quick Stats Grid
  quickStatsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  quickStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },

  // Alerts Section
  alertsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  alertBadge: {
    backgroundColor: theme.error,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  editButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertCategory: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  alertSeverityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  alertSeverityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Categories Section
  categoriesSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },

  // Category Card
  categoryCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  categoryActions: {
    alignItems: 'flex-end',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  editIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  deleteIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    color: 'white',
    marginBottom: 4,
  },
  categoryAmount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
  },
  categoryFooterText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  expandedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  expandedStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  expandedStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  expandedStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  expandedStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  overBudgetWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  overBudgetText: {
    fontSize: 13,
    color: '#FFCDD2',
    fontWeight: '500',
  },
  syncInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
  },
  syncInfoContent: {
    flex: 1,
  },
  syncInfoLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginBottom: 2,
  },
  syncInfoText: {
    fontSize: 13,
    color: 'white',
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },

  // Popup Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupContainer: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  closeButton: {
    padding: 4,
    backgroundColor: theme.border,
    borderRadius: 20,
  },
  popupScroll: {
    marginBottom: 20,
  },
  popupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  popupItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  popupIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  popupItemSubtext: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  popupItemValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  emptyPopupText: {
    textAlign: 'center',
    color: theme.textSecondary,
    marginTop: 20,
    fontStyle: 'italic',
  },
  popupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  popupTotalLabel: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  popupTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
});
