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
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import UserTypeGuard from '../components/UserTypeGuard';

const { width } = Dimensions.get('window');

export default function StatsScreen({ navigation }) {
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
  const { transactions, loading: transactionsLoading, getTransactionStats } = useTransactions();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [selectedView, setSelectedView] = useState('overview');
  const [statsData, setStatsData] = useState({
    overview: {
      totalIncome: 0,
      totalExpenses: 0,
      netSavings: 0,
      savingsRate: 0,
      transactionCount: 0,
      avgDailySpending: 0,
    },
    monthlyTrends: [],
    categoryBreakdown: [],
    topCategories: [],
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

    // Track this screen visit
    trackScreenVisit();

    // Auto-refresh data every 30 seconds
    const autoRefreshInterval = setInterval(() => {
      // Auto-refresh transactions data
      if (getTransactionStats) {
        getTransactionStats();
      }
    }, 30000);

    // Listen for navigation focus to track tab bar navigation and refresh data
    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
      // Auto-refresh when screen comes into focus
      if (getTransactionStats) {
        getTransactionStats();
      }
    });

    return () => {
      clearInterval(autoRefreshInterval);
      unsubscribe();
    };
  }, [navigation]);

  const trackScreenVisit = async () => {
    try {
      const stored = await AsyncStorage.getItem('personal_recent_actions');
      let recentActions = stored ? JSON.parse(stored) : [];
      
      const newAction = {
        id: 'stats',
        name: 'Statistics',
        icon: 'chart-pie',
        color: theme.warning,
        timestamp: Date.now()
      };
      
      recentActions = recentActions.filter(action => action.id !== 'stats');
      recentActions.unshift(newAction);
      recentActions = recentActions.slice(0, 4);
      
      await AsyncStorage.setItem('personal_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      }
  };

  // Calculate statistics from real transaction data
  useEffect(() => {
    const calculateStats = () => {
      if (!transactions || transactions.length === 0) {
        return;
      }

      // Get date range based on selected period
      const now = new Date();
      let startDate, endDate;

      switch (selectedPeriod) {
        case 'This Week':
          const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
          const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
          startDate = startOfWeek.toISOString().split('T')[0];
          endDate = endOfWeek.toISOString().split('T')[0];
          break;
        case 'This Year':
          startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
          endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
          break;
        default: // This Month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      }

      // Filter transactions for the selected period
      const periodTransactions = transactions.filter(t => {
        const transactionDate = t.date || t.createdAt?.split('T')[0];
        return transactionDate >= startDate && transactionDate <= endDate;
      });

      // Calculate overview stats
      const totalIncome = periodTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpenses = periodTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const netSavings = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
      const transactionCount = periodTransactions.length;
      
      // Calculate days in period for average daily spending
      const daysDiff = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)));
      const avgDailySpending = totalExpenses / daysDiff;

      // Calculate category breakdown
      const categoryTotals = {};
      periodTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
          const category = t.category || 'others';
          categoryTotals[category] = (categoryTotals[category] || 0) + t.amount;
        });

      const categoryBreakdown = Object.entries(categoryTotals)
        .map(([category, amount]) => ({
          name: getCategoryName(category),
          amount,
          percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
          color: getCategoryColor(category),
          icon: getCategoryIcon(category)
        }))
        .sort((a, b) => b.amount - a.amount);

      // Calculate monthly trends (last 3 months)
      const monthlyTrends = [];
      for (let i = 2; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().split('T')[0];
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const monthTransactions = transactions.filter(t => {
          const transactionDate = t.date || t.createdAt?.split('T')[0];
          return transactionDate >= monthStart && transactionDate <= monthEnd;
        });

        const monthIncome = monthTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const monthExpenses = monthTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        monthlyTrends.push({
          month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
          income: monthIncome,
          expenses: monthExpenses,
          savings: monthIncome - monthExpenses
        });
      }

      setStatsData({
        overview: {
          totalIncome,
          totalExpenses,
          netSavings,
          savingsRate,
          transactionCount,
          avgDailySpending,
        },
        monthlyTrends,
        categoryBreakdown,
        topCategories: categoryBreakdown.slice(0, 5),
      });
    };

    calculateStats();
  }, [transactions, selectedPeriod]);

  // Auto-refresh functionality
  useEffect(() => {
    // Auto-refresh every 30 seconds
    const autoRefreshInterval = setInterval(() => {
      // Refresh transactions data
      if (getTransactionStats) {
        getTransactionStats();
      }
    }, 30000);

    // Listen for navigation focus to refresh data
    const unsubscribe = navigation.addListener('focus', () => {
      if (getTransactionStats) {
        getTransactionStats();
      }
    });

    return () => {
      clearInterval(autoRefreshInterval);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [navigation, getTransactionStats]);

  const getCategoryName = (categoryId) => {
    const categoryMap = {
      food: 'Food & Dining',
      transport: 'Transportation',
      shopping: 'Shopping',
      entertainment: 'Entertainment',
      bills: 'Bills & Utilities',
      health: 'Healthcare',
      others: 'Others'
    };
    return categoryMap[categoryId] || 'Others';
  };

  const getCategoryIcon = (categoryId) => {
    const iconMap = {
      food: 'food',
      transport: 'car',
      shopping: 'shopping',
      entertainment: 'movie',
      bills: 'receipt',
      health: 'medical-bag',
      others: 'dots-horizontal'
    };
    return iconMap[categoryId] || 'dots-horizontal';
  };

  const getCategoryColor = (categoryId) => {
    const colorMap = {
      food: '#FF9800',
      transport: '#2196F3',
      shopping: '#9C27B0',
      entertainment: '#FF5722',
      bills: '#607D8B',
      health: '#4CAF50',
      others: '#795548'
    };
    return colorMap[categoryId] || '#795548';
  };

  const periods = ['This Week', 'This Month', 'This Year'];
  const views = [
    { id: 'overview', name: 'Overview', icon: 'chart-pie' },
    { id: 'trends', name: 'Trends', icon: 'trending-up' },
    { id: 'categories', name: 'Categories', icon: 'format-list-bulleted' },
  ];

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2).replace(/\\d(?=(\\d{3})+\\.)/g, '$&,')}`;
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-left" size={24} color={theme.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Statistics</Text>
      <TouchableOpacity style={styles.exportButton}>
        <Icon name="download" size={20} color={theme.primary} />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderPeriodSelector = () => (
    <Animated.View style={[styles.periodSelector, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScrollContent}>
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
      </ScrollView>
    </Animated.View>
  );

  const renderViewSelector = () => (
    <Animated.View style={[styles.viewSelector, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewScrollContent}>
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
      </ScrollView>
    </Animated.View>
  );

  const renderOverviewStats = () => (
    <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Key Metrics Cards */}
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { backgroundColor: '#E8F5E8' }]}>
          <Icon name="trending-up" size={24} color="#4CAF50" />
          <Text style={styles.metricValue}>{formatCurrency(statsData.overview.totalIncome)}</Text>
          <Text style={styles.metricLabel}>Total Income</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: '#FFF3E0' }]}>
          <Icon name="trending-down" size={24} color="#FF9800" />
          <Text style={styles.metricValue}>{formatCurrency(statsData.overview.totalExpenses)}</Text>
          <Text style={styles.metricLabel}>Total Expenses</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: '#E3F2FD' }]}>
          <Icon name="piggy-bank" size={24} color="#2196F3" />
          <Text style={styles.metricValue}>{formatCurrency(statsData.overview.netSavings)}</Text>
          <Text style={styles.metricLabel}>Net Savings</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: '#F3E5F5' }]}>
          <Icon name="percent" size={24} color="#9C27B0" />
          <Text style={styles.metricValue}>{statsData.overview.savingsRate}%</Text>
          <Text style={styles.metricLabel}>Savings Rate</Text>
        </View>
      </View>

      {/* Additional Stats */}
      <View style={styles.additionalStats}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Icon name="swap-vertical" size={20} color={theme.primary} />
            <Text style={styles.statLabel}>Transactions</Text>
            <Text style={styles.statValue}>{statsData.overview.transactionCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="calendar-today" size={20} color={theme.primary} />
            <Text style={styles.statLabel}>Daily Average</Text>
            <Text style={styles.statValue}>{formatCurrency(statsData.overview.avgDailySpending)}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const renderTrendsStats = () => (
    <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>Monthly Trends</Text>
      {statsData.monthlyTrends.map((month, index) => (
        <View key={index} style={styles.trendCard}>
          <Text style={styles.trendMonth}>{month.month}</Text>
          <View style={styles.trendBars}>
            <View style={styles.trendBarContainer}>
              <Text style={styles.trendLabel}>Income</Text>
              <View style={styles.trendBar}>
                <View 
                  style={[
                    styles.trendBarFill, 
                    { 
                      width: `${(month.income / 3500) * 100}%`,
                      backgroundColor: '#4CAF50'
                    }
                  ]} 
                />
              </View>
              <Text style={styles.trendValue}>{formatCurrency(month.income)}</Text>
            </View>
            <View style={styles.trendBarContainer}>
              <Text style={styles.trendLabel}>Expenses</Text>
              <View style={styles.trendBar}>
                <View 
                  style={[
                    styles.trendBarFill, 
                    { 
                      width: `${(month.expenses / 2000) * 100}%`,
                      backgroundColor: '#FF9800'
                    }
                  ]} 
                />
              </View>
              <Text style={styles.trendValue}>{formatCurrency(month.expenses)}</Text>
            </View>
            <View style={styles.trendBarContainer}>
              <Text style={styles.trendLabel}>Savings</Text>
              <View style={styles.trendBar}>
                <View 
                  style={[
                    styles.trendBarFill, 
                    { 
                      width: `${(month.savings / 1500) * 100}%`,
                      backgroundColor: '#2196F3'
                    }
                  ]} 
                />
              </View>
              <Text style={styles.trendValue}>{formatCurrency(month.savings)}</Text>
            </View>
          </View>
        </View>
      ))}
    </Animated.View>
  );

  const renderCategoryStats = () => (
    <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>Spending by Category</Text>
      {statsData.categoryBreakdown.map((category, index) => (
        <View key={index} style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <View style={styles.categoryInfo}>
              <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                <Icon name={category.icon} size={20} color={category.color} />
              </View>
              <Text style={styles.categoryName}>{category.name}</Text>
            </View>
            <View style={styles.categoryStats}>
              <Text style={styles.categoryAmount}>{formatCurrency(category.amount)}</Text>
              <Text style={[styles.categoryPercentage, { color: category.color }]}>
                {category.percentage}%
              </Text>
            </View>
          </View>
          <View style={styles.categoryProgressContainer}>
            <View style={styles.categoryProgressBackground}>
              <Animated.View 
                style={[
                  styles.categoryProgressFill, 
                  { 
                    width: `${category.percentage}%`,
                    backgroundColor: category.color
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      ))}
    </Animated.View>
  );



  const renderContent = () => {
    switch (selectedView) {
      case 'overview':
        return renderOverviewStats();
      case 'trends':
        return renderTrendsStats();
      case 'categories':
        return renderCategoryStats();
      default:
        return renderOverviewStats();
    }
  };

  const styles = createStyles(theme);

  return (
    <UserTypeGuard requiredUserType="personal" navigation={navigation}>
      <StatusBar backgroundColor={theme.background} barStyle={theme.statusBarStyle} />
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
  exportButton: {
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

  // Period Selector Styles
  periodSelector: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  periodScrollContent: {
    gap: 10,
  },
  periodButton: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  periodButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.text,
  },
  periodButtonTextActive: {
    color: 'white',
  },

  // View Selector Styles
  viewSelector: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  viewScrollContent: {
    gap: 12,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
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

  // Overview Stats Styles
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: (width - 52) / 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  additionalStats: {
    backgroundColor: theme.cardBackground,
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statRow: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },

  // Trends Stats Styles
  trendCard: {
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
  trendMonth: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 12,
  },
  trendBars: {
    gap: 12,
  },
  trendBarContainer: {
    gap: 6,
  },
  trendLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  trendBar: {
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trendBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  trendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },

  // Category Stats Styles
  categoryCard: {
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
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  categoryStats: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 2,
  },
  categoryPercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryProgressContainer: {
    marginTop: 8,
  },
  categoryProgressBackground: {
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Goals Stats Styles
  goalCard: {
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
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  goalPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  goalProgressContainer: {
    marginBottom: 12,
  },
  goalProgressBackground: {
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalCurrent: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  goalTarget: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});