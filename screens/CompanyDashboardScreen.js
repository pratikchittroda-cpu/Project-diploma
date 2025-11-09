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
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import UserTypeGuard from '../components/UserTypeGuard';

// Dimensions removed as not used

export default function CompanyDashboardScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const { userData } = useAuth();
  const { transactions, refresh: refreshTransactions } = useTransactions();
  const [recentActions, setRecentActions] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    netProfit: 0,
    employeeCount: 0,
    activeProjects: 0,
    pendingInvoices: 0,
    recentTransactions: [],
    topExpenseCategories: [],
    monthlyTrends: [],
  });
  const [refreshing, setRefreshing] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.background || '#f8f9fa' }}>
        <StatusBar backgroundColor={theme?.background || '#f8f9fa'} barStyle={theme?.statusBarStyle || 'dark-content'} />
        <ActivityIndicator size="large" color={theme?.primary || '#667eea'} />
      </View>
    );
  }

  // Calculate real company statistics from transactions
  useEffect(() => {
    const calculateCompanyStats = async () => {
      if (!transactions || transactions.length === 0) {
        return;
      }

      try {
        // Get current month data
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const currentMonthTransactions = transactions.filter(t => {
          const transactionDate = new Date(t.date || t.createdAt);
          return transactionDate >= currentMonthStart && transactionDate <= currentMonthEnd;
        });

        // Calculate monthly revenue and expenses
        const monthlyRevenue = currentMonthTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);

        const monthlyExpenses = currentMonthTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        // Calculate total revenue (all time)
        const totalRevenue = transactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);

        const netProfit = monthlyRevenue - monthlyExpenses;

        // Get recent transactions (last 5)
        const recentTransactions = transactions
          .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
          .slice(0, 5)
          .map(t => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            description: t.description || t.note || 'Transaction',
            date: t.date || t.createdAt?.split('T')[0],
            category: t.category || 'general',
            department: t.department || 'General'
          }));

        // Calculate expense categories
        const categoryTotals = {};
        currentMonthTransactions
          .filter(t => t.type === 'expense')
          .forEach(t => {
            const category = t.category || 'others';
            categoryTotals[category] = (categoryTotals[category] || 0) + t.amount;
          });

        const topExpenseCategories = Object.entries(categoryTotals)
          .map(([category, amount]) => ({
            name: getCategoryName(category),
            amount,
            percentage: monthlyExpenses > 0 ? (amount / monthlyExpenses) * 100 : 0,
            color: getCategoryColor(category),
            icon: getCategoryIcon(category)
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 6);

        // Calculate monthly trends (last 3 months)
        const monthlyTrends = [];
        for (let i = 2; i >= 0; i--) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

          const monthTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date || t.createdAt);
            return transactionDate >= monthStart && transactionDate <= monthEnd;
          });

          const monthRevenue = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

          const monthExpenses = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

          monthlyTrends.push({
            month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
            revenue: monthRevenue,
            expenses: monthExpenses,
            profit: monthRevenue - monthExpenses
          });
        }

        setDashboardStats({
          totalRevenue,
          monthlyRevenue,
          monthlyExpenses,
          netProfit,
          employeeCount: userData?.employeeCount || 0,
          activeProjects: userData?.activeProjects || 0,
          pendingInvoices: userData?.pendingInvoices || 0,
          recentTransactions,
          topExpenseCategories,
          monthlyTrends,
        });

        // Recent actions are now handled separately in loadRecentActions()
      } catch (error) {
        }
    };

    calculateCompanyStats();
  }, [transactions, userData]);

  const getCategoryName = (categoryId) => {
    const categoryMap = {
      office: 'Office Supplies',
      software: 'Software',
      marketing: 'Marketing',
      utilities: 'Utilities',
      salaries: 'Salaries',
      rent: 'Office Rent',
      meals: 'Meals & Entertainment',
      transport: 'Transportation',
      others: 'Others'
    };
    return categoryMap[categoryId] || 'Others';
  };

  const getCategoryIcon = (categoryId) => {
    const iconMap = {
      office: 'office-building',
      software: 'laptop',
      marketing: 'bullhorn',
      utilities: 'flash',
      salaries: 'account-group',
      rent: 'home',
      meals: 'food',
      transport: 'car',
      others: 'dots-horizontal'
    };
    return iconMap[categoryId] || 'dots-horizontal';
  };

  const getCategoryColor = (categoryId) => {
    const colorMap = {
      office: '#2196F3',
      software: '#FF9800',
      marketing: '#9C27B0',
      utilities: '#607D8B',
      salaries: '#4CAF50',
      rent: '#795548',
      meals: '#FF5722',
      transport: '#00BCD4',
      others: '#9E9E9E'
    };
    return colorMap[categoryId] || '#9E9E9E';
  };



  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      refreshTransactions();
      await loadRecentActions();
    } catch (error) {
      } finally {
      setRefreshing(false);
    }
  };

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

    // Clear any inappropriate actions first, then load recent actions
    clearInappropriateActions();
    loadRecentActions();

    // Auto-refresh data every 30 seconds
    const autoRefreshInterval = setInterval(() => {
      refreshTransactions();
    }, 30000);

    // Listen for navigation focus to update recent actions and refresh data
    const unsubscribe = navigation.addListener('focus', () => {
      loadRecentActions();
      refreshTransactions(); // Auto-refresh when screen comes into focus
    });

    return () => {
      clearInterval(autoRefreshInterval);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [navigation]);

  const loadRecentActions = async () => {
    try {
      const stored = await AsyncStorage.getItem('company_recent_actions');
      if (stored) {
        const storedActions = JSON.parse(stored);
        // Filter out any inappropriate actions and ensure valid structure
        const validActions = storedActions.filter(action =>
          action &&
          action.id &&
          action.name &&
          ['reports', 'team', 'budget', 'add', 'analytics', 'settings', 'profile'].includes(action.id)
        );
        setRecentActions(validActions);
      } else {
        // Default business-appropriate actions
        const defaultActions = [
          { id: 'reports', name: 'Reports', icon: 'chart-line', color: '#4CAF50' },
          { id: 'team', name: 'Team', icon: 'account-group', color: '#2196F3' },
          { id: 'budget', name: 'Budget', icon: 'calculator', color: '#FF9800' },
          { id: 'add', name: 'Add Transaction', icon: 'plus-circle', color: '#9C27B0' },
        ];
        setRecentActions(defaultActions);
        // Save the clean default actions
        await AsyncStorage.setItem('company_recent_actions', JSON.stringify(defaultActions));
      }
    } catch (error) {
      // Fallback to default actions
      setRecentActions([
        { id: 'reports', name: 'Reports', icon: 'chart-line', color: '#4CAF50' },
        { id: 'team', name: 'Team', icon: 'account-group', color: '#2196F3' },
        { id: 'budget', name: 'Budget', icon: 'calculator', color: '#FF9800' },
        { id: 'add', name: 'Add Transaction', icon: 'plus-circle', color: '#9C27B0' },
      ]);
    }
  };

  const updateRecentActions = async (actionId, actionName, actionIcon, actionColor) => {
    try {
      // Only allow business-appropriate actions
      const allowedActions = ['reports', 'team', 'budget', 'add', 'analytics', 'settings', 'profile'];
      if (!allowedActions.includes(actionId)) {
        return; // Don't add inappropriate actions
      }

      const newAction = { id: actionId, name: actionName, icon: actionIcon, color: actionColor, timestamp: Date.now() };

      let updatedActions = recentActions.filter(action => action.id !== actionId);
      updatedActions.unshift(newAction);
      updatedActions = updatedActions.slice(0, 4); // Keep only 4 most recent

      setRecentActions(updatedActions);
      await AsyncStorage.setItem('company_recent_actions', JSON.stringify(updatedActions));
    } catch (error) {
      }
  };

  // Function to clear any inappropriate actions from storage
  const clearInappropriateActions = async () => {
    try {
      const stored = await AsyncStorage.getItem('company_recent_actions');
      if (stored) {
        const storedActions = JSON.parse(stored);
        const cleanActions = storedActions.filter(action => {
          // Ensure action has valid id and name properties
          if (!action || !action.id || !action.name) {
            return false; // Remove invalid actions
          }

          // Check if action contains inappropriate keywords
          const inappropriateKeywords = ['shopping', 'shop', 'buy', 'purchase', 'store'];
          return !inappropriateKeywords.some(keyword =>
            action.id.toLowerCase().includes(keyword) ||
            action.name.toLowerCase().includes(keyword)
          );
        });

        if (cleanActions.length !== storedActions.length) {
          await AsyncStorage.setItem('company_recent_actions', JSON.stringify(cleanActions));
          setRecentActions(cleanActions);
        }
      }
    } catch (error) {
      }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2).replace(/\\d(?=(\\d{3})+\\.)/g, '$&,')}`;
  };

  const handleProfilePress = () => {
    navigation.navigate('CompanyProfile');
  };

  const styles = createStyles(theme);

  return (
    <UserTypeGuard requiredUserType="company" navigation={navigation}>
      <StatusBar backgroundColor={theme.background} barStyle={theme.statusBarStyle} />
      <View style={styles.container}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View>
            <Text style={styles.greeting}>Good Morning!</Text>
            <Text style={styles.userName}>Company Dashboard</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleProfilePress}
          >
            <Icon name="account-circle" size={48} color={theme.primary} />
          </TouchableOpacity>
        </Animated.View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          {/* Company Overview Section */}
          <Animated.View style={[styles.overviewCard, { opacity: fadeAnim, transform: [{ scale: cardScale }] }]}>
            <LinearGradient
              colors={[theme.primary, theme.primaryLight]}
              style={styles.overviewGradient}
            >
              <View style={styles.overviewHeader}>
                <Text style={styles.companyName}>{userData?.companyName || userData?.fullName || 'Company'}</Text>
                <TouchableOpacity>
                  <Icon name="eye-outline" size={20} color="white" />
                </TouchableOpacity>
              </View>
              <Text style={styles.revenueAmount}>{formatCurrency(dashboardStats.totalRevenue)}</Text>
              <Text style={styles.revenueLabel}>Total Revenue</Text>

              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Icon name="trending-up" size={16} color="#4CAF50" />
                  <Text style={styles.metricLabel}>Net Profit</Text>
                  <Text style={styles.profitAmount}>{formatCurrency(dashboardStats.netProfit)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Icon name="account-group" size={16} color="#FF9800" />
                  <Text style={styles.metricLabel}>Employees</Text>
                  <Text style={styles.employeeCount}>{dashboardStats.employeeCount}</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Recent Actions Section */}
          <Animated.View style={[styles.recentActionsSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.sectionTitle}>Recent Actions</Text>
            <View style={styles.recentActionsGrid}>
              {recentActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.recentActionButton}
                  onPress={() => {
                    updateRecentActions(action.id, action.name, action.icon, action.color);
                    if (action.id === 'reports') {
                      navigation.navigate('CompanyReports');
                    } else if (action.id === 'team') {
                      navigation.navigate('TeamManagement');
                    } else if (action.id === 'budget') {
                      navigation.navigate('CompanyBudget');
                    } else if (action.id === 'add') {
                      navigation.navigate('AddCompanyTransaction');
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
              {dashboardStats.recentTransactions.map((transaction) => (
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
                      name={transaction.type === 'income' ? 'cash-multiple' : 'wallet'}
                      size={20}
                      color={transaction.type === 'income' ? '#4CAF50' : '#FF9800'}
                    />
                  </View>

                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionDescription}>{transaction.description}</Text>
                    <Text style={styles.transactionCategory}>
                      {transaction.category} • {transaction.department} • {transaction.date}
                    </Text>
                  </View>

                  <Text style={[
                    styles.transactionAmount,
                    { color: transaction.type === 'income' ? '#4CAF50' : '#FF5252' }
                  ]}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </Text>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </UserTypeGuard>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: (StatusBar.currentHeight || 0) + 40,
    paddingBottom: 30,
    backgroundColor: theme.headerBackground || theme.background,
  },
  greeting: {
    fontSize: 18,
    color: theme.textSecondary,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
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

  // Company Overview Card Styles
  overviewCard: {
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: theme.shadow || '#000',
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
  companyName: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
  revenueAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  revenueLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
    marginBottom: 5,
  },
  profitAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  employeeCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
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
    backgroundColor: theme.cardBackground || theme.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: theme.shadow || '#000',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  seeAllText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },
  transactionsList: {
    backgroundColor: theme.cardBackground || theme.surface,
    borderRadius: 15,
    overflow: 'hidden',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider || theme.border,
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