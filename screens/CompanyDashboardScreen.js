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
  Platform,
  SafeAreaView,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import UserTypeGuard from '../components/UserTypeGuard';

const { width } = Dimensions.get('window');

export default function CompanyDashboardScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const { userData } = useAuth();
  const { transactions, refresh: refreshTransactions, loading: transactionsLoading } = useTransactions();

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Calculate real company statistics from transactions
  useEffect(() => {
    const calculateCompanyStats = async () => {
      if (!transactions || transactions.length === 0) {
        setDashboardStats(prev => ({ ...prev, recentTransactions: [] }));
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

        setDashboardStats(prev => ({
          ...prev,
          totalRevenue,
          monthlyRevenue,
          monthlyExpenses,
          netProfit,
          employeeCount: userData?.employeeCount || 0,
          activeProjects: userData?.activeProjects || 0,
          pendingInvoices: userData?.pendingInvoices || 0,
          recentTransactions,
        }));

      } catch (error) {
        console.error("Error calculating stats:", error);
      }
    };

    calculateCompanyStats();
  }, [transactions, userData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      refreshTransactions();
      await loadRecentActions();
    } catch (error) {
      console.error("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Entrance animation
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
      console.error("Error updating recent actions:", error);
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
      console.error("Error clearing inappropriate actions:", error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleProfilePress = () => {
    navigation.navigate('CompanyProfile');
  };

  const getCategoryIcon = (category) => {
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
    return iconMap[category?.toLowerCase()] || 'dots-horizontal';
  };

  const renderOverviewCard = () => (
    <Animated.View style={[styles.overviewCard, { opacity: fadeAnim, transform: [{ scale: cardScale }] }]}>
      <View style={styles.overviewHeader}>
        <Text style={styles.overviewTitle}>Total Revenue</Text>
        <TouchableOpacity>
          <Icon name="eye-outline" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>
      <Text style={styles.balanceAmount}>{formatCurrency(dashboardStats.totalRevenue)}</Text>

      <View style={styles.incomeExpenseRow}>
        <View style={styles.incomeExpenseItem}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
            <Icon name="trending-up" size={20} color="#4CAF50" />
          </View>
          <View>
            <Text style={styles.incomeExpenseLabel}>Net Profit</Text>
            <Text style={styles.incomeAmount}>{formatCurrency(dashboardStats.netProfit)}</Text>
          </View>
        </View>
        <View style={styles.incomeExpenseItem}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 82, 82, 0.2)' }]}>
            <Icon name="arrow-down-circle" size={20} color="#FF5252" />
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
        <Text style={styles.transactionCategory}>
          {transaction.category} • {transaction.department || 'General'} • {transaction.date}
        </Text>
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
    <UserTypeGuard requiredUserType="company" navigation={navigation}>
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
              <Text style={styles.greeting}>Good Morning!</Text>
              <Text style={styles.userName}>{userData?.companyName || 'Company Dashboard'}</Text>
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
                onRefresh={handleRefresh}
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
                    <View style={[styles.actionIconContainer, { backgroundColor: `${action.color}20` }]}>
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
                <TouchableOpacity onPress={() => navigation.navigate('CompanyTransactions')}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.transactionsList}>
                {transactionsLoading ? (
                  <ActivityIndicator size="small" color="white" style={{ marginVertical: 20 }} />
                ) : dashboardStats.recentTransactions.length > 0 ? (
                  dashboardStats.recentTransactions.map((transaction, index) =>
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
    </UserTypeGuard>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea', // Fallback
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

  // Recent Actions Grid
  recentActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recentActionButton: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
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