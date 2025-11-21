import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function BudgetInsights({ categories, theme }) {
  if (!categories || categories.length === 0) {
    return null;
  }

  // Calculate insights
  const topSpendingCategory = categories.reduce((max, cat) =>
    cat.spent > max.spent ? cat : max, categories[0]);

  const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
  const averageSpent = totalSpent / categories.length;

  const categoriesOverBudget = categories.filter(cat => cat.percentage > 100).length;
  const categoriesWarning = categories.filter(cat => cat.percentage >= 75 && cat.percentage <= 100).length;

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Budget Insights</Text>

      {/* Top Spending Category */}
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <Icon name="trending-up" size={20} color={theme.primary} />
          <Text style={styles.insightLabel}>Top Spending</Text>
        </View>
        <View style={styles.insightContent}>
          <Text style={styles.insightValue}>{topSpendingCategory.name}</Text>
          <Text style={styles.insightAmount}>₹{topSpendingCategory.spent.toFixed(2)}</Text>
        </View>
      </View>

      {/* Average Spending */}
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <Icon name="chart-line" size={20} color={theme.success} />
          <Text style={styles.insightLabel}>Average per Category</Text>
        </View>
        <View style={styles.insightContent}>
          <Text style={styles.insightValue}>₹{averageSpent.toFixed(2)}</Text>
          <Text style={styles.insightSubtext}>Across {categories.length} categories</Text>
        </View>
      </View>

      {/* Budget Status Summary */}
      <View style={styles.statusGrid}>
        <View style={styles.statusCard}>
          <Icon name="check-circle" size={24} color="white" />
          <Text style={styles.statusValue}>{categories.length - categoriesOverBudget - categoriesWarning}</Text>
          <Text style={styles.statusLabel}>On Track</Text>
        </View>

        <View style={styles.statusCard}>
          <Icon name="alert" size={24} color="white" />
          <Text style={styles.statusValue}>{categoriesWarning}</Text>
          <Text style={styles.statusLabel}>Warning</Text>
        </View>

        <View style={styles.statusCard}>
          <Icon name="alert-circle" size={24} color="white" />
          <Text style={styles.statusValue}>{categoriesOverBudget}</Text>
          <Text style={styles.statusLabel}>Over Budget</Text>
        </View>
      </View>

      {/* Recommendation */}
      {categoriesOverBudget > 0 && (
        <View style={styles.recommendationCard}>
          <Icon name="lightbulb" size={20} color={theme.warning} />
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>Recommendation</Text>
            <Text style={styles.recommendationText}>
              {categoriesOverBudget} {categoriesOverBudget === 1 ? 'category is' : 'categories are'} over budget. Consider adjusting your spending or increasing the budget.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  insightCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  insightLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  insightContent: {
    marginLeft: 28,
  },
  insightValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  insightAmount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  insightSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statusCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
    marginBottom: 2,
  },
  statusLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  recommendationCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },
});
