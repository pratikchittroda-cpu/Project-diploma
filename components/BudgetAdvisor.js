import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const BudgetAdvisor = ({ recommendations, onDismiss }) => {
    if (!recommendations || recommendations.length === 0) {
        return null;
    }

    const getTypeColor = (type) => {
        switch (type) {
            case 'critical':
                return '#FF5252';
            case 'warning':
                return '#FF9800';
            case 'tip':
                return '#4CAF50';
            default:
                return '#2196F3';
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'critical':
                return 'alert-circle';
            case 'warning':
                return 'alert';
            case 'tip':
                return 'lightbulb-on';
            default:
                return 'information';
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Icon name="robot" size={20} color="rgba(255,255,255,0.9)" />
                <Text style={styles.headerText}>AI Budget Advisor</Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {recommendations.map((recommendation, index) => (
                    <View
                        key={index}
                        style={[
                            styles.card,
                            { borderLeftColor: getTypeColor(recommendation.type) }
                        ]}
                    >
                        <View style={styles.cardHeader}>
                            <View style={styles.titleRow}>
                                <View style={[styles.iconContainer, { backgroundColor: `${getTypeColor(recommendation.type)}20` }]}>
                                    <Text style={styles.icon}>{recommendation.icon}</Text>
                                </View>
                                <View style={styles.titleContainer}>
                                    <Text style={styles.title}>{recommendation.title}</Text>
                                    <Text style={styles.message}>{recommendation.message}</Text>
                                </View>
                            </View>
                            {onDismiss && (
                                <TouchableOpacity
                                    onPress={() => onDismiss(index)}
                                    style={styles.dismissButton}
                                >
                                    <Icon name="close" size={18} color="rgba(255,255,255,0.6)" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {recommendation.suggestions && recommendation.suggestions.length > 0 && (
                            <View style={styles.suggestions}>
                                {recommendation.suggestions.map((suggestion, idx) => (
                                    <View key={idx} style={styles.suggestionRow}>
                                        <Icon name="check-circle" size={14} color={getTypeColor(recommendation.type)} />
                                        <Text style={styles.suggestionText}>{suggestion}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
        marginLeft: 8,
    },
    scrollView: {
        marginLeft: -20,
        marginRight: -20,
    },
    scrollContent: {
        paddingHorizontal: 20,
        gap: 12,
    },
    card: {
        width: 300,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderLeftWidth: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
        gap: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        fontSize: 20,
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: 'white',
        marginBottom: 4,
    },
    dismissButton: {
        padding: 4,
    },
    message: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
    },
    suggestions: {
        marginTop: 8,
        gap: 6,
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    suggestionText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        flex: 1,
        lineHeight: 16,
    },
});

export default BudgetAdvisor;

