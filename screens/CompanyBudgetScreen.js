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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import budgetService from '../services/budgetService';
import { useThemedMessageBox } from '../hooks/useThemedMessageBox';
import ThemedMessageBox from '../components/ThemedMessageBox';
import UserTypeGuard from '../components/UserTypeGuard';

// Dimensions removed as not used

export default function CompanyBudgetScreen({ navigation }) {
  const { theme, isLoading } = useTheme();

  // Don't render until theme is loaded - check this BEFORE other hooks
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', paddingTop: StatusBar.currentHeight || 0 }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  const { user, userData, updateUserProfile } = useAuth();
  const { transactions, refresh: refreshTransactions } = useTransactions();
  const [selectedPeriod, setSelectedPeriod] = useState('Monthly');
  const [selectedView, setSelectedView] = useState('overview');
  const [showAddBudgetModal, setShowAddBudgetModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('office-supplies');

  // Themed message box hook
  const {
    messageBoxConfig,
    showMessage,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm,
    hideMessage
  } = useThemedMessageBox();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Company budget data state - starts empty until user creates budgets
  const [budgets, setBudgets] = useState([]);
  const [realBudgetData, setRealBudgetData] = useState({
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    departments: [],
    alerts: []
  });

  // Load budgets from database and calculate real data
  const loadBudgetsFromDatabase = async () => {
    try {
      if (user?.uid) {
        const result = await budgetService.getUserBudgets(user.uid);
        if (result.success) {
          // Filter for company budgets
          const companyBudgets = result.budgets.filter(budget => budget.type === 'company' || !budget.type);
          setBudgets(companyBudgets);

          // Calculate real budget data
          calculateRealBudgetData(companyBudgets);
        } else {
          }
      }
    } catch (error) {
      }
  };

  // Calculate real budget data from budgets and transactions
  const calculateRealBudgetData = (budgetList = budgets) => {
    if (!transactions || transactions.length === 0) {
      return;
    }

    try {
      // Get current period transactions
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
        case 'This Quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
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

      // Calculate total budget for the period
      const periodBudgets = budgetList.filter(b => b.period === selectedPeriod);
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
      const totalRemaining = totalBudget - totalSpent;

      // Create department data from budgets and spending
      const departments = periodBudgets.map((budget, index) => {
        const spent = categorySpending[budget.category] || 0;
        const remaining = budget.amount - spent;
        const percentage = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
        const colors = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#607D8B'];

        return {
          id: budget.id || index + 1,
          name: budget.name,
          budget: budget.amount,
          spent,
          remaining,
          percentage,
          color: colors[index % colors.length],
          icon: getCategoryIcon(budget.category),
          categories: [
            { name: budget.name, budget: budget.amount, spent }
          ]
        };
      });

      // Generate alerts for overspending
      const alerts = departments
        .filter(dept => dept.percentage > 80)
        .map((dept, index) => ({
          id: index + 1,
          type: dept.percentage > 95 ? 'danger' : 'warning',
          department: dept.name,
          message: dept.percentage > 95
            ? `${dept.name} has exceeded budget (${dept.percentage}% used)`
            : `${dept.name} is approaching budget limit (${dept.percentage}% used)`,
          severity: dept.percentage > 95 ? 'high' : 'medium'
        }));

      setRealBudgetData({
        totalBudget,
        totalSpent,
        totalRemaining,
        departments,
        alerts
      });
    } catch (error) {
      }
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

    // Load budgets from database
    loadBudgetsFromDatabase();

    // Listen for navigation focus to track tab bar navigation
    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
      // Auto-refresh budget data when screen becomes active
      autoRefresh();
      // Reload budgets when screen becomes active
      loadBudgetsFromDatabase();
    });

    return unsubscribe;
  }, [navigation]);

  // Recalculate budget data when period changes or transactions update
  useEffect(() => {
    if (budgets.length > 0 && transactions.length > 0) {
      calculateRealBudgetData();
    }
  }, [selectedPeriod, transactions, budgets]);

  // Auto refresh functionality when screen becomes active
  const autoRefresh = async () => {
    try {
      // Refresh transactions silently (this will trigger budget recalculation)
      await refreshTransactions();
      // Reload budgets from database
      await loadBudgetsFromDatabase();
    } catch (error) {
      }
  };

  const trackScreenVisit = async () => {
    try {
      const stored = await AsyncStorage.getItem('company_recent_actions');
      let recentActions = stored ? JSON.parse(stored) : [];

      const newAction = {
        id: 'budget',
        name: 'Budget',
        icon: 'calculator',
        color: '#FF9800',
        timestamp: Date.now()
      };

      recentActions = recentActions.filter(action => action.id !== 'budget');
      recentActions.unshift(newAction);
      recentActions = recentActions.slice(0, 4);

      await AsyncStorage.setItem('company_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      }
  };



  const periods = ['This Week', 'This Month', 'This Quarter', 'This Year'];
  const views = [
    { id: 'overview', name: 'Overview', icon: 'chart-pie' },
    { id: 'departments', name: 'Departments', icon: 'office-building' },
    { id: 'alerts', name: 'Alerts', icon: 'alert-circle' },
  ];

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return theme.textSecondary;
    }
  };

  const handleCreateBudget = () => {
    setShowAddBudgetModal(true);
  };

  // Function to handle adding a new company budget
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
        type: 'company' // Mark as company budget
      };

      // Save to database
      const result = await budgetService.createBudget(user.uid, budgetData);

      if (result.success) {
        // Update local state with database ID
        const newBudget = {
          id: result.budgetId,
          ...budgetData
        };

        // Remove existing budget for same category and period
        const updatedBudgets = budgets.filter(b => !(b.category === budgetCategory && b.period === selectedPeriod));
        setBudgets([...updatedBudgets, newBudget]);

        // Reset form
        setBudgetAmount('');
        setBudgetCategory('office-supplies');
        setShowAddBudgetModal(false);

        // Update user profile with total budget for this period
        updateCompanyBudgetProfile(newBudget, [...updatedBudgets, newBudget]);

        // Show detailed message box for important success
        // Show detailed message box for important success
        showSuccess(
          'Budget Created Successfully!', 
          `${selectedPeriod} company budget for ${getCompanyCategoryName(budgetCategory)} has been saved to database and set to ${formatCurrency(parseFloat(budgetAmount))}`,
          { autoHideDelay: 4000 }
        );
      } else {
        showError('Budget Creation Failed', `Failed to save company budget: ${result.error}`);
      }
    } catch (error) {
      showError('Budget Creation Error', 'Failed to save company budget. Please try again.');
    }
  };

  // Function to update user profile with company budget totals
  const updateCompanyBudgetProfile = async (newBudget, allBudgets) => {
    try {
      const periodBudgets = allBudgets.filter(b => b.period === selectedPeriod);
      const totalBudget = periodBudgets.reduce((sum, b) => sum + b.amount, 0);

      // Update user profile with the total company budget for this period
      const profileUpdate = {};
      if (selectedPeriod === 'Weekly') {
        profileUpdate.companyWeeklyBudget = totalBudget;
      } else if (selectedPeriod === 'Monthly') {
        profileUpdate.companyMonthlyBudget = totalBudget;
      } else if (selectedPeriod === 'Yearly') {
        profileUpdate.companyYearlyBudget = totalBudget;
      }

      const result = await updateUserProfile(profileUpdate);
      if (!result.success) {
        }
    } catch (error) {
      }
  };

  // Helper function to get company category names
  const getCompanyCategoryName = (category) => {
    const categories = {
      'office-supplies': 'Office Supplies',
      'marketing': 'Marketing',
      'travel': 'Travel & Expenses',
      'utilities': 'Utilities',
      'rent': 'Rent & Facilities',
      'equipment': 'Equipment',
      'software': 'Software & Subscriptions',
      'professional-services': 'Professional Services',
      'insurance': 'Insurance',
      'other': 'Other Business Expenses'
    };
    return categories[category] || 'Other';
  };

  // Helper function to get days left in current period
  const getDaysLeftInPeriod = () => {
    const now = new Date();
    let endDate;

    switch (selectedPeriod) {
      case 'This Week':
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
        endDate = endOfWeek;
        break;
      case 'This Month':
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'This Quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'This Year':
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };



  // Company categories for the modal
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

  const handleEditBudget = (department) => {
    showConfirm(
      'Edit Budget',
      `Do you want to edit the budget for ${department.name} department?`,
      () => {
        // Handle edit budget logic here
        showInfo('Edit Budget', 'Budget editing functionality will be implemented here');
      },
      () => {
        // Cancel action - do nothing
      }
    );
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-left" size={24} color={theme.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Budget Planning</Text>
      <TouchableOpacity style={styles.createButton} onPress={handleCreateBudget}>
        <Icon name="plus" size={20} color="white" />
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

  const renderBudgetOverview = () => {
    // Use real data if available, otherwise show empty state
    const displayData = realBudgetData.totalBudget > 0 ? realBudgetData : null;

    if (!displayData) {
      return (
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.noBudgetContainer}>
            <Icon name="calculator" size={64} color={theme.textSecondary} />
            <Text style={styles.noBudgetTitle}>No Company Budgets Set</Text>
            <Text style={styles.noBudgetMessage}>
              Create your first company budget for {selectedPeriod.toLowerCase()} planning
            </Text>
            <TouchableOpacity style={styles.createFirstBudgetButton} onPress={handleCreateBudget}>
              <Icon name="plus" size={20} color="white" />
              <Text style={styles.createFirstBudgetText}>Create Budget</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Total Budget Card */}
        <View style={styles.totalBudgetCard}>
          <LinearGradient colors={[theme.primary, theme.primaryLight]} style={styles.totalBudgetGradient}>
            <View style={styles.totalBudgetHeader}>
              <Text style={styles.totalBudgetTitle}>Total Company Budget</Text>
              <Icon name="wallet" size={24} color="white" />
            </View>
            <Text style={styles.totalBudgetAmount}>{formatCurrency(displayData.totalBudget)}</Text>

            <View style={styles.budgetBreakdown}>
              <View style={styles.budgetBreakdownItem}>
                <Text style={styles.budgetBreakdownLabel}>Spent</Text>
                <Text style={styles.budgetBreakdownValue}>{formatCurrency(displayData.totalSpent)}</Text>
              </View>
              <View style={styles.budgetBreakdownDivider} />
              <View style={styles.budgetBreakdownItem}>
                <Text style={styles.budgetBreakdownLabel}>Remaining</Text>
                <Text style={styles.budgetBreakdownValue}>{formatCurrency(displayData.totalRemaining)}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Budget Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { backgroundColor: '#E8F5E8' }]}>
            <Icon name="trending-up" size={24} color="#4CAF50" />
            <Text style={styles.summaryValue}>
              {displayData.totalBudget > 0 ? ((displayData.totalSpent / displayData.totalBudget) * 100).toFixed(1) : '0.0'}%
            </Text>
            <Text style={styles.summaryLabel}>Budget Used</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: '#E3F2FD' }]}>
            <Icon name="calendar-month" size={24} color="#2196F3" />
            <Text style={styles.summaryValue}>{getDaysLeftInPeriod()}</Text>
            <Text style={styles.summaryLabel}>Days Left</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: '#FFF3E0' }]}>
            <Icon name="alert-circle" size={24} color="#FF9800" />
            <Text style={styles.summaryValue}>{displayData.alerts.length}</Text>
            <Text style={styles.summaryLabel}>Alerts</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderDepartmentBudgets = () => {
    const displayData = realBudgetData.totalBudget > 0 ? realBudgetData : null;

    if (!displayData || displayData.departments.length === 0) {
      return (
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.sectionTitle}>Department Budgets</Text>
          <View style={styles.noBudgetContainer}>
            <Icon name="office-building" size={64} color={theme.textSecondary} />
            <Text style={styles.noBudgetTitle}>No Department Budgets</Text>
            <Text style={styles.noBudgetMessage}>
              Create budgets for different business categories to track spending
            </Text>
            <TouchableOpacity style={styles.createFirstBudgetButton} onPress={handleCreateBudget}>
              <Icon name="plus" size={20} color="white" />
              <Text style={styles.createFirstBudgetText}>Create Budget</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.sectionTitle}>Department Budgets ({displayData.departments.length})</Text>
        {displayData.departments.map((dept) => (
          <View key={dept.id} style={styles.departmentCard}>
            <View style={styles.departmentHeader}>
              <View style={styles.departmentInfo}>
                <View style={[styles.departmentIcon, { backgroundColor: `${dept.color}20` }]}>
                  <Icon name={dept.icon} size={20} color={dept.color} />
                </View>
                <View style={styles.departmentDetails}>
                  <Text style={styles.departmentName}>{dept.name}</Text>
                  <Text style={styles.departmentBudgetText}>
                    {formatCurrency(dept.spent)} of {formatCurrency(dept.budget)}
                  </Text>
                </View>
              </View>
              <View style={styles.departmentActions}>
                <Text style={[styles.departmentPercentage, { color: dept.color }]}>
                  {dept.percentage}%
                </Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEditBudget(dept)}
                >
                  <Icon name="pencil" size={16} color={theme.textLight} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${dept.percentage}%`,
                      backgroundColor: dept.color
                    }
                  ]}
                />
              </View>
            </View>

            <View style={styles.departmentFooter}>
              <Text style={styles.remainingAmount}>
                {formatCurrency(dept.remaining)} remaining
              </Text>
              <TouchableOpacity style={styles.viewDetailsButton}>
                <Text style={styles.viewDetailsText}>View Details</Text>
                <Icon name="chevron-right" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>

            {/* Category Breakdown */}
            <View style={styles.categoryBreakdown}>
              {dept.categories.map((category, index) => (
                <View key={index} style={styles.categoryItem}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryAmount}>
                    {formatCurrency(category.spent)} / {formatCurrency(category.budget)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderBudgetAlerts = () => {
    const displayData = realBudgetData.totalBudget > 0 ? realBudgetData : null;
    const alertsToShow = displayData ? displayData.alerts : [];

    return (
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.sectionTitle}>Budget Alerts ({alertsToShow.length})</Text>
        {alertsToShow.map((alert) => (
          <View key={alert.id} style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={[styles.alertIcon, { backgroundColor: `${getAlertColor(alert.severity)}20` }]}>
                <Icon
                  name={alert.type === 'warning' ? 'alert' : 'alert-circle'}
                  size={20}
                  color={getAlertColor(alert.severity)}
                />
              </View>
              <View style={styles.alertContent}>
                <View style={styles.alertTitleRow}>
                  <Text style={styles.alertDepartment}>{alert.department}</Text>
                  <View style={[styles.severityBadge, { backgroundColor: getAlertColor(alert.severity) }]}>
                    <Text style={styles.severityText}>{alert.severity}</Text>
                  </View>
                </View>
                <Text style={styles.alertMessage}>{alert.message}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.alertAction}>
              <Text style={styles.alertActionText}>Take Action</Text>
              <Icon name="arrow-right" size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>
        ))}

        {/* No Alerts State */}
        {alertsToShow.length === 0 && (
          <View style={styles.noAlertsContainer}>
            <Icon name="check-circle" size={64} color="#4CAF50" />
            <Text style={styles.noAlertsTitle}>All Good!</Text>
            <Text style={styles.noAlertsMessage}>
              {displayData ? 'No budget alerts at this time' : 'Create budgets to monitor spending alerts'}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderContent = () => {
    switch (selectedView) {
      case 'overview':
        return renderBudgetOverview();
      case 'departments':
        return renderDepartmentBudgets();
      case 'alerts':
        return renderBudgetAlerts();
      default:
        return renderBudgetOverview();
    }
  };

  const styles = createStyles(theme);

  return (
    <UserTypeGuard requiredUserType="company" navigation={navigation}>
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

      {/* Add Company Budget Modal */}
      <Modal
        visible={showAddBudgetModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowAddBudgetModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddBudgetModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set {selectedPeriod} Company Budget</Text>
              <TouchableOpacity
                onPress={() => setShowAddBudgetModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Budget Amount (₹)</Text>
              <TextInput
                style={styles.amountInput}
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                placeholder="Enter budget amount"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                autoFocus={true}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <TouchableOpacity
                style={styles.categorySelector}
                onPress={() => setShowCategoryModal(true)}
              >
                <Icon name={companyCategories.find(c => c.id === budgetCategory)?.icon || 'office-building'} size={20} color={theme.primary} />
                <Text style={styles.categoryText}>{getCompanyCategoryName(budgetCategory)}</Text>
                <Icon name="chevron-down" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddBudgetModal(false);
                  setBudgetAmount('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddBudget}
              >
                <Text style={styles.saveButtonText}>Save Budget</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.categoryModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.categoryList}>
              {companyCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    budgetCategory === category.id && styles.selectedCategoryItem
                  ]}
                  onPress={() => {
                    setBudgetCategory(category.id);
                    setShowCategoryModal(false);
                  }}
                >
                  <Icon
                    name={category.icon}
                    size={20}
                    color={budgetCategory === category.id ? theme.primary : theme.textSecondary}
                  />
                  <Text style={[
                    styles.categoryItemText,
                    budgetCategory === category.id && styles.selectedCategoryItemText
                  ]}>
                    {category.name}
                  </Text>
                  {budgetCategory === category.id && (
                    <Icon name="check" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Themed Message Box */}
      <ThemedMessageBox
        {...messageBoxConfig}
        onDismiss={hideMessage}
      />
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
  createButton: {
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

  // Total Budget Card Styles
  totalBudgetCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  totalBudgetGradient: {
    padding: 25,
  },
  totalBudgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  totalBudgetTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  totalBudgetAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  budgetBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetBreakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  budgetBreakdownLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 5,
  },
  budgetBreakdownValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  budgetBreakdownDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Summary Grid Styles
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 8,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  // Department Card Styles
  departmentCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  departmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  departmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  departmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  departmentDetails: {
    flex: 1,
  },
  departmentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 2,
  },
  departmentBudgetText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  departmentActions: {
    alignItems: 'flex-end',
  },
  departmentPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  editButton: {
    padding: 5,
  },
  progressBarContainer: {
    marginBottom: 15,
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
  departmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  remainingAmount: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },
  categoryBreakdown: {
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    paddingTop: 15,
    gap: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  categoryAmount: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
  },

  // Alert Card Styles
  alertCard: {
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
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertDepartment: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  severityText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  alertMessage: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  alertAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  alertActionText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },

  // No Alerts Styles
  noAlertsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noAlertsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 15,
    marginBottom: 8,
  },
  noAlertsMessage: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.text,
    backgroundColor: theme.background,
    marginBottom: 20,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.background,
    gap: 12,
  },
  categoryText: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  categoryModalContent: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  categoryList: {
    maxHeight: 400,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 16,
  },
  selectedCategoryItem: {
    backgroundColor: theme.primary + '10',
  },
  categoryItemText: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
  },
  selectedCategoryItemText: {
    color: theme.primary,
    fontWeight: '600',
  },
  noBudgetContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  noBudgetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  noBudgetMessage: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  createFirstBudgetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  createFirstBudgetText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
