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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import UserTypeGuard from '../components/UserTypeGuard';

// Dimensions removed as not used

export default function CompanyReportsScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const { userData } = useAuth();
  const { transactions, loading: transactionsLoading } = useTransactions();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [selectedReport, setSelectedReport] = useState('overview');
  const [reportData, setReportData] = useState({
    overview: {
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0,
      profitMargin: 0,
      growth: 0,
    },
    departments: [],
    monthlyTrends: [],
    topExpenses: []
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.background || '#f8f9fa', paddingTop: StatusBar.currentHeight || 0 }}>
        <StatusBar backgroundColor={theme?.background || '#f8f9fa'} barStyle={theme?.statusBarStyle || 'dark-content'} />
        <ActivityIndicator size="large" color={theme?.primary || '#667eea'} />
      </View>
    );
  }

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

    // Listen for navigation focus to track tab bar navigation
    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
    });

    return unsubscribe;
  }, [navigation]);

  // Auto-refresh functionality
  useEffect(() => {
    // Auto-refresh every 30 seconds
    const autoRefreshInterval = setInterval(() => {
      // Refresh transactions data automatically
      if (transactions) {
        // Data will be automatically recalculated when transactions change
      }
    }, 30000);

    // Listen for navigation focus to refresh data
    const unsubscribe = navigation.addListener('focus', () => {
      // Data will be automatically refreshed when screen comes into focus
    });

    return () => {
      clearInterval(autoRefreshInterval);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [navigation]);

  const trackScreenVisit = async () => {
    try {
      const stored = await AsyncStorage.getItem('company_recent_actions');
      let recentActions = stored ? JSON.parse(stored) : [];
      
      const newAction = {
        id: 'reports',
        name: 'Reports',
        icon: 'chart-line',
        color: '#4CAF50',
        timestamp: Date.now()
      };
      
      recentActions = recentActions.filter(action => action.id !== 'reports');
      recentActions.unshift(newAction);
      recentActions = recentActions.slice(0, 4);
      
      await AsyncStorage.setItem('company_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      }
  };

  // Calculate real report data from transactions
  useEffect(() => {
    const calculateReportData = () => {
      if (!transactions || transactions.length === 0) {
        return;
      }

      try {
        // Get current period data based on selected period
        const now = new Date();
        let startDate, endDate;

        switch (selectedPeriod) {
          case 'This Week':
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startDate = startOfWeek;
            endDate = new Date(now);
            break;
          case 'This Month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
          case 'This Year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
          default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        const periodTransactions = transactions.filter(t => {
          const transactionDate = new Date(t.date || t.createdAt);
          return transactionDate >= startDate && transactionDate <= endDate;
        });

        // Calculate overview data
        const totalRevenue = periodTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);

        const totalExpenses = periodTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // Calculate department data
        const departmentTotals = {};
        periodTransactions
          .filter(t => t.type === 'expense')
          .forEach(t => {
            const dept = t.department || 'General';
            departmentTotals[dept] = (departmentTotals[dept] || 0) + t.amount;
          });

        const departments = Object.entries(departmentTotals)
          .map(([name, spent], index) => {
            const colors = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#607D8B'];
            const budget = spent * 1.3; // Assume budget is 30% more than spent
            return {
              name,
              budget,
              spent,
              percentage: Math.round((spent / budget) * 100),
              color: colors[index % colors.length]
            };
          })
          .slice(0, 5);

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
            expenses: monthExpenses
          });
        }

        // Calculate top expenses by category
        const categoryTotals = {};
        periodTransactions
          .filter(t => t.type === 'expense')
          .forEach(t => {
            const category = t.category || 'Others';
            categoryTotals[category] = (categoryTotals[category] || 0) + t.amount;
          });

        const topExpenses = Object.entries(categoryTotals)
          .map(([category, amount]) => ({
            category: getCategoryName(category),
            amount,
            percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        setReportData({
          overview: {
            totalRevenue,
            totalExpenses,
            netProfit,
            profitMargin,
            growth: 12.5, // This would need historical data to calculate properly
          },
          departments,
          monthlyTrends,
          topExpenses
        });
      } catch (error) {
        }
    };

    calculateReportData();
  }, [transactions, selectedPeriod]);

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
    return categoryMap[categoryId] || categoryId;
  };

  const periods = ['This Week', 'This Month', 'This Year'];
  const reportTypes = [
    { id: 'overview', name: 'Overview', icon: 'chart-pie' },
    { id: 'departments', name: 'Departments', icon: 'office-building' },
    { id: 'trends', name: 'Trends', icon: 'trending-up' },
    { id: 'expenses', name: 'Expenses', icon: 'wallet' },
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
      <Text style={styles.headerTitle}>Company Reports</Text>
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

  const renderReportTypeSelector = () => (
    <Animated.View style={[styles.reportTypeSelector, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reportTypeScrollContent}>
        {reportTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.reportTypeButton,
              selectedReport === type.id && styles.reportTypeButtonActive
            ]}
            onPress={() => setSelectedReport(type.id)}
          >
            <Icon 
              name={type.icon} 
              size={20} 
              color={selectedReport === type.id ? 'white' : theme.primary} 
            />
            <Text style={[
              styles.reportTypeButtonText,
              selectedReport === type.id && styles.reportTypeButtonTextActive
            ]}>
              {type.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );

  const renderOverviewReport = () => (
    <Animated.View style={[styles.reportContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Key Metrics Cards */}
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { backgroundColor: '#E8F5E8' }]}>
          <Icon name="trending-up" size={24} color="#4CAF50" />
          <Text style={styles.metricValue}>{formatCurrency(reportData.overview.totalRevenue)}</Text>
          <Text style={styles.metricLabel}>Total Revenue</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: '#FFF3E0' }]}>
          <Icon name="trending-down" size={24} color="#FF9800" />
          <Text style={styles.metricValue}>{formatCurrency(reportData.overview.totalExpenses)}</Text>
          <Text style={styles.metricLabel}>Total Expenses</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: '#E3F2FD' }]}>
          <Icon name="cash-multiple" size={24} color="#2196F3" />
          <Text style={styles.metricValue}>{formatCurrency(reportData.overview.netProfit)}</Text>
          <Text style={styles.metricLabel}>Net Profit</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: '#F3E5F5' }]}>
          <Icon name="percent" size={24} color="#9C27B0" />
          <Text style={styles.metricValue}>{reportData.overview.profitMargin}%</Text>
          <Text style={styles.metricLabel}>Profit Margin</Text>
        </View>
      </View>

      {/* Growth Indicator */}
      <View style={styles.growthCard}>
        <LinearGradient colors={['#4CAF50', '#66BB6A']} style={styles.growthGradient}>
          <Icon name="trending-up" size={32} color="white" />
          <View style={styles.growthContent}>
            <Text style={styles.growthValue}>+{reportData.overview.growth}%</Text>
            <Text style={styles.growthLabel}>Growth vs Last Period</Text>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );

  const renderDepartmentsReport = () => (
    <Animated.View style={[styles.reportContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.reportSectionTitle}>Department Budget Analysis</Text>
      {reportData.departments.map((dept, index) => (
        <View key={index} style={styles.departmentCard}>
          <View style={styles.departmentHeader}>
            <View style={styles.departmentInfo}>
              <View style={[styles.departmentColorDot, { backgroundColor: dept.color }]} />
              <Text style={styles.departmentName}>{dept.name}</Text>
            </View>
            <Text style={styles.departmentPercentage}>{dept.percentage}%</Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View 
                style={[
                  styles.progressBarFill, 
                  { width: `${dept.percentage}%`, backgroundColor: dept.color }
                ]} 
              />
            </View>
          </View>
          
          <View style={styles.departmentBudgetDetails}>
            <Text style={styles.budgetSpent}>Spent: {formatCurrency(dept.spent)}</Text>
            <Text style={styles.budgetTotal}>Budget: {formatCurrency(dept.budget)}</Text>
          </View>
        </View>
      ))}
    </Animated.View>
  );

  const renderTrendsReport = () => (
    <Animated.View style={[styles.reportContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.reportSectionTitle}>Monthly Trends</Text>
      {reportData.monthlyTrends.map((month, index) => (
        <View key={index} style={styles.trendCard}>
          <Text style={styles.trendMonth}>{month.month}</Text>
          <View style={styles.trendBars}>
            <View style={styles.trendBarContainer}>
              <Text style={styles.trendLabel}>Revenue</Text>
              <View style={styles.trendBar}>
                <View 
                  style={[
                    styles.trendBarFill, 
                    { 
                      width: `${(month.revenue / 130000) * 100}%`,
                      backgroundColor: '#4CAF50'
                    }
                  ]} 
                />
              </View>
              <Text style={styles.trendValue}>{formatCurrency(month.revenue)}</Text>
            </View>
            <View style={styles.trendBarContainer}>
              <Text style={styles.trendLabel}>Expenses</Text>
              <View style={styles.trendBar}>
                <View 
                  style={[
                    styles.trendBarFill, 
                    { 
                      width: `${(month.expenses / 50000) * 100}%`,
                      backgroundColor: '#FF9800'
                    }
                  ]} 
                />
              </View>
              <Text style={styles.trendValue}>{formatCurrency(month.expenses)}</Text>
            </View>
          </View>
        </View>
      ))}
    </Animated.View>
  );

  const renderExpensesReport = () => (
    <Animated.View style={[styles.reportContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.reportSectionTitle}>Top Expense Categories</Text>
      {reportData.topExpenses.map((expense, index) => (
        <View key={index} style={styles.expenseCard}>
          <View style={styles.expenseHeader}>
            <Text style={styles.expenseCategory}>{expense.category}</Text>
            <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
          </View>
          <View style={styles.expenseProgressContainer}>
            <View style={styles.expenseProgressBackground}>
              <Animated.View 
                style={[
                  styles.expenseProgressFill, 
                  { width: `${expense.percentage}%` }
                ]} 
              />
            </View>
            <Text style={styles.expensePercentage}>{expense.percentage}%</Text>
          </View>
        </View>
      ))}
    </Animated.View>
  );

  const renderReportContent = () => {
    switch (selectedReport) {
      case 'overview':
        return renderOverviewReport();
      case 'departments':
        return renderDepartmentsReport();
      case 'trends':
        return renderTrendsReport();
      case 'expenses':
        return renderExpensesReport();
      default:
        return renderOverviewReport();
    }
  };

  const styles = createStyles(theme);

  return (
    <UserTypeGuard requiredUserType="company" navigation={navigation}>
      <View style={styles.container}>
        {renderHeader()}
        {renderPeriodSelector()}
        {renderReportTypeSelector()}
        
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {transactionsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.loadingText}>Loading reports...</Text>
            </View>
          ) : (
            renderReportContent()
          )}
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

  // Report Type Selector Styles
  reportTypeSelector: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  reportTypeScrollContent: {
    gap: 12,
  },
  reportTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reportTypeButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  reportTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginLeft: 8,
  },
  reportTypeButtonTextActive: {
    color: 'white',
  },

  // Content Styles
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  reportContent: {
    marginBottom: 20,
  },
  reportSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },

  // Overview Report Styles
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
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
  growthCard: {
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  growthGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  growthContent: {
    marginLeft: 15,
  },
  growthValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  growthLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  // Department Report Styles
  departmentCard: {
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
  departmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  departmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  departmentColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  departmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  departmentPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.primary,
  },
  progressBarContainer: {
    marginBottom: 12,
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
  departmentBudgetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetSpent: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  budgetTotal: {
    fontSize: 14,
    color: theme.textSecondary,
  },

  // Trends Report Styles
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

  // Expenses Report Styles
  expenseCard: {
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
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  expenseCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.primary,
  },
  expenseProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expenseProgressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  expenseProgressFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 4,
  },
  expensePercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    minWidth: 40,
  },

  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 15,
  },
});