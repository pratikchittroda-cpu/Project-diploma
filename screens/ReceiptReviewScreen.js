import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    SafeAreaView,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useTransactions } from '../hooks/useTransactions';

const CATEGORIES = [
    { id: 'food', name: 'Food', icon: 'food', color: '#FF6B6B' },
    { id: 'transport', name: 'Transport', icon: 'car', color: '#4ECDC4' },
    { id: 'shopping', name: 'Shopping', icon: 'shopping', color: '#95E1D3' },
    { id: 'entertainment', name: 'Entertainment', icon: 'movie', color: '#F38181' },
    { id: 'bills', name: 'Bills', icon: 'receipt', color: '#AA96DA' },
    { id: 'health', name: 'Health', icon: 'medical-bag', color: '#FCBAD3' },
    { id: 'other', name: 'Other', icon: 'dots-horizontal', color: '#A8DADC' },
];

export default function ReceiptReviewScreen({ route, navigation }) {
    const { theme } = useTheme();
    const { addTransaction } = useTransactions();
    const { items: initialItems, merchant, date } = route.params;

    const [items, setItems] = useState(initialItems);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedItemIndex, setSelectedItemIndex] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleEditDescription = (index, value) => {
        const newItems = [...items];
        newItems[index].description = value;
        setItems(newItems);
    };

    const handleEditAmount = (index, value) => {
        const newItems = [...items];
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            newItems[index].amount = numValue;
        }
        setItems(newItems);
    };

    const handleSelectCategory = (index) => {
        setSelectedItemIndex(index);
        setShowCategoryModal(true);
    };

    const handleCategoryChange = (categoryId) => {
        if (selectedItemIndex !== null) {
            const newItems = [...items];
            newItems[selectedItemIndex].category = categoryId;
            setItems(newItems);
        }
        setShowCategoryModal(false);
        setSelectedItemIndex(null);
    };

    const handleRemoveItem = (index) => {
        Alert.alert(
            'Remove Item',
            'Are you sure you want to remove this item?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        const newItems = items.filter((_, i) => i !== index);
                        setItems(newItems);
                    },
                },
            ]
        );
    };

    const handleCreateTransactions = async () => {
        if (items.length === 0) {
            Alert.alert('No Items', 'Please add at least one item');
            return;
        }

        setIsCreating(true);

        try {
            // Create a transaction for each item
            for (const item of items) {
                await addTransaction({
                    amount: item.amount,
                    category: item.category,
                    description: item.description,
                    type: 'expense',
                    date: date,
                    notes: `From receipt: ${merchant}`,
                });
            }

            Alert.alert(
                'Success',
                `Created ${items.length} transaction${items.length > 1 ? 's' : ''}`,
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.navigate('Dashboard', { screen: 'Transactions' }),
                    },
                ]
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to create transactions');
        } finally {
            setIsCreating(false);
        }
    };

    const getCategoryInfo = (categoryId) => {
        return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
    };

    const styles = createStyles(theme);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[theme.primary, theme.primaryLight]}
                style={styles.background}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Icon name="arrow-left" size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Review Items</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Merchant & Date */}
                <View style={styles.infoCard}>
                    <Text style={styles.merchant}>{merchant || 'Unknown Merchant'}</Text>
                    <Text style={styles.date}>{date}</Text>
                </View>

                {/* Items List */}
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {items.map((item, index) => {
                        const categoryInfo = getCategoryInfo(item.category);
                        return (
                            <View key={index} style={styles.itemCard}>
                                <View style={styles.itemHeader}>
                                    <View style={[styles.categoryBadge, { backgroundColor: categoryInfo.color }]}>
                                        <Icon name={categoryInfo.icon} size={16} color="white" />
                                    </View>
                                    <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                                        <Icon name="close-circle" size={24} color="#FF6B6B" />
                                    </TouchableOpacity>
                                </View>

                                <TextInput
                                    style={styles.input}
                                    value={item.description}
                                    onChangeText={(value) => handleEditDescription(index, value)}
                                    placeholder="Item description"
                                    placeholderTextColor="#999"
                                />

                                <View style={styles.itemFooter}>
                                    <TouchableOpacity
                                        style={styles.categoryButton}
                                        onPress={() => handleSelectCategory(index)}
                                    >
                                        <Text style={styles.categoryButtonText}>{categoryInfo.name}</Text>
                                        <Icon name="chevron-down" size={16} color={theme.text} />
                                    </TouchableOpacity>

                                    <TextInput
                                        style={styles.amountInput}
                                        value={item.amount.toString()}
                                        onChangeText={(value) => handleEditAmount(index, value)}
                                        keyboardType="decimal-pad"
                                        placeholder="0.00"
                                        placeholderTextColor="#999"
                                    />
                                </View>

                                {item.quantity > 1 && (
                                    <Text style={styles.quantityText}>Qty: {item.quantity}</Text>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>

                {/* Create Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.createButton, isCreating && styles.createButtonDisabled]}
                        onPress={handleCreateTransactions}
                        disabled={isCreating}
                    >
                        <Text style={styles.createButtonText}>
                            {isCreating ? 'Creating...' : `Create ${items.length} Transaction${items.length > 1 ? 's' : ''}`}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Category Modal */}
            <Modal
                visible={showCategoryModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCategoryModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Category</Text>
                        {CATEGORIES.map((category) => (
                            <TouchableOpacity
                                key={category.id}
                                style={styles.categoryOption}
                                onPress={() => handleCategoryChange(category.id)}
                            >
                                <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
                                    <Icon name={category.icon} size={20} color="white" />
                                </View>
                                <Text style={styles.categoryOptionText}>{category.name}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setShowCategoryModal(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
        paddingVertical: 15,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    infoCard: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 20,
        marginBottom: 15,
        padding: 15,
        borderRadius: 12,
    },
    merchant: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 5,
    },
    date: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 0,
    },
    itemCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    categoryBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        fontSize: 16,
        color: theme.text,
        marginBottom: 10,
        paddingVertical: 5,
    },
    itemFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 5,
    },
    categoryButtonText: {
        fontSize: 14,
        color: theme.text,
    },
    amountInput: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
        textAlign: 'right',
        minWidth: 80,
    },
    quantityText: {
        fontSize: 12,
        color: '#666',
        marginTop: 5,
    },
    footer: {
        padding: 20,
    },
    createButton: {
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    createButtonDisabled: {
        opacity: 0.6,
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.primary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    categoryOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 15,
    },
    categoryIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryOptionText: {
        fontSize: 16,
    },
    cancelButton: {
        marginTop: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        color: '#666',
    },
});
