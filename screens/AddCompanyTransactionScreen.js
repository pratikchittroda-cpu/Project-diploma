import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import UserTypeGuard from '../components/UserTypeGuard';

export default function AddCompanyTransactionScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const { user, userData } = useAuth();
  const { addTransaction } = useTransactions();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedType, setSelectedType] = useState('expense');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    trackScreenVisit();

    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
    });

    return unsubscribe;
  }, [navigation]);

  const trackScreenVisit = async () => {
    try {
      const stored = await AsyncStorage.getItem('company_recent_actions');
      let recentActions = stored ? JSON.parse(stored) : [];

      const newAction = {
        id: 'add',
        name: 'Add Transaction',
        icon: 'plus-circle',
        color: theme.primary,
        timestamp: Date.now()
      };

      recentActions = recentActions.filter(action => action.id !== 'add');
      recentActions.unshift(newAction);
      recentActions = recentActions.slice(0, 4);

      await AsyncStorage.setItem('company_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      console.error('Error tracking screen visit:', error);
    }
  };

  // Company categories and departments
  const companyCategories = {
    expense: [
      { id: 'office-supplies', name: 'Office Supplies', icon: 'office-building', color: '#2196F3' },
      { id: 'marketing', name: 'Marketing', icon: 'bullhorn', color: '#FF9800' },
      { id: 'transport', name: 'Transportation', icon: 'car', color: '#00BCD4' },
      { id: 'utilities', name: 'Utilities', icon: 'flash', color: '#FFC107' },
      { id: 'software', name: 'Software', icon: 'laptop', color: '#9C27B0' },
      { id: 'equipment', name: 'Equipment', icon: 'tools', color: '#607D8B' },
      { id: 'salaries', name: 'Salaries', icon: 'account-group', color: '#4CAF50' },
      { id: 'rent', name: 'Rent', icon: 'home', color: '#F44336' },
    ],
    income: [
      { id: 'sales', name: 'Sales Revenue', icon: 'cash-multiple', color: '#4CAF50' },
      { id: 'services', name: 'Service Income', icon: 'account-tie', color: '#2196F3' },
      { id: 'investment', name: 'Investment', icon: 'chart-line', color: '#9C27B0' },
      { id: 'consulting', name: 'Consulting', icon: 'account-supervisor', color: '#FF9800' },
    ]
  };

  const departments = [
    { id: 'hr', name: 'HR', icon: 'account-group' },
    { id: 'it', name: 'IT', icon: 'laptop' },
    { id: 'finance', name: 'Finance', icon: 'calculator' },
    { id: 'marketing', name: 'Marketing', icon: 'bullhorn' },
    { id: 'operations', name: 'Operations', icon: 'cog' },
    { id: 'sales', name: 'Sales', icon: 'handshake' },
  ];

  const handleSubmit = async () => {
    if (!amount || !description || !selectedCategory || !selectedDepartment) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);

    try {
      const transactionData = {
        type: selectedType,
        amount: numericAmount,
        description: description.trim(),
        category: selectedCategory,
        department: selectedDepartment,
        date: selectedDate,
        companyId: userData?.companyId || user?.uid,
        userType: 'company'
      };

      const result = await addTransaction(transactionData);

      if (result.success) {
        Alert.alert(
          'Success',
          'Transaction added successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to add transaction. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    const numValue = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (isNaN(numValue)) return '';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
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
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-left" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Transaction</Text>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => navigation.navigate('ReceiptScanner')}
            >
              <Icon name="camera" size={20} color="white" />
            </TouchableOpacity>
          </Animated.View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Transaction Type Selector */}
            <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Text style={styles.sectionTitle}>Transaction Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    selectedType === 'expense' && styles.typeButtonActiveExpense
                  ]}
                  onPress={() => {
                    setSelectedType('expense');
                    setSelectedCategory('');
                  }}
                >
                  <Icon
                    name="trending-down"
                    size={20}
                    color={selectedType === 'expense' ? 'white' : 'rgba(255,255,255,0.7)'}
                  />
                  <Text style={[
                    styles.typeButtonText,
                    selectedType === 'expense' && styles.typeButtonTextActive
                  ]}>
                    Expense
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    selectedType === 'income' && styles.typeButtonActiveIncome
                  ]}
                  onPress={() => {
                    setSelectedType('income');
                    setSelectedCategory('');
                  }}
                >
                  <Icon
                    name="trending-up"
                    size={20}
                    color={selectedType === 'income' ? 'white' : 'rgba(255,255,255,0.7)'}
                  />
                  <Text style={[
                    styles.typeButtonText,
                    selectedType === 'income' && styles.typeButtonTextActive
                  ]}>
                    Revenue
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Amount Input */}
            <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Text style={styles.sectionTitle}>Amount</Text>
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
              </View>
              {amount && (
                <Text style={styles.amountPreview}>{formatCurrency(amount)}</Text>
              )}
            </Animated.View>

            {/* Category Selector */}
            <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Text style={styles.sectionTitle}>Category</Text>
              <View style={styles.categoryGrid}>
                {companyCategories[selectedType].map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category.id && styles.categoryButtonActive
                    ]}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: `${category.color}30` }]}>
                      <Icon
                        name={category.icon}
                        size={20}
                        color={selectedCategory === category.id ? 'white' : category.color}
                      />
                    </View>
                    <Text style={[
                      styles.categoryButtonText,
                      selectedCategory === category.id && styles.categoryButtonTextActive
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>

            {/* Department Selector */}
            <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Text style={styles.sectionTitle}>Department</Text>
              <View style={styles.departmentGrid}>
                {departments.map((department) => (
                  <TouchableOpacity
                    key={department.id}
                    style={[
                      styles.departmentButton,
                      selectedDepartment === department.id && styles.departmentButtonActive
                    ]}
                    onPress={() => setSelectedDepartment(department.id)}
                  >
                    <Icon
                      name={department.icon}
                      size={16}
                      color={selectedDepartment === department.id ? 'white' : 'rgba(255,255,255,0.7)'}
                    />
                    <Text style={[
                      styles.departmentButtonText,
                      selectedDepartment === department.id && styles.departmentButtonTextActive
                    ]}>
                      {department.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>

            {/* Date Input */}
            <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Text style={styles.sectionTitle}>Date</Text>
              <View style={styles.dateContainer}>
                <Icon name="calendar" size={20} color="rgba(255,255,255,0.7)" />
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={selectedDate}
                  onChangeText={setSelectedDate}
                />
              </View>
            </Animated.View>

            {/* Description Input */}
            <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Text style={styles.sectionTitle}>Description</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Enter transaction details..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Animated.View>

            {/* Submit Button */}
            <Animated.View style={[styles.submitSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                  style={styles.submitGradient}
                >
                  {isSubmitting ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                      <Text style={styles.submitButtonText}>Processing...</Text>
                    </View>
                  ) : (
                    <>
                      <Icon name="check-circle" size={24} color="white" />
                      <Text style={styles.submitButtonText}>Add Transaction</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
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
  scanButton: {
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
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 12,
  },

  // Type Selector
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  typeButtonActiveExpense: {
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
    borderColor: 'rgba(244, 67, 54, 0.5)',
  },
  typeButtonActiveIncome: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 8,
  },
  typeButtonTextActive: {
    color: 'white',
  },

  // Amount Input
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  amountPreview: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    textAlign: 'center',
  },

  // Category Grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: '47%',
  },
  categoryButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  categoryButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },

  // Department Grid
  departmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  departmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  departmentButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  departmentButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 6,
  },
  departmentButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },

  // Date Input
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dateInput: {
    flex: 1,
    fontSize: 16,
    color: 'white',
    marginLeft: 10,
  },

  // Description Input
  descriptionInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minHeight: 100,
  },

  // Submit Button
  submitSection: {
    marginTop: 10,
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});