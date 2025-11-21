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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';

export default function TransactionsScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const { user, userData } = useAuth();
  const { transactions, loading: transactionsLoading, deleteTransaction, refresh } = useTransactions();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [refreshing, setRefreshing] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.loadingBackground || '#f8f9fa', paddingTop: StatusBar.currentHeight || 0 }}>
        <ActivityIndicator size="large" color={theme?.loadingIndicator || '#667eea'} />
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

    // Listen for navigation focus to auto-refresh and track tab bar navigation
    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
      // Auto-refresh transactions when screen becomes active
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
        color: theme.success,
        timestamp: Date.now()
      };
      
      recentActions = recentActions.filter(action => action.id !== 'transactions');
      recentActions.unshift(newAction);
      recentActions = recentActions.slice(0, 4);
      
      await AsyncStorage.setItem('personal_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      }
  };

  // Calculate transaction summary from Firebase data
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
      salary: 'cash-multiple',
      freelance: 'laptop',
      business: 'briefcase',
      other: 'help-circle'
    };
    return iconMap[category] || 'help-circle';
  };

  const getCategoryColor = (category, type) => {
    if (type === 'income') return theme.categoryColors?.income || theme.success;
    return theme.categoryColors?.[category] || theme.primary;
  };

  // Filter transactions based on selected filter and search query
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
  }, [transactions, selectedFilter, searchQuery]);

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

  // Auto refresh functionality when screen becomes active
  const autoRefresh = async () => {
    try {
      // Refresh transactions from Firebase silently
      await refresh();
    } catch (error) {
      }
  };

  // Manual refresh functionality (keeping for optional pull-to-refresh)
  const onRefresh = async () => {
    setRefreshing(true);
    
    try {
      // Refresh transactions data
      await refresh();
      
      // Add a small delay for better UX
      setTimeout(() => {
        setRefreshing(false);
      }, 500);
      
    } catch (error) {
      setRefreshing(false);
    }
  };

  const periods = ['This Week', 'This Month', 'This Quarter', 'This Year'];
  const filters = [
    { id: 'all', name: 'All', icon: 'format-list-bulleted' },
    { id: 'income', name: 'Income', icon: 'trending-up' },
    { id: 'expense', name: 'Expenses', icon: 'trending-down' },
  ];

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-left" size={24} color={theme.text} />
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
  );

  const renderSummaryCard = () => (
    <Animated.View style={[styles.summaryCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient colors={[theme.primary, theme.primaryLight]} style={styles.summaryGradient}>
        <Text style={styles.summaryTitle}>This Month Summary</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Icon name="trending-up" size={20} color={theme.categoryColors?.income || '#4CAF50'} />
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={styles.summaryValue}>{formatCurrency(transactionSummary.totalIncome)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Icon name="trending-down" size={20} color={theme.categoryColors?.expense || '#FF5252'} />
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={styles.summaryValue}>{formatCurrency(transactionSummary.totalExpenses)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Icon name="wallet" size={20} color={theme.categoryColors?.net || '#2196F3'} />
            <Text style={styles.summaryLabel}>Net</Text>
            <Text style={styles.summaryValue}>{formatCurrency(transactionSummary.netAmount)}</Text>
          </View>
        </View>
      </LinearGradient>
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

  const renderSearchBar = () => (
    <Animated.View style={[styles.searchContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Icon name="magnify" size={20} color={theme.textLight} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search transactions..."
        placeholderTextColor={theme.textLight}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
          <Icon name="close" size={16} color={theme.textLight} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  const renderFilterTabs = () => (
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
            color={selectedFilter === filter.id ? 'white' : theme.primary} 
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
  );

  const renderTransactionsList = () => {
    return (
      <Animated.View style={[styles.transactionsList, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.sectionTitle}>
          Transactions ({filteredTransactions.length})
        </Text>
        
        {transactionsLoading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 40 }} />
        ) : (
          <>
            {filteredTransactions.map((transaction, index) => (
              <TouchableOpacity 
                key={transaction.id} 
                style={styles.transactionItem}
                onLongPress={() => handleDeleteTransaction(transaction.id)}
              >
                <View style={[styles.transactionIcon, { backgroundColor: `${transaction.color}20` }]}>
                  <Icon name={transaction.icon} size={20} color={transaction.color} />
                </View>
                
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionDescription}>{transaction.description}</Text>
                  <Text style={styles.transactionCategory}>
                    {transaction.category} • {new Date(transaction.date).toLocaleDateString()}
                  </Text>
                </View>
                
                <Text style={[
                  styles.transactionAmount,
                  { color: transaction.type === 'income' ? theme.categoryColors?.income || theme.success : theme.categoryColors?.expense || theme.error }
                ]}>
                  {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                </Text>
              </TouchableOpacity>
            ))}

            {filteredTransactions.length === 0 && !transactionsLoading && (
              <View style={styles.emptyState}>
                <Icon name="receipt" size={64} color={theme.textLight} />
                <Text style={styles.emptyStateTitle}>No transactions found</Text>
                <Text style={styles.emptyStateMessage}>
                  {searchQuery ? 'Try adjusting your search' : 'Start by adding your first transaction'}
                </Text>
              </View>
            )}
          </>
        )}
      </Animated.View>
    );
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
            title="Pull to refresh"
            titleColor={theme.textSecondary}
          />
        }
      >
        {renderSummaryCard()}
        {renderPeriodSelector()}
        {renderSearchBar()}
        {renderFilterTabs()}
        {renderTransactionsList()}
      </ScrollView>
    </View>
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
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Summary Card Styles
  summaryCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  summaryGradient: {
    padding: 20,
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

  // Period Selector Styles
  periodSelector: {
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

  // Search Bar Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
    paddingVertical: 12,
  },
  clearButton: {
    padding: 5,
  },

  // Filter Tabs Styles
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
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginLeft: 6,
  },
  filterTabTextActive: {
    color: 'white',
  },

  // Transactions List Styles
  transactionsList: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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

  // Empty State Styles
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 15,
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
});