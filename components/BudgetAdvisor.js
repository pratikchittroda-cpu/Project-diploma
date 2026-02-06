import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import GlassCard from './GlassCard';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

const BudgetAdvisor = ({ recommendations, onDismiss }) => {
    const { theme } = useTheme();

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
                <Icon name="robot" size={22} color={theme.isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.95)'} />
                <Text style={[styles.headerText, { color: theme.isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.95)' }]}>AI Budget Advisor</Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {recommendations.map((recommendation, index) => (
                    <GlassCard
                        key={index}
                        style={[
                            styles.card,
                            { borderLeftColor: getTypeColor(recommendation.type) }
                        ]}
                        borderRadius={20}
                        padding={16}
                    >
                        <View style={styles.cardHeader}>
                            <View style={styles.titleRow}>
                                <View style={[styles.iconContainer, { backgroundColor: `${getTypeColor(recommendation.type)}20` }]}>
                                    <Text style={styles.icon}>{recommendation.icon}</Text>
                                </View>
                                <View style={styles.titleContainer}>
                                    <Text style={[styles.title, { color: 'white' }]}>{recommendation.title}</Text>
                                    <Text style={[styles.message, { color: 'rgba(255,255,255,0.85)' }]}>{recommendation.message}</Text>
                                </View>
                            </View>
                            {onDismiss && (
                                <TouchableOpacity
                                    onPress={() => onDismiss(index)}
                                    style={styles.dismissButton}
                                >
                                    <Icon name="close" size={18} color="rgba(255,255,255,0.7)" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {recommendation.suggestions && recommendation.suggestions.length > 0 && (
                            <View style={styles.suggestions}>
                                {recommendation.suggestions.map((suggestion, idx) => (
                                    <View key={idx} style={styles.suggestionRow}>
                                        <Icon name="check-circle" size={14} color={getTypeColor(recommendation.type)} />
                                        <Text style={[styles.suggestionText, { color: 'rgba(255,255,255,0.8)' }]}>{suggestion}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </GlassCard>
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
        marginBottom: 4,
    },
    dismissButton: {
        padding: 4,
    },
    message: {
        fontSize: 13,
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
        flex: 1,
        lineHeight: 16,
    },
});

export default BudgetAdvisor;

