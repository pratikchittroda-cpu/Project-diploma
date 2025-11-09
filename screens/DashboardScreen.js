import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';

const { width, height } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  
  // Don't render until theme is loaded - check this BEFORE other hooks
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.background || '#f8f9fa' }}>
        <StatusBar backgroundColor="transparent" barStyle={theme?.statusBarStyle || 'dark-content'} translucent={true} />
        <ActivityIndicator size="large" color={theme?.primary || '#667eea'} />
      </View>
    );
  }

  const { user, userData } = useAuth();
  const { transactions, loading: transactionsLoading, getTransactionStats, refresh: refreshTransactions } = useTransactions();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [recentActions, setRecentActions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    budgetUsed: 0,
    budgetLimit: 0,
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Auto refresh functionality when screen becomes active
  const autoRefresh = async () => {
    try {
      // Refresh transactions silently (this will trigger stats recalculation)
      await refreshTransactions();

      // Reload recent actions
      await loadRecentActions();
    } catch (error) {
      // Error auto-refreshing dashboard
    }
  };

  // Manual refresh functionality (keeping for optional pull-to-refresh)
  const onRefresh = async () => {
    setRefreshing(true);

    try {
      // Refresh transactions first (this will trigger stats recalculation)
      await refreshTransactions();

      // Reload recent actions
      await loadRecentActions();

      // Add a small delay for better UX
      setTimeout(() => {
        setRefreshing(false);
      }, 500);

    } catch (error) {
      setRefreshing(false);
    }
  };

  // Load dashboard statistics from Firebase - recalculate whenever transactions change
  useEffect(() => {
    const calculateDashboardStats = () => {
      if (!transactions || transactions.length === 0) {
        setDashboardStats({
          totalBalance: 0,
          monthlyIncome: 0,
          monthlyExpenses: 0,
          budgetUsed: 0,
          budgetLimit: 0,
        });
        return;
      }

      // Calculate total balance (all income - all expenses)
      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalBalance = totalIncome - totalExpenses;

      // Calculate current month data
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const currentMonthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date || t.createdAt);
        return transactionDate >= currentMonthStart && transactionDate <= currentMonthEnd;
      });

      const monthlyIncome = currentMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const monthlyExpenses = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      setDashboardStats({
        totalBalance,
        monthlyIncome,
        monthlyExpenses,
        budgetUsed: monthlyExpenses, // Current month expenses as budget used
        budgetLimit: userData?.monthlyBudget || 0,
      });
    };

    calculateDashboardStats();
  }, [transactions, userData]); // Recalculate when transactions or user data changes

  // Auto-refresh functionality
  useEffect(() => {
    // Auto-refresh every 30 seconds
    const autoRefreshInterval = setInterval(() => {
      if (refreshTransactions) {
        refreshTransactions();
      }
    }, 30000);

    // Listen for navigation focus to refresh data
    const unsubscribe = navigation.addListener('focus', () => {
      if (refreshTransactions) {
        refreshTransactions();
      }
      loadRecentActions();
    });

    return () => {
      clearInterval(autoRefreshInterval);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [navigation, refreshTransactions]);

  // Helper function for category icons - MUST be defined before use
  const getCategoryIcon = (category) => {
    const iconMap = {
      food: 'food',
      transport: 'car',
      shopping: 'shopping',
      entertainment: 'movie',
      health: 'medical-bag',
      salary: 'cash',
      freelance: 'laptop',
      business: 'briefcase',
      other: 'help-circle'
    };
    return iconMap[category] || 'help-circle';
  };

  // Get recent transactions for display
  const recentTransactions = transactions.slice(0, 5).map(transaction => ({
    ...transaction,
    icon: getCategoryIcon(transaction.category)
  }));

  useEffect(() => {
    // Entrance animation
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
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Load recent actions
    loadRecentActions();

    // Auto-refresh data every 30 seconds
    const autoRefreshInterval = setInterval(() => {
      autoRefresh();
    }, 30000);

    // Listen for navigation focus to auto-refresh and update recent actions
    const unsubscribe = navigation.addListener('focus', () => {
      loadRecentActions();
      // Auto-refresh dashboard data when screen becomes active
      autoRefresh();
    });

    return () => {
      clearInterval(autoRefreshInterval);
      unsubscribe();
    };
  }, [navigation]);

  const loadRecentActions = async () => {
    try {
      const stored = await AsyncStorage.getItem('personal_recent_actions');
      if (stored) {
        setRecentActions(JSON.parse(stored));
      } else {
        // Default actions if none stored
        setRecentActions([
          { id: 'transactions', name: 'Transactions', icon: 'swap-vertical', color: '#4CAF50' },
          { id: 'budget', name: 'Budget', icon: 'wallet', color: '#2196F3' },
          { id: 'stats', name: 'Statistics', icon: 'chart-pie', color: '#FF9800' },
          { id: 'add', name: 'Add Transaction', icon: 'plus-circle', color: '#9C27B0' },
        ]);
      }
    } catch (error) {
      // Error loading recent actions
    }
  };

  const updateRecentActions = async (actionId, actionName, actionIcon, actionColor) => {
    try {
      const newAction = { id: actionId, name: actionName, icon: actionIcon, color: actionColor, timestamp: Date.now() };

      let updatedActions = recentActions.filter(action => action.id !== actionId);
      updatedActions.unshift(newAction);
      updatedActions = updatedActions.slice(0, 4); // Keep only 4 most recent

      setRecentActions(updatedActions);
      await AsyncStorage.setItem('personal_recent_actions', JSON.stringify(updatedActions));
    } catch (error) {
      // Error updating recent actions
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
  };

  const getTransactionIcon = (category) => {
    const icons = {
      food: 'food',
      transport: 'car',
      shopping: 'shopping',
      salary: 'cash',
      freelance: 'laptop',
      cash: 'cash-multiple',
    };
    return icons[category.toLowerCase()] || 'wallet';
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  const renderOverviewCard = () => (
    <Animated.View style={[styles.overviewCard, { opacity: fadeAnim, transform: [{ scale: cardScale }] }]}>
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.overviewGradient}
      >
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewTitle}>Total Balance</Text>
          <TouchableOpacity>
            <Icon name="eye-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceAmount}>{formatCurrency(dashboardStats.totalBalance)}</Text>

        <View style={styles.incomeExpenseRow}>
          <View style={styles.incomeExpenseItem}>
            <Icon name="trending-up" size={16} color="#4CAF50" />
            <Text style={styles.incomeExpenseLabel}>Income</Text>
            <Text style={styles.incomeAmount}>{formatCurrency(dashboardStats.monthlyIncome)}</Text>
          </View>
          <View style={styles.incomeExpenseItem}>
            <Icon name="trending-down" size={16} color="#FF5252" />
            <Text style={styles.incomeExpenseLabel}>Expenses</Text>
            <Text style={styles.expenseAmount}>{formatCurrency(dashboardStats.monthlyExpenses)}</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );



  const renderTransactionItem = (transaction, index) => (
    <Animated.View
      key={transaction.id}
      style={[
        styles.transactionItem,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={[
        styles.transactionIcon,
        { backgroundColor: transaction.type === 'income' ? '#E8F5E8' : '#FFF3E0' }
      ]}>
        <Icon
          name={getTransactionIcon(transaction.category)}
          size={20}
          color={transaction.type === 'income' ? '#4CAF50' : '#FF9800'}
        />
      </View>

      <View style={styles.transactionDetails}>
        <Text style={styles.transactionDescription}>{transaction.description}</Text>
        <Text style={styles.transactionCategory}>{transaction.category} • {transaction.date}</Text>
      </View>

      <Text style={[
        styles.transactionAmount,
        { color: transaction.type === 'income' ? '#4CAF50' : '#FF5252' }
      ]}>
        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
      </Text>
    </Animated.View>
  );

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="transparent" barStyle={theme.statusBarStyle} translucent={true} />
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}, {userData?.fullName || 'User'}!
          </Text>
          <Text style={styles.userName}>Welcome back to your dashboard</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={handleProfilePress}
        >
          <Icon name="account-circle" size={40} color={theme.primary} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
            title="Pull to refresh"
            titleColor={theme.textSecondary}
          />
        }
      >
        {/* Overview Section */}
        {renderOverviewCard()}



        {/* Recent Actions Section */}
        <Animated.View style={[styles.recentActionsSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.sectionTitle}>Recent Actions</Text>
          <View style={styles.recentActionsGrid}>
            {recentActions.map((action, index) => (
              <TouchableOpacity
                key={action.id}
                style={styles.recentActionButton}
                onPress={() => {
                  updateRecentActions(action.id, action.name, action.icon, action.color);
                  if (action.id === 'transactions') {
                    navigation.navigate('Transactions');
                  } else if (action.id === 'budget') {
                    navigation.navigate('Budget');
                  } else if (action.id === 'stats') {
                    navigation.navigate('Stats');
                  } else if (action.id === 'add') {
                    navigation.navigate('AddTransaction');
                  }
                }}
              >
                <Icon name={action.icon} size={24} color={action.color} />
                <Text style={styles.recentActionText}>{action.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Recent Transactions Section */}
        <Animated.View style={[styles.transactionsSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transactionsList}>
            {transactionsLoading ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
            ) : recentTransactions.length > 0 ? (
              recentTransactions.map((transaction, index) =>
                renderTransactionItem(transaction, index)
              )
            ) : (
              <Text style={[styles.emptyText, { color: theme.textSecondary, textAlign: 'center', marginVertical: 20 }]}>
                No transactions yet. Add your first transaction!
              </Text>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: (StatusBar.currentHeight || 0) + 20, // Reduced padding for edge-to-edge
    paddingBottom: 30,
    backgroundColor: theme.headerBackground,
  },
  greeting: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 2,
  },
  profileButton: {
    padding: 5,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Overview Card Styles
  overviewCard: {
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  overviewGradient: {
    padding: 25,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  overviewTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  incomeExpenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  incomeExpenseItem: {
    flex: 1,
    alignItems: 'center',
  },
  incomeExpenseLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
    marginBottom: 5,
  },
  incomeAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.success,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.error,
  },

  // Section Title Style
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },

  // Recent Actions Section Styles
  recentActionsSection: {
    marginTop: 20,
  },
  recentActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recentActionButton: {
    width: '48%',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  recentActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginTop: 8,
  },

  // Transactions Section Styles
  transactionsSection: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  seeAllText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },
  transactionsList: {
    backgroundColor: theme.cardBackground,
    borderRadius: 15,
    overflow: 'hidden',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});