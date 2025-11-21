import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
  StatusBar,
  Modal,
  FlatList,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';

export default function AddTransactionScreen({ navigation }) {
  const { theme } = useTheme();
  const { user, userData } = useAuth();
  const { addTransaction } = useTransactions();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [selectedType, setSelectedType] = useState('expense');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

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

    // Listen for navigation focus to track tab bar navigation
    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
    });

    return unsubscribe;
  }, [navigation]);

  const trackScreenVisit = async () => {
    try {
      const stored = await AsyncStorage.getItem('personal_recent_actions');
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

      await AsyncStorage.setItem('personal_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      // Error tracking screen visit
    }
  };

  const personalCategories = {
    expense: [
      { id: 'food', name: 'Food & Dining', icon: 'food' },
      { id: 'transport', name: 'Transportation', icon: 'car' },
      { id: 'shopping', name: 'Shopping', icon: 'shopping' },
      { id: 'entertainment', name: 'Entertainment', icon: 'movie' },
      { id: 'bills', name: 'Bills & Utilities', icon: 'receipt' },
      { id: 'health', name: 'Healthcare', icon: 'medical-bag' },
      { id: 'education', name: 'Education', icon: 'school' },
      { id: 'other', name: 'Other', icon: 'help-circle' },
    ],
    income: [
      { id: 'salary', name: 'Salary', icon: 'cash-multiple' },
      { id: 'freelance', name: 'Freelance', icon: 'laptop' },
      { id: 'business', name: 'Business', icon: 'briefcase' },
      { id: 'investment', name: 'Investment', icon: 'trending-up' },
      { id: 'gift', name: 'Gift', icon: 'gift' },
      { id: 'other', name: 'Other', icon: 'help-circle' },
    ]
  };

  const handleSubmit = async () => {
    if (!amount || !description || !selectedCategory) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to add transactions');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare transaction data
      const transactionData = {
        type: selectedType,
        amount: parseFloat(amount),
        description: description.trim(),
        category: selectedCategory,
        date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
      };

      // Add transaction to Firebase
      const result = await addTransaction(transactionData);

      if (result.success) {
        // Add to recent actions for AsyncStorage
        try {
          const newAction = {
            id: 'add',
            name: 'Add Transaction',
            icon: 'plus-circle',
            color: theme.primary,
            timestamp: Date.now()
          };

          const existingActions = await AsyncStorage.getItem('personal_recent_actions');
          const actions = existingActions ? JSON.parse(existingActions) : [];

          // Remove existing action with same id and add new one at the beginning
          const filteredActions = actions.filter(action => action.id !== newAction.id);
          const updatedActions = [newAction, ...filteredActions].slice(0, 4);

          await AsyncStorage.setItem('personal_recent_actions', JSON.stringify(updatedActions));
        } catch (storageError) {
          // Error updating recent actions
        }

        const formattedAmount = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(parseFloat(amount));

        Alert.alert(
          'Success!',
          `Great job, ${userData?.fullName || 'User'}! Your ${selectedType === 'income' ? 'income' : 'expense'} of ${formattedAmount} has been added successfully.`,
          [
            {
              text: 'Add Another',
              onPress: () => {
                setAmount('');
                setDescription('');
                setSelectedCategory('food');
              }
            },
            {
              text: 'Done',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to save transaction. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTypeSelector = () => (
    <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>Transaction Type</Text>
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[styles.typeButton, selectedType === 'expense' && styles.typeButtonActiveExpense]}
          onPress={() => {
            setSelectedType('expense');
            setSelectedCategory('food');
          }}
        >
          <Icon
            name="minus-circle"
            size={24}
            color={selectedType === 'expense' ? 'white' : '#FF5252'}
          />
          <Text style={[
            styles.typeButtonText,
            selectedType === 'expense' && styles.typeButtonTextActive
          ]}>
            Expense
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeButton, selectedType === 'income' && styles.typeButtonActiveIncome]}
          onPress={() => {
            setSelectedType('income');
            setSelectedCategory('salary');
          }}
        >
          <Icon
            name="plus-circle"
            size={24}
            color={selectedType === 'income' ? 'white' : '#4CAF50'}
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
  );

  const renderAmountInput = () => (
    <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>Amount</Text>
      <View style={styles.amountInputContainer}>
        <Text style={styles.currencySymbol}>{'\u20B9'}</Text>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="rgba(255,255,255,0.5)"
          keyboardType="numeric"
          returnKeyType="next"
        />
      </View>
    </Animated.View>
  );

  const renderDescriptionInput = () => (
    <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>Description</Text>
      <TextInput
        style={styles.descriptionInput}
        value={description}
        onChangeText={setDescription}
        placeholder="Enter transaction description"
        placeholderTextColor="rgba(255,255,255,0.5)"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        returnKeyType="done"
      />
    </Animated.View>
  );

  const renderCategorySelector = () => {
    const selectedCategoryData = personalCategories[selectedType].find(cat => cat.id === selectedCategory);

    return (
      <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.sectionTitle}>Category</Text>
        <TouchableOpacity
          style={styles.categoryDropdown}
          onPress={() => setShowCategoryDropdown(true)}
        >
          <View style={styles.categoryDropdownContent}>
            <Icon
              name={selectedCategoryData?.icon || 'help-circle'}
              size={24}
              color="white"
            />
            <Text style={styles.categoryDropdownText}>
              {selectedCategoryData?.name || 'Select Category'}
            </Text>
          </View>
          <Icon name="chevron-down" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderCategoryModal = () => (
    <Modal
      visible={showCategoryDropdown}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowCategoryDropdown(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowCategoryDropdown(false)}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity
              onPress={() => setShowCategoryDropdown(false)}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={personalCategories[selectedType]}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.categoryModalItem,
                  selectedCategory === item.id && styles.categoryModalItemActive
                ]}
                onPress={() => {
                  setSelectedCategory(item.id);
                  setShowCategoryDropdown(false);
                }}
              >
                <View style={styles.categoryModalItemContent}>
                  <Icon
                    name={item.icon}
                    size={24}
                    color={selectedCategory === item.id ? 'white' : 'rgba(255,255,255,0.7)'}
                  />
                  <Text style={[
                    styles.categoryModalItemText,
                    selectedCategory === item.id && styles.categoryModalItemTextActive
                  ]}>
                    {item.name}
                  </Text>
                </View>
                {selectedCategory === item.id && (
                  <Icon name="check" size={20} color="white" />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

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
            <Text style={styles.headerTitle}>Add Transaction</Text>
            <Text style={styles.headerSubtitle}>
              Welcome, {userData?.fullName || 'User'}!
            </Text>
          </View>
          <View style={styles.placeholder} />
        </Animated.View>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {renderTypeSelector()}
            {renderAmountInput()}
            {renderDescriptionInput()}
            {renderCategorySelector()}

            <Animated.View style={[styles.submitSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="white" style={{ marginRight: 10 }} />
                    <Text style={styles.submitButtonText}>Adding...</Text>
                  </View>
                ) : (
                  <>
                    <Icon name="check-circle" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Add Transaction</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {renderCategoryModal()}
      </SafeAreaView>
    </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
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
  placeholder: {
    width: 40,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 15,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  typeButtonActiveExpense: {
    backgroundColor: '#FF5252',
    borderColor: '#FF5252',
  },
  typeButtonActiveIncome: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 8,
  },
  typeButtonTextActive: {
    color: 'white',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    paddingVertical: 15,
  },
  descriptionInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minHeight: 80,
  },
  categoryDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  categoryDropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDropdownText: {
    fontSize: 16,
    color: 'white',
    marginLeft: 12,
    fontWeight: '500',
  },
  submitSection: {
    marginTop: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
    elevation: 0,
    shadowOpacity: 0,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(10px)',
    borderRadius: 20,
    width: '100%',
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  categoryModalItemActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  categoryModalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryModalItemText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 12,
    fontWeight: '500',
  },
  categoryModalItemTextActive: {
    color: 'white',
  },
});