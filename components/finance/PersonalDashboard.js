import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcons, Icon } from '../../constants/Icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTransactions } from '../../hooks/useTransactions';
import { useBudgets } from '../../hooks/useBudgets';
import { periodRange, summarize, formatMoney, sumMoney, subtractMoney, ledgerDate } from '../../utils/finance';
import { remoteProfileImage } from '../../utils/profileImage';
import { getBudgetRecommendations } from '../../utils/budgetRecommendations';
import GlassCard from '../GlassCard';
import BudgetAdvisor from '../BudgetAdvisor';
import { useFinanceCardColors, useFocusRefresh } from './FinanceUI';
import HomeAIEntry from './HomeAIEntry';

const HOME_PERIODS = [{ value: 'Weekly', label: 'Week' }, { value: 'Monthly', label: 'Month' }, { value: 'Yearly', label: 'Year' }];
const CATEGORY_ICONS = {
  food: 'hamburger', transport: 'car', shopping: 'shopping', entertainment: 'movie-open',
  bills: 'receipt', health: 'medical-bag', education: 'school', salary: 'cash',
  freelance: 'laptop', business: 'briefcase', investment: 'trending-up', gift: 'gift', other: 'help-circle',
};

function HomeAction({ title, icon, onPress }) {
  const colors = useFinanceCardColors();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} onPress={onPress} activeOpacity={0.85}
    style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Icon name={icon} size={20} color={colors.ink} />
    <Text style={[styles.actionText, { color: colors.ink }]}>{title}</Text>
  </TouchableOpacity>;
}

