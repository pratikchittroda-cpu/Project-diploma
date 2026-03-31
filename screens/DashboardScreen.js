
import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { AppIcons, Icon } from '../constants/Icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import BudgetAdvisor from '../components/BudgetAdvisor';
import GlassCard from '../components/GlassCard';
import aiService from '../services/aiService';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const { user, userData } = useAuth();
  const { transactions, loading: transactionsLoading, getTransactionStats, refresh: refreshTransactions } = useTransactions();


  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [dashboardStats, setDashboardStats] = useState({
    week: { balance: 0, income: 0, expenses: 0 },
    monthlyIncome: 0,
    monthlyExpenses: 0,
    month: { balance: 0, income: 0, expenses: 0 },
    year: { balance: 0, income: 0, expenses: 0 },
    totalBalance: 0,
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

    } catch (error) {
      // Error auto-refreshing dashboard
    }
  };

  // Manual refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshTransactions();

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
          week: { balance: 0, income: 0, expenses: 0 },
          month: { balance: 0, income: 0, expenses: 0 },
          year: { balance: 0, income: 0, expenses: 0 },
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

      const now = new Date();
      const currentWeekStart = new Date(now);
      currentWeekStart.setHours(0, 0, 0, 0);
      currentWeekStart.setDate(now.getDate() - now.getDay());
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekStart.getDate() + 7);

      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const currentYearStart = new Date(now.getFullYear(), 0, 1);
      const currentYearEnd = new Date(now.getFullYear() + 1, 0, 1);

      const getPeriodStats = (startDate, endDate) => {
        const periodTransactions = transactions.filter(t => {
          const transactionDate = new Date(t.date || t.createdAt);
          return transactionDate >= startDate && transactionDate < endDate;
        });

        const income = periodTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);

        const expenses = periodTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          balance: income - expenses,
          income,
          expenses,
        };
      };

      const weeklyStats = getPeriodStats(currentWeekStart, currentWeekEnd);
      const monthlyStats = getPeriodStats(currentMonthStart, currentMonthEnd);
      const yearlyStats = getPeriodStats(currentYearStart, currentYearEnd);

      setDashboardStats({
        week: weeklyStats,
        month: monthlyStats,
        year: yearlyStats,
        totalBalance,
        monthlyIncome: monthlyStats.income,
        monthlyExpenses: monthlyStats.expenses,
        budgetUsed: monthlyStats.expenses,
        budgetLimit: userData?.monthlyBudget || 0,
      });
    };

    calculateDashboardStats();
  }, [transactions, userData]);

  // Calculate AI recommendations only when transaction count changes
  const aiRecommendations = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    const currentMonth = new Date().toISOString().slice(0, 7);

    // Use default budgets if none set
    const budgets = userData?.budgets || {
      food: 5000,
      transport: 2000,
      shopping: 3000,
      entertainment: 1000,
      bills: 2000,
      health: 1000
    };

    const recommendations = aiService.getBudgetRecommendations(
      transactions,
      budgets,
      currentMonth
    );

    return recommendations;
  }, [transactions?.length, userData?.budgets]); // Only recalculate when count changes

  // Auto-refresh interval
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      if (refreshTransactions) refreshTransactions();
    }, 30000);

    const unsubscribe = navigation.addListener('focus', () => {
      if (refreshTransactions) refreshTransactions();

    });

    return () => {
      clearInterval(autoRefreshInterval);
      if (unsubscribe) unsubscribe();
    };
  }, [navigation, refreshTransactions]);

  // Helper for icons
  const getCategoryIcon = (category) => {
    const iconMap = {
      food: 'hamburger',
      transport: 'car',
      shopping: 'shopping',
      entertainment: 'movie-open',
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


  }, []);



  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  const selectedStats = dashboardStats[selectedPeriod] || dashboardStats.month;
  const periodLabel = selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1);

  const renderOverviewCard = () => (
    <Animated.View style={[styles.overviewContainer, { opacity: fadeAnim, transform: [{ scale: cardScale }] }]}>
      <GlassCard
        style={styles.overviewCard}
        borderRadius={28}
        padding={24}
      >
        <View style={styles.overviewHeader}>
          <Text style={[styles.overviewTitle, { color: 'rgba(255,255,255,0.9)' }]}>{periodLabel} Balance</Text>
          <View style={styles.periodToggle}>
            {['week', 'month', 'year'].map((period) => {
              const isActive = selectedPeriod === period;
              return (
                <TouchableOpacity
                  key={period}
                  style={[styles.periodButton, isActive && styles.periodButtonActive]}
                  onPress={() => setSelectedPeriod(period)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.periodButtonText, isActive && styles.periodButtonTextActive]}>
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <Text style={[styles.balanceAmount, { color: 'white' }]}>{formatCurrency(selectedStats.balance)}</Text>

        <View style={styles.incomeExpenseRow}>
          <View style={styles.incomeExpenseItem}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(76, 175, 80, 0.25)' }]}>
              <AppIcons.Income size={22} color="#4CAF50" />
            </View>
            <View>
              <Text style={[styles.incomeExpenseLabel, { color: 'rgba(255,255,255,0.7)' }]}>Income</Text>
              <Text style={styles.incomeAmount}>{formatCurrency(selectedStats.income)}</Text>
            </View>
          </View>
          <View style={styles.incomeExpenseItem}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 82, 82, 0.25)' }]}>
              <AppIcons.Expense size={22} color="#FF5252" />
            </View>
            <View>
              <Text style={[styles.incomeExpenseLabel, { color: 'rgba(255,255,255,0.7)' }]}>Expenses</Text>
              <Text style={styles.expenseAmount}>{formatCurrency(selectedStats.expenses)}</Text>
            </View>
          </View>
        </View>
      </GlassCard>
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
            <AppIcons.Profile size={40} color="rgba(255,255,255,0.9)" />
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

          <TouchableOpacity style={styles.aiChatButton} onPress={() => navigation.navigate('AIChat')}>
            <View style={styles.aiChatIcon}>
              <Icon name="robot-excited-outline" size={18} color="white" />
            </View>
            <View style={styles.aiChatTextWrap}>
              <Text style={styles.aiChatTitle}>Ask Financial AI</Text>
              <Text style={styles.aiChatSubtitle}>Get advice based on your spending data</Text>
            </View>
            <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>

          {/* AI Budget Advisor */}
          {aiRecommendations.length > 0 && (
            <BudgetAdvisor recommendations={aiRecommendations} />
          )}

          {/* Recent Transactions Section */}
          <Animated.View style={[styles.sectionContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <GlassCard
              style={styles.transactionsList}
              borderRadius={24}
              padding={5}
            >
              {transactionsLoading ? (
                <ActivityIndicator size="small" color={theme.isDarkMode ? "white" : "#333"} style={{ marginVertical: 20 }} />
              ) : recentTransactions.length > 0 ? (
                recentTransactions.map((transaction, index) =>
                  renderTransactionItem(transaction, index)
                )
              ) : (
                <Text style={[styles.emptyText, { color: theme.isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
                  No transactions yet. Add your first one!
                </Text>
              )}
            </GlassCard>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Background handled by theme in component or parent
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
  overviewContainer: {
    marginBottom: 25,
  },
  aiChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 24,
  },
  aiChatIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  aiChatTextWrap: {
    flex: 1,
  },
  aiChatTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  aiChatSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  overviewCard: {
    // Styling handled by GlassCard
  },
  cardContent: {
    padding: 0,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  periodToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  periodButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  periodButtonText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  overviewTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: '700',
    color: 'white',
    marginBottom: 24,
    letterSpacing: 0.5,
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

  // Transactions List
  transactionsList: {
    borderRadius: 24,
    borderWidth: 0,
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
