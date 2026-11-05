import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import GlassCard from './GlassCard';
import { Icon } from '../constants/Icons';
import { useTheme } from '../contexts/ThemeContext';

const BudgetAdvisor = ({ recommendations, dataSignature, onDismiss }) => {
    if (!recommendations || recommendations.length === 0) return null;
    // Verified input changes remount memory-only dismissals; account switches
    // already remount the surrounding FinanceAccount component.
    return <BudgetInsightCards key={dataSignature ?? JSON.stringify(recommendations)} recommendations={recommendations} onDismiss={onDismiss} />;
};

const BudgetInsightCards = ({ recommendations, onDismiss }) => {
    const { theme, isDarkMode } = useTheme();
    const [dismissed, setDismissed] = useState([]);
    const visible = recommendations.filter(recommendation => !dismissed.includes(recommendation.id));
    const dark = isDarkMode ?? theme.isDarkMode;
    const lightSurface = !dark;
    const ink = theme.text;
    const muted = theme.textSecondary;

    if (visible.length === 0) {
        return null;
    }

    const getTypeColor = (type) => {
        switch (type) {
            case 'exceeded':
            case 'critical':
                return lightSurface ? '#B52E43' : '#FFB9C3';
            case 'warning':
                return lightSurface ? '#865200' : '#FFE1A3';
            case 'tip':
                return lightSurface ? '#157A45' : '#91F0B8';
            default:
                return lightSurface ? '#445CA0' : '#C7D7FF';
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'exceeded':
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
        <View style={styles.container} testID="budget-insights">
            <View style={styles.header}>
                <Icon name="calculator-variant-outline" size={22} color="white" />
                <Text accessibilityRole="header" style={styles.headerText}>Budget Insights</Text>
            </View>
            <Text style={styles.sourceNote}>Calculated on device • not AI-generated</Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {visible.map(recommendation => (
                    <GlassCard
                        key={recommendation.id}
                        style={[
                            styles.card,
                            { borderLeftColor: getTypeColor(recommendation.type) }
                        ]}
                        borderRadius={20}
                        padding={0}
                    >
                        <View style={styles.cardContent}>
                            <View style={styles.cardHeader}>
                                <View style={styles.titleRow}>
                                    <View style={[styles.iconContainer, { backgroundColor: `${getTypeColor(recommendation.type)}20` }]}>
                                        {recommendation.icon ? <Text style={styles.icon}>{recommendation.icon}</Text> : <Icon name={getTypeIcon(recommendation.type)} size={22} color={getTypeColor(recommendation.type)} />}
                                    </View>
                                    <View style={styles.titleContainer}>
                                        <Text style={[styles.title, { color: ink }]}>{recommendation.title}</Text>
                                        <Text style={[styles.message, { color: muted }]}>{recommendation.message}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel={`Dismiss ${recommendation.title} insight`}
                                    onPress={() => {
                                        setDismissed(ids => [...ids, recommendation.id]);
                                        onDismiss?.(recommendation.id);
                                    }}
                                    style={styles.dismissButton}
                                >
                                    <Icon name="close" size={20} color={muted} />
                                </TouchableOpacity>
                            </View>

                            {recommendation.suggestions && recommendation.suggestions.length > 0 && (
                                <View style={styles.suggestions}>
                                    {recommendation.suggestions.map((suggestion, idx) => (
                                        <View key={idx} style={styles.suggestionRow}>
                                            <Icon name="check-circle" size={14} color={getTypeColor(recommendation.type)} />
                                            <Text style={[styles.suggestionText, { color: muted }]}>{suggestion}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
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
        marginBottom: 4,
    },
    headerText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
        color: 'white',
    },
    sourceNote: {
        color: 'rgba(255,255,255,0.88)',
        fontSize: 12,
        lineHeight: 18,
        marginBottom: 12,
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
    cardContent: {
        padding: 16,
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
        minWidth: 48,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    message: {
        fontSize: 13,
        lineHeight: 19,
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
