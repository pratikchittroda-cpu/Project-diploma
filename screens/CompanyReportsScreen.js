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
  SafeAreaView,
  RefreshControl,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import UserTypeGuard from '../components/UserTypeGuard';

const { width } = Dimensions.get('window');

export default function CompanyReportsScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const { userData } = useAuth();
  const { transactions, loading: transactionsLoading, refresh: refreshTransactions } = useTransactions();

  const [selectedPeriod, setSelectedPeriod] = useState('Monthly');
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState({
    overview: {
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0,
      profitMargin: 0,
      growth: 0,
    },
    departments: [],
    monthlyTrends: {
      labels: [],
      datasets: [{ data: [0] }]
    },
    topExpenses: []
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

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
    ]).start();

    trackScreenVisit();

    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
      refreshTransactions();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!transactionsLoading && transactions) {
      calculateReportData();
    }
  }, [transactions, selectedPeriod, transactionsLoading]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshTransactions();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

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
      console.error('Error tracking screen visit:', error);
    }
  };

  const calculateReportData = () => {
    if (!transactions || transactions.length === 0) return;

    try {
      const now = new Date();
      let startDate, endDate;

      switch (selectedPeriod) {
        case 'Weekly':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startDate = startOfWeek;
          endDate = new Date(now);
          break;
        case 'Yearly':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default: // Monthly
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      const periodTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date || t.createdAt);
        return transactionDate >= startDate && transactionDate <= endDate;
      });

      // Overview Stats
      const totalRevenue = periodTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenses = periodTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // Department Analysis
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
          const budget = spent * 1.3; // Simulated budget for now
          return {
            name,
            budget,
            spent,
            percentage: Math.round((spent / budget) * 100),
            color: colors[index % colors.length]
          };
        })
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 5);

      // Monthly Trends (Revenue vs Expenses)
      const trendLabels = [];
      const revenueData = [];
      const expenseData = [];

      if (selectedPeriod === 'Weekly') {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

          const dayTrans = transactions.filter(t => {
            const tDate = new Date(t.date || t.createdAt);
            return tDate >= dayStart && tDate <= dayEnd;
          });

          const dayRev = dayTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
          const dayExp = dayTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

          trendLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
          revenueData.push(dayRev);
          expenseData.push(dayExp);
        }
      } else {
        // Monthly/Yearly - show last 6 months
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
          const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

          const mTrans = transactions.filter(t => {
            const tDate = new Date(t.date || t.createdAt);
            return tDate >= mStart && tDate <= mEnd;
          });

          const mRev = mTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
          const mExp = mTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

          trendLabels.push(d.toLocaleDateString('en-US', { month: 'short' }));
          revenueData.push(mRev);
          expenseData.push(mExp);
        }
      }

      // Top Expenses for Pie Chart
      const categoryTotals = {};
      periodTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
          const category = t.category || 'Others';
          categoryTotals[category] = (categoryTotals[category] || 0) + t.amount;
        });

      const topExpenses = Object.entries(categoryTotals)
        .map(([name, amount], index) => {
          const colors = ['#FF9800', '#2196F3', '#E91E63', '#9C27B0', '#F44336', '#4CAF50', '#607D8B'];
          return {
            name: getCategoryName(name),
            amount,
            population: amount,
            color: colors[index % colors.length],
            legendFontColor: 'white',
            legendFontSize: 12
          };
        })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      setReportData({
        overview: {
          totalRevenue,
          totalExpenses,
          netProfit,
          profitMargin,
          growth: 12.5, // Placeholder
        },
        departments,
        monthlyTrends: {
          labels: trendLabels,
          datasets: [
            {
              data: revenueData.length > 0 ? revenueData : [0],
              color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`, // Green for revenue
              strokeWidth: 2
            },
            {
              data: expenseData.length > 0 ? expenseData : [0],
              color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`, // Red for expenses
              strokeWidth: 2
            }
          ],
          legend: ["Revenue", "Expenses"]
        },
        topExpenses
      });

    } catch (error) {
      console.error('Error calculating report data:', error);
    }
  };

  const getCategoryName = (categoryId) => {
    const categoryMap = {
      'office-supplies': 'Office',
      'software': 'Software',
      'marketing': 'Marketing',
      'utilities': 'Utilities',
      'salaries': 'Salaries',
      'rent': 'Rent',
      'meals': 'Meals',
      'transport': 'Transport',
      'travel': 'Travel',
      'equipment': 'Equipment',
      'professional-services': 'Services',
      'insurance': 'Insurance',
      'other': 'Others'
    };
    return categoryMap[categoryId] || categoryId;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const styles = createStyles(theme);

  return (
    <UserTypeGuard requiredUserType="company" navigation={navigation}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
        <LinearGradient
          colors={[theme.primary, theme.primaryLight]}
          style={styles.background}
        />

        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
              <Icon name="arrow-left" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Company Reports</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.iconButton}>
              <Icon name="refresh" size={24} color="white" />
            </TouchableOpacity>
          </Animated.View>

          {/* Period Selector */}
          <View style={styles.periodSelectorContainer}>
            <View style={styles.periodSelector}>
              {['Weekly', 'Monthly', 'Yearly'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodButton, selectedPeriod === p && styles.periodButtonActive]}
                  onPress={() => setSelectedPeriod(p)}
                >
                  <Text style={[styles.periodText, selectedPeriod === p && styles.periodTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {transactionsLoading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.loadingText}>Loading reports...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="white" />
              }
            >
              <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

                {/* Overview Cards */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
                      <Icon name="trending-up" size={24} color="#4CAF50" />
                    </View>
                    <Text style={styles.metricLabel}>Revenue</Text>
                    <Text style={styles.metricValue}>{formatCurrency(reportData.overview.totalRevenue)}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(244, 67, 54, 0.2)' }]}>
                      <Icon name="trending-down" size={24} color="#F44336" />
                    </View>
                    <Text style={styles.metricLabel}>Expenses</Text>
                    <Text style={styles.metricValue}>{formatCurrency(reportData.overview.totalExpenses)}</Text>
                  </View>
                </View>

                <View style={styles.bigCard}>
                  <View style={styles.rowBetween}>
                    <View>
                      <Text style={styles.metricLabel}>Net Profit</Text>
                      <Text style={styles.bigMetricValue}>{formatCurrency(reportData.overview.netProfit)}</Text>
                    </View>
                    <View style={styles.profitBadge}>
                      <Icon name="chart-line" size={16} color="white" />
                      <Text style={styles.profitText}>{reportData.overview.profitMargin.toFixed(1)}% Margin</Text>
                    </View>
                  </View>
                </View>

                {/* Revenue vs Expenses Chart */}
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Financial Performance</Text>
                  {reportData.monthlyTrends.datasets[0].data.length > 0 ? (
                    <LineChart
                      data={reportData.monthlyTrends}
                      width={width - 64}
                      height={220}
                      yAxisLabel={"\u20B9"}
                      chartConfig={{
                        backgroundColor: 'transparent',
                        backgroundGradientFrom: '#ffffff',
                        backgroundGradientFromOpacity: 0,
                        backgroundGradientTo: '#ffffff',
                        backgroundGradientToOpacity: 0,
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        style: { borderRadius: 16 },
                        propsForDots: { r: '4', strokeWidth: '2', stroke: '#fff' }
                      }}
                      bezier
                      style={styles.chart}
                    />
                  ) : (
                    <Text style={styles.noDataText}>No trend data available</Text>
                  )}
                </View>

                {/* Expense Breakdown Pie Chart */}
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Expense Breakdown</Text>
                  {reportData.topExpenses.length > 0 ? (
                    <PieChart
                      data={reportData.topExpenses}
                      width={width - 64}
                      height={220}
                      chartConfig={{
                        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                      }}
                      accessor={"population"}
                      backgroundColor={"transparent"}
                      paddingLeft={"15"}
                      absolute
                    />
                  ) : (
                    <View style={styles.noDataContainer}>
                      <Text style={styles.noDataText}>No expense data for this period</Text>
                    </View>
                  )}
                </View>

                {/* Department Analysis */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Department Analysis</Text>
                  {reportData.departments.map((dept, index) => (
                    <View key={index} style={styles.departmentCard}>
                      <View style={styles.departmentHeader}>
                        <View style={styles.departmentInfo}>
                          <View style={[styles.departmentIcon, { backgroundColor: `${dept.color}20` }]}>
                            <Icon name="office-building" size={20} color={dept.color} />
                          </View>
                          <Text style={styles.departmentName}>{dept.name}</Text>
                        </View>
                        <Text style={[styles.departmentPercentage, { color: dept.color }]}>
                          {dept.percentage}%
                        </Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${Math.min(100, dept.percentage)}%`, backgroundColor: dept.color }
                          ]}
                        />
                      </View>
                      <View style={styles.departmentFooter}>
                        <Text style={styles.departmentValue}>{formatCurrency(dept.spent)}</Text>
                        <Text style={styles.departmentLabel}>of {formatCurrency(dept.budget)}</Text>
                      </View>
                    </View>
                  ))}
                </View>

              </Animated.View>
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </UserTypeGuard>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.primary,
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
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodSelectorContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 4,
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
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  periodTextActive: {
    color: theme.primary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bigCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 4,
  },
  metricValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  bigMetricValue: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  profitText: {
    color: 'white',
    fontWeight: '700',
  },
  chartCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  chartTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  departmentCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
  departmentIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  departmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  departmentPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  departmentFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  departmentValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 4,
  },
  departmentLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
});