import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Platform,
  SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcons, Icon } from '../../constants/Icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTransactions } from '../../hooks/useTransactions';
import UserTypeGuard from '../../components/UserTypeGuard';
import GlassCard from '../../components/GlassCard';

export default function CompanyDashboardScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const { userData } = useAuth();
  const { transactions, refresh: refreshTransactions, loading: transactionsLoading } = useTransactions();
  const profileImageUri = userData?.companyLogoUri || userData?.profileImageUri;

  const [refreshing, setRefreshing] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  useEffect(() => {
    const calculateDashboardStats = () => {
      if (!transactions || transactions.length === 0) {
        setDashboardStats({
          totalBalance: 0,
          monthlyIncome: 0,
          monthlyExpenses: 0,
        });
        return;
      }

      const totalIncome = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const currentMonthTransactions = transactions.filter((t) => {
        const transactionDate = new Date(t.date || t.createdAt);
        return transactionDate >= currentMonthStart && transactionDate < currentMonthEnd;
      });

      const monthlyIncome = currentMonthTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const monthlyExpenses = currentMonthTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      setDashboardStats({
        totalBalance: totalIncome - totalExpenses,
        monthlyIncome,
        monthlyExpenses,
      });
    };

    calculateDashboardStats();
  }, [transactions]);

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
  }, [navigation, refreshTransactions, fadeAnim, slideAnim, cardScale]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshTransactions();
      setTimeout(() => setRefreshing(false), 500);
    } catch (error) {
      setRefreshing(false);
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
      travel: 'airplane',
      sales: 'cash',
      finance: 'calculator',
      general: 'briefcase',
      other: 'help-circle'
    };
    return iconMap[category?.toLowerCase()] || 'help-circle';
  };

  const recentTransactions = [...(transactions || [])]
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
    .slice(0, 5)
    .map((transaction) => ({
      ...transaction,
      icon: getCategoryIcon(transaction.category),
    }));

  if (isLoading || !theme) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  const renderOverviewCard = () => (
    <Animated.View style={[styles.overviewContainer, { opacity: fadeAnim, transform: [{ scale: cardScale }] }]}>
      <GlassCard
        style={styles.overviewCard}
        borderRadius={28}
        padding={24}
      >
        <View style={styles.overviewHeader}>
          <Text style={[styles.overviewTitle, { color: 'rgba(255,255,255,0.9)' }]}>Company Balance</Text>
        </View>
        <Text style={[styles.balanceAmount, { color: 'white' }]}>{formatCurrency(dashboardStats.totalBalance)}</Text>

        <View style={styles.incomeExpenseRow}>
          <View style={styles.incomeExpenseItem}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(76, 175, 80, 0.25)' }]}>
              <AppIcons.Income size={22} color="#4CAF50" />
            </View>
            <View>
              <Text style={[styles.incomeExpenseLabel, { color: 'rgba(255,255,255,0.7)' }]}>Revenue</Text>
              <Text style={styles.incomeAmount}>{formatCurrency(dashboardStats.monthlyIncome)}</Text>
            </View>
          </View>
          <View style={styles.incomeExpenseItem}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 82, 82, 0.25)' }]}>
              <AppIcons.Expense size={22} color="#FF5252" />
            </View>
            <View>
              <Text style={[styles.incomeExpenseLabel, { color: 'rgba(255,255,255,0.7)' }]}>Expenses</Text>
              <Text style={styles.expenseAmount}>{formatCurrency(dashboardStats.monthlyExpenses)}</Text>
            </View>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderTransactionItem = (transaction) => (
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
      <View
        style={[
          styles.transactionIcon,
          { backgroundColor: transaction.type === 'income' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)' }
        ]}
      >
        <Icon
          name={transaction.icon}
          size={20}
          color={transaction.type === 'income' ? '#4CAF50' : '#FF9800'}
        />
      </View>

      <View style={styles.transactionDetails}>
        <Text style={styles.transactionDescription}>{transaction.description || transaction.note || 'Transaction'}</Text>
        <Text style={styles.transactionCategory}>
          {transaction.category || 'general'} • {transaction.date || transaction.createdAt}
        </Text>
      </View>

      <Text
        style={[
          styles.transactionAmount,
          { color: transaction.type === 'income' ? '#4CAF50' : '#FF5252' }
        ]}
      >
        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
      </Text>
    </Animated.View>
  );

  return (
    <UserTypeGuard requiredUserType="company" navigation={navigation}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

        <LinearGradient
          colors={[theme.primary, theme.primaryLight]}
          style={styles.background}
        />

        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <View>
              <Text style={styles.greeting}>
                {getGreeting()}, {userData?.companyName || 'Company'}!
              </Text>
              <Text style={styles.userName}>Welcome back</Text>
            </View>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={handleProfilePress}
            >
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.profileImage} />
              ) : (
                <AppIcons.Profile size={40} color="rgba(255,255,255,0.9)" />
              )}
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
            {renderOverviewCard()}

            <TouchableOpacity style={styles.aiChatButton} onPress={() => navigation.navigate('AIChat')}>
              <View style={styles.aiChatIcon}>
                <Icon name="robot-excited-outline" size={18} color="white" />
              </View>
              <View style={styles.aiChatTextWrap}>
                <Text style={styles.aiChatTitle}>Ask Financial AI</Text>
                <Text style={styles.aiChatSubtitle}>Review company spending and cash flow</Text>
              </View>
              <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>

            <Animated.View style={[styles.sectionContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Transactions</Text>
                <TouchableOpacity onPress={() => navigation.navigate('CompanyTransactions')}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>

              <GlassCard
                style={styles.transactionsList}
                borderRadius={24}
                padding={5}
              >
                {transactionsLoading ? (
                  <ActivityIndicator size="small" color={theme.isDarkMode ? 'white' : '#333'} style={{ marginVertical: 20 }} />
                ) : recentTransactions.length > 0 ? (
                  recentTransactions.map((transaction) => renderTransactionItem(transaction))
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
    </UserTypeGuard>
  );
}

const styles = StyleSheet.create({
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
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
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
  overviewCard: {},
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  overviewTitle: {
    fontSize: 16,
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
