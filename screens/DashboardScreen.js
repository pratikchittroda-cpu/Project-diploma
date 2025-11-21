
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
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const { user, userData } = useAuth();
  const { transactions, loading: transactionsLoading, getTransactionStats, refresh: refreshTransactions } = useTransactions();

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

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Auto refresh functionality
  const autoRefresh = async () => {
    try {
      await refreshTransactions();
      await loadRecentActions();
    } catch (error) {
      // Error auto-refreshing dashboard
    }
  };

  // Manual refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshTransactions();
      await loadRecentActions();
      setTimeout(() => setRefreshing(false), 500);
    } catch (error) {
      setRefreshing(false);
    }
  };

  // Load dashboard statistics
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
        budgetUsed: monthlyExpenses,
        budgetLimit: userData?.monthlyBudget || 0,
      });
    };

    calculateDashboardStats();
  }, [transactions, userData]);

  // Auto-refresh interval
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      if (refreshTransactions) refreshTransactions();
    }, 30000);

    const unsubscribe = navigation.addListener('focus', () => {
      if (refreshTransactions) refreshTransactions();
      loadRecentActions();
    });

    return () => {
      clearInterval(autoRefreshInterval);
      if (unsubscribe) unsubscribe();
    };
  }, [navigation, refreshTransactions]);

  // Helper for icons
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
    return iconMap[category?.toLowerCase()] || 'help-circle';
  };

  // Recent transactions
  const recentTransactions = transactions.slice(0, 5).map(transaction => ({
    ...transaction,
    icon: getCategoryIcon(transaction.category)
  }));

  // Animations and Initial Load
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    loadRecentActions();
  }, []);

  const loadRecentActions = async () => {
    try {
      const stored = await AsyncStorage.getItem('personal_recent_actions');
      if (stored) {
        setRecentActions(JSON.parse(stored));
      } else {
        setRecentActions([
          { id: 'transactions', name: 'Transactions', icon: 'swap-vertical', color: '#4CAF50' },
          { id: 'budget', name: 'Budget', icon: 'wallet', color: '#2196F3' },
          { id: 'stats', name: 'Statistics', icon: 'chart-pie', color: '#FF9800' },
          { id: 'add', name: 'Add', icon: 'plus-circle', color: '#9C27B0' },
        ]);
      }
    } catch (error) {
      console.error('Error loading recent actions:', error);
    }
  };

  const updateRecentActions = async (actionId, actionName, actionIcon, actionColor) => {
    try {
      const newAction = { id: actionId, name: actionName, icon: actionIcon, color: actionColor, timestamp: Date.now() };
      let updatedActions = recentActions.filter(action => action.id !== actionId);
      updatedActions.unshift(newAction);
      updatedActions = updatedActions.slice(0, 4);
      setRecentActions(updatedActions);
      await AsyncStorage.setItem('personal_recent_actions', JSON.stringify(updatedActions));
    } catch (error) {
      console.error('Error updating recent actions:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  const renderOverviewCard = () => (
    <Animated.View style={[styles.overviewCard, { opacity: fadeAnim, transform: [{ scale: cardScale }] }]}>
      <View style={styles.overviewHeader}>
        <Text style={styles.overviewTitle}>Total Balance</Text>
        <TouchableOpacity>
          <Icon name="eye-outline" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>
      <Text style={styles.balanceAmount}>{formatCurrency(dashboardStats.totalBalance)}</Text>

      <View style={styles.incomeExpenseRow}>
        <View style={styles.incomeExpenseItem}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
            <Icon name="arrow-down-circle" size={20} color="#4CAF50" />
          </View>
          <View>
            <Text style={styles.incomeExpenseLabel}>Income</Text>
            <Text style={styles.incomeAmount}>{formatCurrency(dashboardStats.monthlyIncome)}</Text>
          </View>
        </View>
        <View style={styles.incomeExpenseItem}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 82, 82, 0.2)' }]}>
            <Icon name="arrow-up-circle" size={20} color="#FF5252" />
          </View>
          <View>
            <Text style={styles.incomeExpenseLabel}>Expenses</Text>
            <Text style={styles.expenseAmount}>{formatCurrency(dashboardStats.monthlyExpenses)}</Text>
          </View>
        </View>
      </View>
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
        { backgroundColor: transaction.type === 'income' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)' }
      ]}>
        <Icon
          name={getCategoryIcon(transaction.category)}
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Background */}
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.background}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}, {userData?.fullName || 'User'}!
            </Text>
            <Text style={styles.userName}>Welcome back</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleProfilePress}
          >
            <Icon name="account-circle" size={40} color="rgba(255,255,255,0.9)" />
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
              tintColor="white"
            />
          }
        >
          {/* Overview Section */}
          {renderOverviewCard()}

          {/* Recent Actions Section */}
          <Animated.View style={[styles.sectionContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.recentActionsGrid}>
              {recentActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.recentActionButton}
                  onPress={() => {
                    updateRecentActions(action.id, action.name, action.icon, action.color);
                    if (action.id === 'transactions') navigation.navigate('Transactions');
                    else if (action.id === 'budget') navigation.navigate('Budget');
                    else if (action.id === 'stats') navigation.navigate('Stats');
                    else if (action.id === 'add') navigation.navigate('AddTransaction');
                  }}
                >
                  <View style={[styles.actionIconContainer, { backgroundColor: `${action.color} 30` }]}>
                    <Icon name={action.icon} size={24} color={action.color} />
                  </View>
                  <Text style={styles.recentActionText}>{action.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Recent Transactions Section */}
          <Animated.View style={[styles.sectionContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.transactionsList}>
              {transactionsLoading ? (
                <ActivityIndicator size="small" color="white" style={{ marginVertical: 20 }} />
              ) : recentTransactions.length > 0 ? (
                recentTransactions.map((transaction, index) =>
                  renderTransactionItem(transaction, index)
                )
              ) : (
                <Text style={styles.emptyText}>
                  No transactions yet. Add your first one!
                </Text>
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#667eea',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 4,
  },
  profileButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Overview Card
  overviewCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 25,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  overviewTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: 'white',
    marginBottom: 24,
  },
  incomeExpenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  incomeExpenseItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomeExpenseLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  incomeAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF5252',
  },

  // Sections
  sectionContainer: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 15,
  },
  seeAllText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },

  // Quick Actions
  recentActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recentActionButton: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentActionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    flexShrink: 1,
  },

  // Transactions List
  transactionsList: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    color: 'white',
    marginBottom: 4,
  },
  transactionCategory: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  },
});
