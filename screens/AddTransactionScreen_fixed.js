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

export default function AddTransactionScreen({ navigation }) {
    const { theme, isLoading } = useTheme();
    const { user } = useAuth();
    const { addTransaction } = useTransactions();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('food');
    const [selectedType, setSelectedType] = useState('expense');
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                    }

                Alert.alert(
                    'Success!',
                    `${selectedType === 'income' ? 'Income' : 'Expense'} of $${parseFloat(amount).toFixed(2)} has been added successfully.`,
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
                    style={[styles.typeButton, selectedType === 'expense' && styles.typeButtonActive]}
                    onPress={() => {
                        setSelectedType('expense');
                        setSelectedCategory('food');
                    }}
                >
                    <Icon
                        name="minus-circle"
                        size={24}
                        color={selectedType === 'expense' ? 'white' : theme.error}
                    />
                    <Text style={[
                        styles.typeButtonText,
                        selectedType === 'expense' && styles.typeButtonTextActive
                    ]}>
                        Expense
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.typeButton, selectedType === 'income' && styles.typeButtonActive]}
                    onPress={() => {
                        setSelectedType('income');
                        setSelectedCategory('salary');
                    }}
                >
                    <Icon
                        name="plus-circle"
                        size={24}
                        color={selectedType === 'income' ? 'white' : theme.success}
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
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={theme.textLight}
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
                placeholderTextColor={theme.textLight}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                returnKeyType="done"
            />
        </Animated.View>
    );

    const renderCategorySelector = () => (
        <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.categoryGrid}>
                {personalCategories[selectedType].map((category) => (
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
                            size={24}
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
    );

    const styles = createStyles(theme);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Transaction</Text>
                <View style={styles.placeholder} />
            </Animated.View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
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
                        <LinearGradient
                            colors={isSubmitting ? [theme.textLight, theme.textLight] : [theme.primary, theme.primaryLight]}
                            style={styles.submitGradient}
                        >
                            {isSubmitting ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="small" color="white" style={{ marginRight: 10 }} />
                                    <Text style={styles.submitButtonText}>Adding...</Text>
                                </View>
                            ) : (
                                <Text style={styles.submitButtonText}>Add Transaction</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
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
        paddingVertical: 15,
        paddingHorizontal: 20,
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
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        borderRadius: 12,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: theme.border,
    },
    currencySymbol: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.primary,
        marginRight: 10,
    },
    amountInput: {
        flex: 1,
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.text,
        paddingVertical: 15,
    },
    descriptionInput: {
        backgroundColor: theme.cardBackground,
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        color: theme.text,
        borderWidth: 1,
        borderColor: theme.border,
        minHeight: 80,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    categoryButton: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        borderRadius: 12,
        padding: 15,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    categoryButtonActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    categoryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text,
        marginLeft: 10,
        flex: 1,
    },
    categoryButtonTextActive: {
        color: 'white',
    },
    submitSection: {
        marginTop: 20,
    },
    submitButton: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    submitButtonDisabled: {
        elevation: 0,
        shadowOpacity: 0,
    },
    submitGradient: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});