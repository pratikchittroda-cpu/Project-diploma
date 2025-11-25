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
  TextInput,
  Alert,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';

export default function TransactionsScreen({ navigation }) {
  const { theme } = useTheme();
  const { userData } = useAuth();
  const { transactions, loading: transactionsLoading, deleteTransaction, refresh } = useTransactions();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [refreshing, setRefreshing] = useState(false);

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

    // Listen for navigation focus to auto-refresh
    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
      autoRefresh();
    });

    return unsubscribe;
  }, [navigation]);

  const trackScreenVisit = async () => {
    try {
      const stored = await AsyncStorage.getItem('personal_recent_actions');
      let recentActions = stored ? JSON.parse(stored) : [];

      const newAction = {
        id: 'transactions',
        name: 'Transactions',
        icon: 'swap-vertical',
        color: theme.primary,
        timestamp: Date.now()
      };

      recentActions = recentActions.filter(action => action.id !== 'transactions');
      recentActions.unshift(newAction);
      recentActions = recentActions.slice(0, 4);

      await AsyncStorage.setItem('personal_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      console.error('Error tracking screen visit:', error);
    }
  };

  // Calculate transaction summary
  const transactionSummary = React.useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome,
      totalExpenses,
      netAmount: totalIncome - totalExpenses,
    };
  }, [transactions]);

  // Helper functions for category icons and colors
  const getCategoryIcon = (category) => {
    const iconMap = {
      food: 'food',
      transport: 'car',
      shopping: 'shopping',
      entertainment: 'movie',
      health: 'medical-bag',
      bills: 'receipt',
      salary: 'cash-multiple',
      freelance: 'laptop',
      business: 'briefcase',
      others: 'help-circle'
    };
    return iconMap[category] || 'help-circle';
  };

  const getCategoryColor = (category, type) => {
    if (type === 'income') return theme.categoryColors?.income || '#4CAF50';
    return theme.categoryColors?.[category] || theme.primary;
  };

  // Filter transactions
  const filteredTransactions = React.useMemo(() => {
    let filtered = transactions;

    // Filter by type
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(t => t.type === selectedFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
      );
    }

    // Add display properties
    return filtered.map(transaction => ({
      ...transaction,
      icon: getCategoryIcon(transaction.category),
      color: getCategoryColor(transaction.category, transaction.type)
    }));
  }, [transactions, selectedFilter, searchQuery, theme]);

  const handleDeleteTransaction = async (transactionId) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteTransaction(transactionId);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete transaction');
            }
          }
        }
      ]
    );
  };

  const autoRefresh = async () => {
    try {
      await refresh();
    } catch (error) {
      console.error('Auto refresh error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      setTimeout(() => {
        setRefreshing(false);
      }, 500);
    } catch (error) {
      setRefreshing(false);
    }
  };

  const periods = ['This Week', 'This Month', 'This Year'];
  const filters = [
    { id: 'all', name: 'All', icon: 'format-list-bulleted' },
    { id: 'income', name: 'Income', icon: 'trending-up' },
    { id: 'expense', name: 'Expenses', icon: 'trending-down' },
  ];

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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Transactions</Text>
            <Text style={styles.headerSubtitle}>{userData?.fullName || 'User'}'s Activity</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddTransaction')}
          >
            <Icon name="plus" size={20} color="white" />
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
          {/* Summary Card */}
          <Animated.View style={[styles.summaryCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.summaryTitle}>This Month Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Icon name="trending-up" size={20} color="#4CAF50" />
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={styles.summaryValue}>{formatCurrency(transactionSummary.totalIncome)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Icon name="trending-down" size={20} color="#FF5252" />
                <Text style={styles.summaryLabel}>Expenses</Text>
                <Text style={styles.summaryValue}>{formatCurrency(transactionSummary.totalExpenses)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Icon name="wallet" size={20} color="#2196F3" />
                <Text style={styles.summaryLabel}>Net</Text>
                <Text style={styles.summaryValue}>{formatCurrency(transactionSummary.netAmount)}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Period Selector */}
          <Animated.View style={[styles.periodSelector, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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
          </Animated.View>

          {/* Search Bar */}
          <Animated.View style={[styles.searchContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Icon name="magnify" size={20} color="rgba(255,255,255,0.7)" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search transactions..."
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Icon name="close" size={16} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Filter Tabs */}
          <Animated.View style={[styles.filterTabs, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterTab,
                  selectedFilter === filter.id && styles.filterTabActive
                ]}
                onPress={() => setSelectedFilter(filter.id)}
              >
                <Icon
                  name={filter.icon}
                  size={16}
                  color={selectedFilter === filter.id ? 'white' : 'rgba(255,255,255,0.7)'}
                />
                <Text style={[
                  styles.filterTabText,
                  selectedFilter === filter.id && styles.filterTabTextActive
                ]}>
                  {filter.name}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>

          {/* Transactions List */}
          <Animated.View style={[styles.transactionsList, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.sectionTitle}>
              Transactions ({filteredTransactions.length})
            </Text>

            {transactionsLoading ? (
              <ActivityIndicator size="large" color="white" style={{ marginVertical: 40 }} />
            ) : (
              <>
                {filteredTransactions.map((transaction) => (
                  <TouchableOpacity
                    key={transaction.id}
                    style={styles.transactionItem}
                    onLongPress={() => handleDeleteTransaction(transaction.id)}
                  >
                    <View style={[styles.transactionIcon, { backgroundColor: `${transaction.color}30` }]}>
                      <Icon name={transaction.icon} size={20} color={transaction.color} />
                    </View>

                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionDescription}>{transaction.description}</Text>
                      <Text style={styles.transactionCategory}>
                        {transaction.category} • {new Date(transaction.date).toLocaleDateString('en-US', { weekday: 'long' })}, {new Date(transaction.date).toLocaleDateString()}
                      </Text>
                    </View>

                    <Text style={[
                      styles.transactionAmount,
                      { color: transaction.type === 'income' ? '#4CAF50' : '#FF5252' }
                    ]}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </Text>
                  </TouchableOpacity>
                ))}

                {filteredTransactions.length === 0 && !transactionsLoading && (
                  <View style={styles.emptyState}>
                    <Icon name="receipt" size={64} color="rgba(255,255,255,0.3)" />
                    <Text style={styles.emptyStateTitle}>No transactions found</Text>
                    <Text style={styles.emptyStateMessage}>
                      {searchQuery ? 'Try adjusting your search' : 'Start by adding your first transaction'}
                    </Text>
                  </View>
                )}
              </>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  summaryTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 15,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 15,
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
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  periodButtonTextActive: {
    color: theme.primary,
  },

  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: 'white',
    paddingVertical: 12,
  },
  clearButton: {
    padding: 5,
  },

  // Filter Tabs
  filterTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  filterTabActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 6,
  },
  filterTabTextActive: {
    color: 'white',
  },

  // Transactions List
  transactionsList: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
    color: 'white',
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 15,
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
});