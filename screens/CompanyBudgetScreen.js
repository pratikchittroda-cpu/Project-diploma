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
  Modal,
  TextInput,
  Alert,
  SafeAreaView,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import budgetService from '../services/budgetService';
import { useThemedMessageBox } from '../hooks/useThemedMessageBox';
import UserTypeGuard from '../components/UserTypeGuard';
import CircularProgress from '../components/budget/CircularProgress';

export default function CompanyBudgetScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { transactions } = useTransactions();
  const { showSuccess, showError } = useThemedMessageBox();

  const [selectedPeriod, setSelectedPeriod] = useState('Monthly');
  const [budgets, setBudgets] = useState([]);
  const [realBudgetData, setRealBudgetData] = useState({
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    percentage: 0,
    departments: [],
    alerts: []
  });
  const [showAddBudgetModal, setShowAddBudgetModal] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('office-supplies');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const loadBudgets = async () => {
      if (user) {
        try {
          const result = await budgetService.getUserBudgets(user.uid);
          if (result.success) {
            setBudgets(result.budgets.filter(b => b.type === 'company'));
          }
        } catch (error) {
          console.error("Error loading budgets:", error);
        }
      }
    };
    loadBudgets();

    // Reload budgets when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadBudgets();
    });

    return unsubscribe;
  }, [user, navigation]);

  useEffect(() => {
    calculateBudgetData();
  }, [selectedPeriod, transactions, budgets]);

  const calculateBudgetData = () => {
    try {
      const now = new Date();
      let startDate, endDate;

      switch (selectedPeriod) {
        case 'Weekly':
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          startDate = new Date(now.setDate(diff));
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'Yearly':
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

      // Calculate total budget for the period
      const periodBudgets = budgets.filter(b => b.period === selectedPeriod);
      const totalBudget = periodBudgets.reduce((sum, b) => sum + b.amount, 0);

      // Calculate total spent by category
      const categorySpending = {};
      periodTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
          const category = t.category || 'other';
          categorySpending[category] = (categorySpending[category] || 0) + t.amount;
        });

      const totalSpent = Object.values(categorySpending).reduce((sum, amount) => sum + amount, 0);
      const totalRemaining = Math.max(0, totalBudget - totalSpent);
      const percentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

      // Create department data
      const departments = periodBudgets.map((budget, index) => {
        const spent = categorySpending[budget.category] || 0;
        const remaining = Math.max(0, budget.amount - spent);
        const deptPercentage = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
        const colors = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#607D8B'];

        return {
          id: budget.id || index + 1,
          name: budget.name || getCompanyCategoryName(budget.category),
          budget: budget.amount,
          spent,
          remaining,
          percentage: deptPercentage,
          color: colors[index % colors.length],
          icon: getCategoryIcon(budget.category),
          categories: [
            { name: budget.name || getCompanyCategoryName(budget.category), budget: budget.amount, spent }
          ]
        };
      });

      // Generate alerts
      const alerts = departments
        .filter(dept => dept.percentage > 80)
        .map((dept, index) => ({
          id: index + 1,
          type: dept.percentage > 95 ? 'danger' : 'warning',
          department: dept.name,
          message: dept.percentage > 95
            ? `${dept.name} has exceeded budget`
            : `${dept.name} is approaching limit`,
          severity: dept.percentage > 95 ? 'high' : 'medium'
        }));

      setRealBudgetData({
        totalBudget,
        totalSpent,
        totalRemaining,
        percentage,
        departments,
        alerts
      });
    } catch (error) {
      console.error("Error calculating budget data:", error);
    }
  };

  const handleAddBudget = async () => {
    if (!budgetAmount || parseFloat(budgetAmount) <= 0) {
      showError('Invalid Amount', 'Please enter a valid budget amount');
      return;
    }

    try {
      const budgetData = {
        category: budgetCategory,
        amount: parseFloat(budgetAmount),
        period: selectedPeriod,
        name: getCompanyCategoryName(budgetCategory),
        type: 'company'
      };

      const result = await budgetService.createBudget(user.uid, budgetData);

      if (result.success) {
        const newBudget = { id: result.budgetId, ...budgetData };
        const updatedBudgets = budgets.filter(b => !(b.category === budgetCategory && b.period === selectedPeriod));
        setBudgets([...updatedBudgets, newBudget]);

        setBudgetAmount('');
        setBudgetCategory('office-supplies');
        setShowAddBudgetModal(false);

        showSuccess('Success', 'Budget created successfully');
      } else {
        showError('Error', 'Failed to create budget');
      }
    } catch (error) {
      showError('Error', 'An unexpected error occurred');
    }
  };

  const getCompanyCategoryName = (category) => {
    const categories = {
      'office-supplies': 'Office Supplies',
      'marketing': 'Marketing',
      'travel': 'Travel',
      'utilities': 'Utilities',
      'rent': 'Rent',
      'equipment': 'Equipment',
      'software': 'Software',
      'professional-services': 'Services',
      'insurance': 'Insurance',
      'other': 'Other'
    };
    return categories[category] || 'Other';
  };

  const getCategoryIcon = (category) => {
    const iconMap = {
      'office-supplies': 'office-building',
      'marketing': 'bullhorn',
      'travel': 'airplane',
      'utilities': 'flash',
      'rent': 'home',
      'equipment': 'desktop-mac',
      'software': 'application',
      'professional-services': 'account-tie',
      'insurance': 'shield-check',
      'other': 'dots-horizontal'
    };
    return iconMap[category] || 'dots-horizontal';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const companyCategories = [
    { id: 'office-supplies', name: 'Office Supplies', icon: 'office-building' },
    { id: 'marketing', name: 'Marketing', icon: 'bullhorn' },
    { id: 'travel', name: 'Travel & Expenses', icon: 'airplane' },
    { id: 'utilities', name: 'Utilities', icon: 'flash' },
    { id: 'rent', name: 'Rent & Facilities', icon: 'home' },
    { id: 'equipment', name: 'Equipment', icon: 'desktop-mac' },
    { id: 'software', name: 'Software & Subscriptions', icon: 'application' },
    { id: 'professional-services', name: 'Professional Services', icon: 'account-tie' },
    { id: 'insurance', name: 'Insurance', icon: 'shield-check' },
    { id: 'other', name: 'Other Business Expenses', icon: 'dots-horizontal' }
  ];

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-left" size={24} color="white" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Company Budget</Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setShowAddBudgetModal(true)}
      >
        <Icon name="plus" size={20} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderPeriodSelector = () => (
    <Animated.View style={[styles.periodSelector, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {['Weekly', 'Monthly', 'Yearly'].map((period) => (
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
  );

  const renderBudgetOverview = () => (
    <Animated.View style={[styles.overviewCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.overviewGradient}
      >
        <View style={styles.overviewHeader}>
          <View>
            <Text style={styles.overviewTitle}>{selectedPeriod} Budget</Text>
            <Text style={styles.overviewSubtitle}>
              {realBudgetData.departments.length} Active Budgets
            </Text>
          </View>
          <Icon name="chart-pie" size={24} color="rgba(255,255,255,0.8)" />
        </View>

        <View style={styles.progressContainer}>
          <CircularProgress
            percentage={realBudgetData.percentage}
            size={160}
            strokeWidth={14}
            color="white"
            backgroundColor="rgba(255,255,255,0.3)"
            showPercentage={true}
            textColor="white"
            fontSize={32}
          />
        </View>

        <View style={styles.overviewStats}>
          <View style={styles.overviewStatItem}>
            <Text style={styles.overviewStatLabel}>Total Budget</Text>
            <Text style={styles.overviewStatValue}>{formatCurrency(realBudgetData.totalBudget)}</Text>
          </View>
          <View style={styles.overviewStatDivider} />
          <View style={styles.overviewStatItem}>
            <Text style={styles.overviewStatLabel}>Spent</Text>
            <Text style={styles.overviewStatValue}>{formatCurrency(realBudgetData.totalSpent)}</Text>
          </View>
          <View style={styles.overviewStatDivider} />
          <View style={styles.overviewStatItem}>
            <Text style={styles.overviewStatLabel}>Remaining</Text>
            <Text style={styles.overviewStatValue}>{formatCurrency(realBudgetData.totalRemaining)}</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  const renderDepartments = () => (
    <Animated.View style={[styles.sectionContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>Department Budgets</Text>
      {realBudgetData.departments.length > 0 ? (
        realBudgetData.departments.map((dept) => (
          <View key={dept.id} style={styles.departmentCard}>
            <View style={styles.departmentHeader}>
              <View style={styles.departmentInfo}>
                <View style={[styles.departmentIcon, { backgroundColor: `${dept.color}20` }]}>
                  <Icon name={dept.icon} size={20} color={dept.color} />
                </View>
                <View style={styles.departmentDetails}>
                  <Text style={styles.departmentName}>{dept.name}</Text>
                  <Text style={styles.departmentAmount}>
                    {formatCurrency(dept.spent)} of {formatCurrency(dept.budget)}
                  </Text>
                </View>
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
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Icon name="wallet-plus" size={48} color="rgba(255,255,255,0.5)" />
          <Text style={styles.emptyText}>No budgets set for this period</Text>
          <TouchableOpacity
            style={styles.createFirstButton}
            onPress={() => setShowAddBudgetModal(true)}
          >
            <Text style={styles.createFirstButtonText}>Create First Budget</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

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
          {renderHeader()}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {renderPeriodSelector()}
            {renderBudgetOverview()}
            {renderDepartments()}
          </ScrollView>
        </SafeAreaView>

        {/* Add Budget Modal */}
        <Modal
          visible={showAddBudgetModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddBudgetModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Set {selectedPeriod} Budget</Text>
                <TouchableOpacity onPress={() => setShowAddBudgetModal(false)}>
                  <Icon name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                  {companyCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryOption,
                        budgetCategory === cat.id && styles.categoryOptionActive
                      ]}
                      onPress={() => setBudgetCategory(cat.id)}
                    >
                      <Icon
                        name={cat.icon}
                        size={20}
                        color={budgetCategory === cat.id ? 'white' : 'rgba(255,255,255,0.7)'}
                      />
                      <Text style={[
                        styles.categoryOptionText,
                        budgetCategory === cat.id && styles.categoryOptionTextActive
                      ]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  value={budgetAmount}
                  onChangeText={setBudgetAmount}
                  placeholder="Enter amount"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  keyboardType="numeric"
                />
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleAddBudget}>
                <LinearGradient
                  colors={[theme.primary, theme.primaryLight]}
                  style={styles.saveGradient}
                >
                  <Text style={styles.saveButtonText}>Save Budget</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: 'white',
  },
  periodButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    fontSize: 14,
  },
  periodButtonTextActive: {
    color: theme.primary,
  },

  // Overview Card
  overviewCard: {
    marginHorizontal: 20,
    marginBottom: 25,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  overviewGradient: {
    padding: 24,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  overviewSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  overviewStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  overviewStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  overviewStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Departments Section
  sectionContainer: {
    marginHorizontal: 20,
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
    flex: 1,
  },
  departmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  departmentDetails: {
    flex: 1,
  },
  departmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  departmentAmount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
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
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 16,
    marginBottom: 24,
    fontSize: 16,
  },
  createFirstButton: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createFirstButtonText: {
    color: theme.primary,
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#2A2A2A', // Dark background for modal
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  categorySelector: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryOptionActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  categoryOptionText: {
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 8,
    fontSize: 14,
  },
  categoryOptionTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  saveButton: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