export default function PersonalDashboard({ navigation }) {
  const { theme } = useTheme();
  const colors = useFinanceCardColors();
  const { user, userData } = useAuth();
  const ledger = useTransactions();
  const budgets = useBudgets();
  const [period, setPeriod] = useState('Monthly');
  const refresh = useCallback(() => Promise.all([ledger.refresh(), budgets.refresh()]), [ledger.refresh, budgets.refresh]);
  useFocusRefresh(navigation, refresh);

  const now = new Date();
  const range = periodRange(period, now);
  const today = ledgerDate(now.toISOString());
  const ready = ledger.complete && budgets.complete && !ledger.error && !budgets.error;
  let data = null, calculationError;
  try {
    if (ready) {
      const stats = summarize(ledger.transactions, range);
      const spending = new Map(stats.categoryBreakdown.map(category => [category.name, category.amount]));
      const budgetRows = budgets.budgets.filter(budget => budget.period === period).map(budget => {
        const spent = spending.get(budget.category) || 0;
        return { ...budget, spent, remaining: subtractMoney(budget.amount, spent) };
      });
      const totalBudget = sumMoney(budgetRows, budget => budget.amount);
      const remainingBudget = subtractMoney(totalBudget, stats.totalExpenses);
      const recentTransactions = ledger.transactions.filter(transaction => ledgerDate(transaction.date || transaction.createdAt) < range.end)
        .slice(0, 5).map(transaction => ({ ...transaction, localDate: ledgerDate(transaction.date || transaction.createdAt) }));
      const recommendations = getBudgetRecommendations(ledger.transactions, budgets.budgets, { now });
      const insightSignature = JSON.stringify([today, ledger.transactions, budgets.budgets]);
      data = { stats, budgetRows, totalBudget, remainingBudget, recentTransactions, recommendations, insightSignature };
    }
  } catch (error) { calculationError = error.message || 'Unable to calculate financial totals.'; }
  const error = ledger.error || budgets.error || calculationError;
  const verified = ready && !error && data !== null;

  const { ink, muted, border: divider, income: incomeColor, expense: expenseColor } = colors;
  const backgroundColors = theme.pageGradientColors || (theme.isDarkMode ? [theme.background, theme.background] : [theme.primary, theme.primaryLight]);
  const periodLabel = HOME_PERIODS.find(option => option.value === period).label;
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const profileImageUri = remoteProfileImage(userData?.profileImageUri) || remoteProfileImage(user?.photoURL);

  return <View style={[styles.container, { backgroundColor: backgroundColors[0] }]} testID="personal-home">
    <StatusBar barStyle="light-content" backgroundColor={backgroundColors[0]} />
    <LinearGradient colors={backgroundColors} style={StyleSheet.absoluteFill} />
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{greeting}, {userData?.fullName || user?.displayName || 'User'}!</Text>
          <Text accessibilityRole="header" style={styles.welcome}>Welcome back</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Profile" style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
          {profileImageUri ? <Image source={{ uri: profileImageUri }} style={styles.profileImage} /> : <AppIcons.Profile size={40} color="white" />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={ledger.refreshing || budgets.refreshing} onRefresh={refresh} tintColor="white" colors={['white']} />}>
        <GlassCard testID="home-overview" borderRadius={28} borderWidth={1} padding={24}>
          <View style={styles.overviewHeader}>
            <Text accessibilityRole="header" style={[styles.overviewTitle, { color: ink }]}>{periodLabel} Balance</Text>
            <View style={[styles.periodToggle, { borderColor: divider, backgroundColor: colors.surface }]}>
              {HOME_PERIODS.map(option => <TouchableOpacity key={option.value} testID={`home-period-${option.value}`}
                accessibilityRole="button" accessibilityLabel={`${option.label} to-date overview`} accessibilityState={{ selected: period === option.value }}
                onPress={() => setPeriod(option.value)} activeOpacity={0.85}
                style={[styles.periodButton, period === option.value && { backgroundColor: colors.selected }]}>
                <Text style={[styles.periodText, { color: period === option.value ? ink : muted }]}>{option.label}</Text>
              </TouchableOpacity>)}
            </View>
          </View>
          <Text style={[styles.dateNote, { color: muted }]}>{range.start} through {today} · to date · local dates · Monday weeks</Text>
          {verified ? <>
            <Text testID="home-balance" style={[styles.balanceAmount, { color: ink }]}>{formatMoney(data.stats.netAmount)}</Text>
            <View style={styles.incomeExpenseRow}>
              <View style={styles.incomeExpenseItem}>
                <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}><AppIcons.Income size={22} color={incomeColor} /></View>
                <View style={styles.amountDetails}><Text style={[styles.amountLabel, { color: muted }]}>Income</Text><Text testID="home-income" style={[styles.amountValue, { color: incomeColor }]}>{formatMoney(data.stats.totalIncome)}</Text></View>
              </View>
              <View style={styles.incomeExpenseItem}>
                <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}><AppIcons.Expense size={22} color={expenseColor} /></View>
                <View style={styles.amountDetails}><Text style={[styles.amountLabel, { color: muted }]}>Expenses</Text><Text testID="home-expenses" style={[styles.amountValue, { color: expenseColor }]}>{formatMoney(data.stats.totalExpenses)}</Text></View>
              </View>
            </View>
            <View style={[styles.overviewFoot, { borderTopColor: divider }]}>
              <Text style={[styles.detailText, { color: muted }]}>{data.stats.count} entries · {range.days} calendar days</Text>
              <Text style={[styles.detailText, { color: muted }]}>Average daily spending: {formatMoney(data.stats.avgDailySpending)}</Text>
              {data.stats.count === 0 && <Text style={[styles.detailText, { color: muted }]}>No entries in this period.</Text>}
            </View>
          </> : <View style={styles.dataState}>
            {error ? <>
              <Text testID="home-data-error" accessibilityRole="alert" style={[styles.bodyText, { color: ink }]}>Unable to verify your financial data. {error}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry" onPress={refresh} style={[styles.retryButton, { borderColor: divider, backgroundColor: colors.surface }]}>
                <Text style={[styles.actionText, { color: ink }]}>Retry</Text>
              </TouchableOpacity>
            </> : <>
              <ActivityIndicator testID="home-data-loading" accessibilityLabel="Loading complete financial data" color={ink} />
              <Text style={[styles.bodyText, { color: muted }]}>Loading complete financial data…</Text>
            </>}
          </View>}
        </GlassCard>

        <HomeAIEntry navigation={navigation} />

        <View style={styles.section} testID="home-recent-transactions">
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="See all transactions" onPress={() => navigation.navigate('Transactions')} style={styles.sectionLink}>
              <Text style={styles.seeAllText}>See All</Text><Icon name="chevron-right" size={18} color="white" />
            </TouchableOpacity>
          </View>
          <GlassCard borderRadius={24} borderWidth={1} padding={5}>
            {verified ? data.recentTransactions.length ? data.recentTransactions.map(transaction => <View key={transaction.id} style={[styles.transactionItem, { borderBottomColor: divider }]}>
              <View style={[styles.transactionIcon, { backgroundColor: colors.surface }]}>
                <Icon name={CATEGORY_ICONS[transaction.category] || 'help-circle'} size={20} color={transaction.type === 'income' ? incomeColor : expenseColor} />
              </View>
              <View style={styles.transactionDetails}>
                <Text style={[styles.transactionDescription, { color: ink }]}>{transaction.description}</Text>
                <Text style={[styles.transactionCategory, { color: muted }]}>{transaction.category} · {transaction.localDate}</Text>
              </View>
              <Text style={[styles.transactionAmount, { color: transaction.type === 'income' ? incomeColor : expenseColor }]}>{transaction.type === 'income' ? '+' : '−'}{formatMoney(transaction.amount)}</Text>
            </View>) : <Text style={[styles.emptyText, { color: muted }]}>{ledger.transactions.length ? 'No transactions to date.' : 'No transactions yet. Add your first one!'}</Text>
              : <Text style={[styles.emptyText, { color: muted }]}>Recent transactions will appear after your complete financial data is verified.</Text>}
          </GlassCard>
        </View>
        {verified && <>
          <BudgetAdvisor recommendations={data.recommendations} dataSignature={data.insightSignature} />
          <View style={styles.actions}>
            <HomeAction title="Add transaction" icon="plus-circle-outline" onPress={() => navigation.navigate('AddTransaction')} />
            <HomeAction title="History" icon="history" onPress={() => navigation.navigate('Transactions')} />
            <HomeAction title="Budgets" icon="wallet-outline" onPress={() => navigation.navigate('Budget')} />
          </View>

          <View style={styles.section} testID="home-spending">
            <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>Spending by category</Text></View>
            <GlassCard borderRadius={24} borderWidth={1} padding={20}>
              {data.stats.categoryBreakdown.length ? data.stats.categoryBreakdown.slice().sort((a, b) => b.amount - a.amount).map(category => {
                const percentage = data.stats.totalExpenses ? category.amount / data.stats.totalExpenses * 100 : 0;
                return <View key={category.name} style={styles.categoryRow}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryName}><Icon name={CATEGORY_ICONS[category.name] || 'help-circle'} size={18} color={ink} /><Text style={[styles.bodyText, { color: ink }]}>{category.name}</Text></View>
                    <Text style={[styles.amountValue, { color: ink }]}>{formatMoney(category.amount)}</Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: divider }]}><View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: colors.accent }]} /></View>
                  <Text style={[styles.detailText, { color: muted }]}>{category.count} entries · {percentage.toFixed(1)}% of expenses</Text>
                </View>;
              }) : <Text style={[styles.bodyText, { color: muted }]}>No expenses in this period.</Text>}
            </GlassCard>
          </View>

          <View style={styles.section} testID="home-budget-check">
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Budget check</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Manage budgets" onPress={() => navigation.navigate('Budget')} style={styles.sectionLink}>
                <Text style={styles.seeAllText}>Manage</Text><Icon name="chevron-right" size={18} color="white" />
              </TouchableOpacity>
            </View>
            <GlassCard borderRadius={24} borderWidth={1} padding={20}>
              {!data.budgetRows.length ? <Text style={[styles.bodyText, { color: muted }]}>No {period.toLowerCase()} category budgets are set. Add budgets to compare spending.</Text> : <>
                <View style={styles.budgetTotals}>
                  <Text style={[styles.bodyText, { color: ink }]}>Budget: {formatMoney(data.totalBudget)} · Spent: {formatMoney(data.stats.totalExpenses)}</Text>
                  <Text style={[styles.budgetRemaining, { color: data.remainingBudget < 0 ? expenseColor : incomeColor }]}>Remaining: {formatMoney(data.remainingBudget)}</Text>
                </View>
                {data.budgetRows.map(budget => <View key={budget.id} style={[styles.budgetRow, { borderTopColor: divider }]}>
                  <Text style={[styles.bodyText, { color: ink }]}>{budget.category}: {formatMoney(budget.spent)} of {formatMoney(budget.amount)}{budget.spent > budget.amount ? ' — exceeded' : budget.spent === budget.amount ? ' — fully used' : ''}</Text>
                  <Text style={[styles.detailText, { color: muted }]}>Remaining: {formatMoney(budget.remaining)}</Text>
                </View>)}
                <Text style={[styles.budgetNote, { color: muted }]}>Comparison uses saved category budgets and all entries in the selected period.</Text>
              </>}
            </GlassCard>
          </View>
        </>}
      </ScrollView>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  headerText: { flex: 1 },
  greeting: { color: 'white', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  welcome: { color: 'white', fontSize: 24, fontWeight: '700', marginTop: 4 },
  profileButton: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' },
  profileImage: { width: 44, height: 44, borderRadius: 22 },
  // The tab bar floats over the screen; leave enough room to scroll the final action row clear of it.
  scrollContent: { paddingHorizontal: 20, paddingBottom: 180, gap: 24 },
  overviewHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  overviewTitle: { fontSize: 16, fontWeight: '600' },
  periodToggle: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 18, borderWidth: 1 },
  periodButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 14 },
  periodText: { fontSize: 12, fontWeight: '700' },
  dateNote: { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  balanceAmount: { fontSize: 40, fontWeight: '700', letterSpacing: 0.5, marginBottom: 24 },
  incomeExpenseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  incomeExpenseItem: { flex: 1, minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  amountDetails: { flex: 1 },
  amountLabel: { fontSize: 12, marginBottom: 4 },
  amountValue: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  overviewFoot: { borderTopWidth: 1, marginTop: 18, paddingTop: 14, gap: 4 },
  dataState: { minHeight: 150, justifyContent: 'center', alignItems: 'center', gap: 16, paddingVertical: 16 },
  bodyText: { fontSize: 15, lineHeight: 22 },
  detailText: { fontSize: 12, lineHeight: 18 },
  retryButton: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderRadius: 14 },
  section: { width: '100%' },
  sectionHeader: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  sectionTitle: { color: 'white', fontSize: 18, fontWeight: '600' },
  sectionLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8 },
  seeAllText: { color: 'white', fontSize: 14, fontWeight: '500' },
  transactionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderBottomWidth: 1 },
  transactionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  transactionDetails: { flex: 1 },
  transactionDescription: { fontSize: 16, lineHeight: 22, fontWeight: '500', marginBottom: 4 },
  transactionCategory: { fontSize: 12, lineHeight: 18 },
  transactionAmount: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '600', textAlign: 'right' },
  emptyText: { fontSize: 14, lineHeight: 22, padding: 24, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1 },
  actionText: { color: 'white', fontSize: 14, fontWeight: '600' },
  categoryRow: { marginBottom: 18 },
  categoryHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  categoryName: { flexDirection: 'row', flexShrink: 1, alignItems: 'center', gap: 8 },
  progressTrack: { height: 6, borderRadius: 3, marginVertical: 7, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  budgetTotals: { gap: 6, marginBottom: 6 },
  budgetRemaining: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  budgetRow: { borderTopWidth: 1, paddingVertical: 12, gap: 4 },
  budgetNote: { fontSize: 12, lineHeight: 18, marginTop: 12 },
});
