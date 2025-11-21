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
  Platform,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';

const { width } = Dimensions.get('window');

export default function StatsScreen({ navigation }) {
  const { theme, isLoading: themeLoading } = useTheme();
  const { userData, loading: authLoading } = useAuth();
  const { transactions, loading: transactionsLoading, getTransactionStats } = useTransactions();

  const [selectedPeriod, setSelectedPeriod] = useState('Monthly');
  const [refreshing, setRefreshing] = useState(false);
  const [statsData, setStatsData] = useState({
    overview: {
      totalIncome: 0,
      totalExpenses: 0,
      netSavings: 0,
      savingsRate: 0,
      transactionCount: 0,
      avgDailySpending: 0,
    },
    monthlyTrends: {
      labels: [],
      datasets: [{ data: [0] }] // Initialize with 0 to prevent chart crash
    },
    categoryBreakdown: [],
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Initial Load Animation
  useEffect(() => {
    const animation = Animated.parallel([
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
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, []);

  // Track Visit
  useEffect(() => {
    trackScreenVisit();
  }, []);

  // Data Calculation
  useEffect(() => {
    if (!transactionsLoading && transactions) {
      calculateStats();
    }
  }, [transactions, selectedPeriod, transactionsLoading]);

  // User Type Check
  useEffect(() => {
    if (!authLoading && userData) {
      if (userData.userType !== 'personal') {
        Alert.alert(
          'Access Restricted',
          'This feature is for Personal accounts only.',
          [{ text: 'Go Back', onPress: () => navigation.goBack() }]
        );
      }
    }
  }, [userData, authLoading]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (getTransactionStats) {
        await getTransactionStats();
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const trackScreenVisit = async () => {
    try {
      const stored = await AsyncStorage.getItem('personal_recent_actions');
      let recentActions = stored ? JSON.parse(stored) : [];

      const newAction = {
        id: 'stats',
        name: 'Statistics',
        icon: 'chart-pie',
        color: '#667eea',
        timestamp: Date.now()
      };

      recentActions = recentActions.filter(action => action.id !== 'stats');
      recentActions.unshift(newAction);
      recentActions = recentActions.slice(0, 4);

      await AsyncStorage.setItem('personal_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      console.error('Error tracking screen visit:', error);
    }
  };

  const calculateStats = () => {
    try {
      if (!transactions) return;

      const now = new Date();
      let startDate, endDate;

      // Date Range Logic
      switch (selectedPeriod) {
        case 'Weekly':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startDate = startOfWeek.toISOString().split('T')[0];
          endDate = new Date().toISOString().split('T')[0];
          break;
        case 'Yearly':
          startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
          endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
          break;
        default: // Monthly
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      }

      const periodTransactions = transactions.filter(t => {
        const tDate = t.date || t.createdAt?.split('T')[0];
        return tDate >= startDate && tDate <= endDate;
      });

      // Overview Stats
      const income = periodTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expenses = periodTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const net = income - expenses;
      const rate = income > 0 ? (net / income) * 100 : 0;

      // Category Breakdown
      const categoryTotals = {};
      periodTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
          const cat = t.category || 'others';
          categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
        });

      const categoryBreakdown = Object.entries(categoryTotals)
        .map(([name, amount]) => ({
          name: getCategoryName(name),
          amount,
          population: amount, // for PieChart
          color: getCategoryColor(name),
          legendFontColor: 'white',
          legendFontSize: 12
        }))
        .sort((a, b) => b.amount - a.amount);

      // Monthly Trends (Last 6 months)
      const trendLabels = [];
      const trendData = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];

        const mTrans = transactions.filter(t => {
          const tDate = t.date || t.createdAt?.split('T')[0];
          return tDate >= mStart && tDate <= mEnd;
        });

        const mExp = mTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

        trendLabels.push(d.toLocaleDateString('en-US', { month: 'short' }));
        trendData.push(mExp || 0); // Ensure number
      }

      setStatsData({
        overview: {
          totalIncome: income || 0,
          totalExpenses: expenses || 0,
          netSavings: net || 0,
          savingsRate: isNaN(rate) ? 0 : rate,
          transactionCount: periodTransactions.length,
          avgDailySpending: expenses / Math.max(1, new Date().getDate()),
        },
        monthlyTrends: {
          labels: trendLabels,
          datasets: [{ data: trendData.length > 0 ? trendData : [0] }]
        },
        categoryBreakdown
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getCategoryName = (id) => {
    const map = {
      food: 'Food',
      transport: 'Transport',
      shopping: 'Shopping',
      entertainment: 'Fun',
      bills: 'Bills',
      health: 'Health',
      others: 'Others'
    };
    return map[id] || 'Others';
  };

  const getCategoryColor = (id) => {
    const map = {
      food: '#FF9800',
      transport: '#2196F3',
      shopping: '#E91E63',
      entertainment: '#9C27B0',
      bills: '#F44336',
      health: '#4CAF50',
      others: '#607D8B'
    };
    return map[id] || '#607D8B';
  };

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
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Icon name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Statistics</Text>
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
          <View style={styles.contentLoading}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.loadingText}>Loading stats...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="white" />
            }
          >
            {/* Overview Cards */}
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              <View style={styles.grid}>
                <View style={styles.card}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
                    <Icon name="arrow-down-circle" size={24} color="#4CAF50" />
                  </View>
                  <Text style={styles.cardLabel}>Income</Text>
                  <Text style={styles.cardValue}>{formatCurrency(statsData.overview.totalIncome)}</Text>
                </View>
                <View style={styles.card}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 152, 0, 0.2)' }]}>
                    <Icon name="arrow-up-circle" size={24} color="#FF9800" />
                  </View>
                  <Text style={styles.cardLabel}>Expenses</Text>
                  <Text style={styles.cardValue}>{formatCurrency(statsData.overview.totalExpenses)}</Text>
                </View>
              </View>

              <View style={styles.bigCard}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.cardLabel}>Net Savings</Text>
                    <Text style={styles.bigCardValue}>{formatCurrency(statsData.overview.netSavings)}</Text>
                  </View>
                  <View style={styles.savingsBadge}>
                    <Icon name="piggy-bank" size={16} color="white" />
                    <Text style={styles.savingsText}>{statsData.overview.savingsRate.toFixed(1)}%</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Charts Section */}
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

              {/* Expense Trend */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Expense Trend</Text>
                {statsData.monthlyTrends.datasets[0].data.length > 0 ? (
                  <LineChart
                    data={statsData.monthlyTrends}
                    width={width - 64} // Card padding
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
                      propsForDots: {
                        r: '6',
                        strokeWidth: '2',
                        stroke: '#fff'
                      }
                    }}
                    bezier
                    style={styles.chart}
                  />
                ) : (
                  <Text style={styles.noDataText}>No trend data available</Text>
                )}
              </View>

              {/* Category Breakdown */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Spending by Category</Text>
                {statsData.categoryBreakdown.length > 0 ? (
                  <PieChart
                    data={statsData.categoryBreakdown}
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

            </Animated.View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
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
    backgroundColor: '#667eea',
  },
  contentLoading: {
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
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  card: {
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
  cardLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 4,
  },
  cardValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  bigCardValue: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  savingsText: {
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
});
