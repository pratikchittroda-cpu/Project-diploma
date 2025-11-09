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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.background || '#f8f9fa' }}>
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

    // Auto-refresh data when screen focuses
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
      }
  };

  // Company categories and departments
  const companyCategories = {
    expense: [
      { id: 'office', name: 'Office Supplies', icon: 'office-building' },
      { id: 'marketing', name: 'Marketing', icon: 'bullhorn' },
      { id: 'transport', name: 'Transportation', icon: 'car' },
      { id: 'utilities', name: 'Utilities', icon: 'flash' },
      { id: 'software', name: 'Software', icon: 'laptop' },
      { id: 'equipment', name: 'Equipment', icon: 'tools' },
      { id: 'salaries', name: 'Salaries', icon: 'account-group' },
      { id: 'rent', name: 'Rent', icon: 'home' },
    ],
    income: [
      { id: 'sales', name: 'Sales Revenue', icon: 'cash-multiple' },
      { id: 'services', name: 'Service Income', icon: 'account-tie' },
      { id: 'investment', name: 'Investment Income', icon: 'chart-line' },
      { id: 'consulting', name: 'Consulting', icon: 'account-supervisor' },
    ]
  };

  const departments = [
    { id: 'hr', name: 'Human Resources', icon: 'account-group' },
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
        date: new Date().toISOString().split('T')[0],
        companyId: userData?.companyId || user?.uid,
        userType: 'company'
      };

      const result = await addTransaction(transactionData);

      if (result.success) {
        Alert.alert(
          'Success',
          'Company transaction added successfully!',
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

  const styles = createStyles(theme);

  return (
    <UserTypeGuard requiredUserType="company" navigation={navigation}>
      <StatusBar backgroundColor={theme.background} barStyle={theme.statusBarStyle} />
      <View style={styles.container}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Company Transaction</Text>
          <View style={styles.placeholder} />
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
                  selectedType === 'expense' && styles.typeButtonActive
                ]}
                onPress={() => setSelectedType('expense')}
              >
                <Icon
                  name="trending-down"
                  size={20}
                  color={selectedType === 'expense' ? 'white' : theme.primary}
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
                  selectedType === 'income' && styles.typeButtonActive
                ]}
                onPress={() => setSelectedType('income')}
              >
                <Icon
                  name="trending-up"
                  size={20}
                  color={selectedType === 'income' ? 'white' : theme.primary}
                />
                <Text style={[
                  styles.typeButtonText,
                  selectedType === 'income' && styles.typeButtonTextActive
                ]}>
                  Income
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Amount Input */}
          <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.sectionTitle}>Amount</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={theme.textLight}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
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
                  <Icon
                    name={category.icon}
                    size={20}
                    color={selectedCategory === category.id ? 'white' : theme.primary}
                  />
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
                    size={18}
                    color={selectedDepartment === department.id ? 'white' : theme.primary}
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

          {/* Description Input */}
          <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Enter transaction description..."
              placeholderTextColor={theme.textLight}
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
                colors={[theme.primary, theme.primaryLight]}
                style={styles.submitGradient}
              >
                {isSubmitting ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Processing...</Text>
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>Add Transaction</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
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
    backgroundColor: theme.background,
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
  placeholder: {
    width: 40,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },

  // Type Selector Styles
  typeSelector: {
    flexDirection: 'row',
    gap: 15,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginLeft: 8,
  },
  typeButtonTextActive: {
    color: 'white',
  },

  // Amount Input Styles
  amountInput: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 15,
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    borderWidth: 2,
    borderColor: theme.border,
    textAlign: 'center',
  },

  // Category Selector Styles
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: '45%',
  },
  categoryButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
    marginLeft: 8,
  },
  categoryButtonTextActive: {
    color: 'white',
  },

  // Department Selector Styles
  departmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  departmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: '30%',
  },
  departmentButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  departmentButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.text,
    marginLeft: 6,
  },
  departmentButtonTextActive: {
    color: 'white',
  },

  // Description Input Styles
  descriptionInput: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: theme.text,
    borderWidth: 2,
    borderColor: theme.border,
    minHeight: 80,
  },

  // Submit Button Styles
  submitSection: {
    marginTop: 20,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
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