import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function AddBudgetModal({
  visible,
  onClose,
  onSave,
  editingBudget = null,
  period,
  theme,
}) {
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      // Pre-populate if editing
      if (editingBudget) {
        setAmount(editingBudget.amount.toString());
        setSelectedCategory(editingBudget.category);
      }
      // Slide up animation
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      // Slide down animation
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start();
      // Reset form after animation
      setTimeout(() => {
        setAmount('');
        setSelectedCategory('food');
      }, 250);
    }
  }, [visible, editingBudget]);

  const categories = [
    { id: 'food', name: 'Food & Dining', icon: 'food', color: '#FF9800' },
    { id: 'transport', name: 'Transportation', icon: 'car', color: '#2196F3' },
    { id: 'shopping', name: 'Shopping', icon: 'shopping', color: '#9C27B0' },
    { id: 'entertainment', name: 'Entertainment', icon: 'movie', color: '#FF5722' },
    { id: 'bills', name: 'Bills & Utilities', icon: 'receipt', color: '#607D8B' },
    { id: 'health', name: 'Healthcare', icon: 'medical-bag', color: '#4CAF50' },
  ];

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);

  const handleSave = () => {
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    onSave({
      category: selectedCategory,
      categoryName: selectedCategoryData.name,
      amount: parseFloat(amount),
      period,
    });
  };

  const styles = createStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={[theme.primary, theme.primaryLight]}
            style={styles.gradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {editingBudget ? 'Edit Budget' : 'Add Budget'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Category Selector */}
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                style={styles.categorySelector}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <View style={[styles.categoryIcon, { backgroundColor: `${selectedCategoryData.color}20` }]}>
                  <Icon name={selectedCategoryData.icon} size={24} color={selectedCategoryData.color} />
                </View>
                <Text style={styles.categoryText}>{selectedCategoryData.name}</Text>
                <Icon name="chevron-down" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              {/* Category Picker */}
              {showCategoryPicker && (
                <View style={styles.categoryPicker}>
                  <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryOption,
                          selectedCategory === category.id && styles.categoryOptionSelected
                        ]}
                        onPress={() => {
                          setSelectedCategory(category.id);
                          setShowCategoryPicker(false);
                        }}
                      >
                        <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                          <Icon name={category.icon} size={20} color={category.color} />
                        </View>
                        <Text style={styles.categoryOptionText}>{category.name}</Text>
                        {selectedCategory === category.id && (
                          <Icon name="check" size={20} color="white" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Amount Input */}
              <Text style={styles.label}>Budget Amount</Text>
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={theme.textLight}
                  keyboardType="numeric"
                  autoFocus={!editingBudget}
                />
              </View>

              {/* Period Info */}
              <View style={styles.periodInfo}>
                <Icon name="calendar" size={20} color={theme.primary} />
                <Text style={styles.periodText}>{period} Budget</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!amount || parseFloat(amount) <= 0) && styles.saveButtonDisabled
                ]}
                onPress={handleSave}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                <Text style={styles.saveButtonText}>
                  {editingBudget ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  gradient: {
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 12,
    marginTop: 8,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 8,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryText: {
    flex: 1,
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  categoryPicker: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    marginBottom: 16,
    maxHeight: 250,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  categoryOptionSelected: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  categoryOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    paddingVertical: 12,
  },
  periodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  periodText: {
    color: 'white',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    elevation: 0,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
});
