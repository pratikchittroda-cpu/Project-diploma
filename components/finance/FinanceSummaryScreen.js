import React, { useCallback, useState } from 'react';
import { View, ScrollView, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Icon } from '../../constants/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTransactions } from '../../hooks/useTransactions';
import { useBudgets } from '../../hooks/useBudgets';
import { PERIODS, periodRange, summarize, formatMoney, sumMoney, subtractMoney, ledgerDate, localDate, addDays, inRange, parseDateOnly } from '../../utils/finance';
import { remoteProfileImage } from '../../utils/profileImage';
import HomeAIEntry from './HomeAIEntry';
import { FinanceAccount, FinancePage, Card, Copy, Button, Choices, LoadState, EmptyState, Metric, LedgerOverview, TransactionRow, BudgetProgress, ProgressBar, categoryDetails, useFinanceColors, useFocusRefresh, styles } from './FinanceUI';

function buildTrend(transactions, range, period) {
  const buckets = [];
  let start = range.start;
  while (start < range.end) {
    const date = parseDateOnly(start);
    const boundary = period === 'Weekly' || period === 'Monthly' ? addDays(start, period === 'Weekly' ? 1 : 7 - ((date.getDay() + 6) % 7)) : localDate(new Date(date.getFullYear(), date.getMonth() + 1, 1, 12));
    const end = boundary < range.end ? boundary : range.end;
    const label = period === 'Weekly' ? date.toLocaleDateString('en-IN', { weekday: 'short' }) : period === 'Monthly' ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : date.toLocaleDateString('en-IN', { month: 'short', ...(period === 'Past Year' ? { year: '2-digit' } : {}) });
    const rows = transactions.filter(t => inRange(t.date || t.createdAt, { start, end }));
    buckets.push({ label, income: sumMoney(rows.filter(t => t.type === 'income'), t => t.amount), expense: sumMoney(rows.filter(t => t.type === 'expense'), t => t.amount) });
    start = end;
  }
  return buckets;
}

export default function FinanceSummaryScreen(props) { return <FinanceAccount component={Summary} {...props} />; }
function Summary({ navigation, company = false, report = false }) {
  const { userData } = useAuth();
  const ledger = useTransactions();
  const budgets = useBudgets();
  const [period, setPeriod] = useState('Monthly');
  const refresh = useCallback(() => Promise.all([ledger.refresh(), budgets.refresh()]), [ledger.refresh, budgets.refresh]);
  useFocusRefresh(navigation, refresh);
  const ready = ledger.complete && budgets.complete && !ledger.error && !budgets.error;
  let stats, budgetRows = [], totalBudget = 0, trend = [], departments = [], recent = [], calculationError;
  const range = periodRange(period);
  try {
    if (ready) {
      stats = summarize(ledger.transactions, range);
      const spending = new Map(stats.categoryBreakdown.map(c => [c.name, c.amount]));
      budgetRows = budgets.budgets.filter(b => b.period === period).map(b => ({ ...b, spent: spending.get(b.category) || 0 }));
      totalBudget = sumMoney(budgetRows, b => b.amount);
      if (report) trend = buildTrend(ledger.transactions, range, period);
      const departmentRows = new Map();
      for (const row of ledger.transactions.filter(t => t.type === 'expense' && inRange(t.date || t.createdAt, range))) {
        const name = row.department || 'General';
        if (!departmentRows.has(name)) departmentRows.set(name, []);
        departmentRows.get(name).push(row);
      }
      departments = [...departmentRows].map(([name, entries]) => ({ name, spent: sumMoney(entries, t => t.amount), count: entries.length })).sort((a, b) => b.spent - a.spent);
      recent = ledger.transactions.filter(t => ledgerDate(t.date || t.createdAt) < range.end).slice().sort((a, b) => ledgerDate(b.date || b.createdAt).localeCompare(ledgerDate(a.date || a.createdAt)) || b.id.localeCompare(a.id)).slice(0, 5);
    }
  } catch (error) { calculationError = error.message; }
  const error = ledger.error || budgets.error || calculationError;
  const title = report ? (company ? 'Company Reports' : 'Statistics') : (company ? 'Welcome back' : 'Dashboard');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const profileImage = remoteProfileImage(userData?.companyLogoUri) || remoteProfileImage(userData?.profileImageUri);
  const subtitle = report ? (company ? 'Revenue, expenses and net cash flow' : 'A clearer view of your finances') : company ? `${greeting}, ${userData?.companyName || 'Company'}!` : 'Your finances at a glance';
  const add = () => navigation.navigate(company ? 'AddCompanyTransactionDetail' : 'AddTransaction');
  return <FinancePage title={title} subtitle={subtitle} navigation={navigation} showBack={report} onRefresh={refresh} refreshing={ledger.refreshing || budgets.refreshing}
    actions={!report && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Profile" onPress={() => navigation.navigate(company ? 'CompanyProfile' : 'Profile')} style={summaryStyles.profile}>
      {profileImage ? <Image source={{ uri: profileImage }} style={summaryStyles.profileImage} /> : <Icon name="account-circle-outline" size={36} color="white" />}
    </TouchableOpacity>}>
    <Choices values={report ? [...PERIODS, 'Past Year'] : PERIODS} selected={period} onSelect={setPeriod} />
    <Copy caption muted>{range.start} through {localDate()} · to date · local dates · Monday weeks</Copy>
    <LoadState loading={!ready && !error} error={error} onRetry={refresh} />
    {ready && !error && <>
      {report ? <>
        <View style={styles.grid}><Card style={styles.metricCard} padding={18}><Metric label={company ? 'Revenue' : 'Income'} value={formatMoney(stats.totalIncome)} icon="arrow-down-circle" tone="income" /></Card>
          <Card style={styles.metricCard} padding={18}><Metric label="Expenses" value={formatMoney(stats.totalExpenses)} icon="arrow-up-circle" tone="expense" /></Card></View>
        <Card><ReportNet stats={stats} company={company} days={range.days} /></Card>
        <Card><Copy heading>{company ? 'Financial Performance' : 'Expense Trend'}</Copy><Copy caption muted>{period === 'Monthly' ? 'Monday-based weeks within this month, through today.' : period === 'Weekly' ? 'This Monday-based week, through today.' : 'Calendar months within the selected period, through today.'}</Copy>
          {stats.count ? <TrendChart data={trend} company={company} /> : <EmptyState title="No trend data yet" description="Add entries to see your income and expense trend for this period." icon="chart-line" />}
        </Card>
      </> : <Card><LedgerOverview stats={stats} company={company} title={`${period} net balance`} detail={`${stats.count} entries · ${range.days} calendar days`}>
        <Copy caption muted>Average daily spending: {formatMoney(stats.avgDailySpending)}</Copy>{stats.count === 0 && <Copy caption muted>No entries in this period.</Copy>}
      </LedgerOverview></Card>}
    </>}
    {!report && <HomeAIEntry navigation={navigation} />}
    {ready && !error && <>
      {!report && <View style={styles.row}>
        <Button title="Add transaction" icon="plus-circle-outline" showLabel onPress={add} /><Button title="History" icon="history" showLabel onPress={() => navigation.navigate(company ? 'CompanyTransactions' : 'Transactions')} />
        <Button title="Budgets" icon="wallet-outline" showLabel onPress={() => navigation.navigate(company ? 'CompanyBudgetDetail' : 'Budget')} />
        {company && <Button title="Team" icon="account-group-outline" showLabel onPress={() => navigation.navigate('TeamManagementDetail')} />}
      </View>}
      <View style={styles.section}><Copy heading>Spending by Category</Copy><Card><CategoryChart categories={stats.categoryBreakdown} total={stats.totalExpenses} /></Card></View>
      {company && report && <View style={styles.section}><Copy heading>Department Analysis</Copy><Card>
        {departments.length ? <><Copy caption muted>Actual ledger expenses by department. Bars show each department’s share of total expenses.</Copy>
          {departments.map(department => <DepartmentExpense key={department.name} department={department} total={stats.totalExpenses} />)}</> : <EmptyState title="No department expenses" description="Department details appear when company expenses are recorded." icon="office-building-outline" />}
      </Card></View>}
      {period !== 'Past Year' && <View style={styles.section}><Copy heading>Budget Check</Copy><Card>
        {!budgetRows.length ? <EmptyState title="No category budgets yet" description={`Add ${period.toLowerCase()} budgets to compare your actual spending.`} icon="wallet-outline" /> : <>
          <View style={styles.grid}><Metric label="Saved budget" value={formatMoney(totalBudget)} /><Metric label="Total spent" value={formatMoney(stats.totalExpenses)} tone="expense" /></View>
          <Metric label="Remaining after all expenses" value={formatMoney(subtractMoney(totalBudget, stats.totalExpenses))} tone={stats.totalExpenses > totalBudget ? 'expense' : 'income'} />
          {budgetRows.map(budget => <BudgetProgress key={budget.id} budget={budget} />)}
          <Copy caption muted>Comparison uses saved category budgets and all entries in the selected period.</Copy>
        </>}
      </Card></View>}
      {!report && <View style={styles.section}><View style={styles.rowBetween}><Copy heading>Recent Transactions</Copy><Button title="See all" icon="chevron-right" showLabel onPress={() => navigation.navigate(company ? 'CompanyTransactions' : 'Transactions')} /></View>
        <Card>{recent.length ? recent.map(t => <TransactionRow key={t.id} transaction={t} />) : <EmptyState title="No transactions yet" description="Add your first transaction to start your ledger." />}</Card>
      </View>}
    </>}
  </FinancePage>;
}

function ReportNet({ stats, company, days }) {
  const colors = useFinanceColors();
  const rate = stats.totalIncome > 0 ? stats.netAmount / stats.totalIncome * 100 : null;
  return <View style={{ gap: 12 }}><View style={styles.rowBetween}><Copy muted>{company ? 'Net Cash Flow' : 'Net Savings'}</Copy>
    {rate !== null && <View style={[styles.badge, { backgroundColor: colors.surface }]}><Copy caption style={{ color: stats.netAmount < 0 ? colors.expense : colors.income }}>{rate.toFixed(1)}% {company ? 'net margin' : 'savings rate'}</Copy></View>}
  </View><Copy style={styles.amount}>{formatMoney(stats.netAmount)}</Copy><View style={[styles.divider, { borderTopColor: colors.border }]}>
    <Copy caption muted>{stats.count} entries · {days} calendar days · complete ledger</Copy><Copy caption muted>Average daily spending: {formatMoney(stats.avgDailySpending)}</Copy>
  </View></View>;
}

function compactMoney(value) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return formatMoney(value);
}

function TrendChart({ data, company }) {
  const { width } = useWindowDimensions();
  const colors = useFinanceColors();
  const maximum = Math.max(0, ...data.map(point => Math.max(point.expense, company ? point.income : 0)));
  if (!data.length || maximum === 0) return <EmptyState title={company ? 'No financial activity' : 'No expenses in this period'} description="The chart uses only your recorded entries." icon="chart-line" />;
  const chartWidth = Math.max(240, width - 80, data.length * 48 + 54);
  const height = 208, left = 48, right = chartWidth - 14, top = 14, bottom = 169;
  const x = index => data.length === 1 ? (left + right) / 2 : left + index * (right - left) / (data.length - 1);
  const y = amount => bottom - amount / maximum * (bottom - top);
  const line = key => data.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point[key])}`).join(' ');
  const description = data.map(point => `${point.label}: ${company ? `revenue ${formatMoney(point.income)}, ` : ''}expenses ${formatMoney(point.expense)}`).join('; ');
  return <View style={{ gap: 12 }}><ScrollView horizontal showsHorizontalScrollIndicator={data.length > 6} contentContainerStyle={{ paddingBottom: 4 }}>
    <Svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`} accessible accessibilityRole="image" accessibilityLabel={description}>
      {(maximum < 0.1 ? [0, 1] : [0, 0.5, 1]).map(tick => <React.Fragment key={tick}><Line x1={left} y1={y(maximum * tick)} x2={right} y2={y(maximum * tick)} stroke={colors.border} strokeDasharray="4 4" /><SvgText x={left - 6} y={y(maximum * tick) + 4} textAnchor="end" fill={colors.muted} fontSize={10}>{compactMoney(maximum * tick)}</SvgText></React.Fragment>)}
      {company && <Path d={line('income')} stroke={colors.income} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
      <Path d={line('expense')} stroke={colors.expense} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((point, index) => <React.Fragment key={`${point.label}-${index}`}>
        {company && <Circle cx={x(index)} cy={y(point.income)} r={3.5} fill={colors.income} />}
        <Circle cx={x(index)} cy={y(point.expense)} r={3.5} fill={colors.expense} />
        <SvgText x={x(index)} y={bottom + 22} textAnchor="middle" fill={colors.muted} fontSize={10}>{point.label}</SvgText>
      </React.Fragment>)}
    </Svg>
  </ScrollView><View style={styles.row}>{company && <View style={styles.row}><View style={[summaryStyles.legendDot, { backgroundColor: colors.income }]} /><Copy caption muted>Revenue</Copy></View>}
    <View style={styles.row}><View style={[summaryStyles.legendDot, { backgroundColor: colors.expense }]} /><Copy caption muted>Expenses</Copy></View>
  </View>{data.length > 6 && <Copy caption muted>Swipe the chart to view every interval.</Copy>}</View>;
}

function CategoryChart({ categories, total }) {
  const colors = useFinanceColors();
  const rows = categories.slice().sort((a, b) => b.amount - a.amount);
  if (!rows.length || total <= 0) return <EmptyState title="No expenses in this period" description="Your category breakdown will appear as you record expenses." icon="chart-donut" />;
  const circumference = 2 * Math.PI * 66;
  const lightColors = ['#BA7623', '#297CAE', '#AA4082', '#7450AD', '#B74C46', '#267C5E', '#446A9B'];
  let offset = 0;
  const slices = rows.map((row, index) => {
    const percentage = row.amount / total;
    const slice = { ...row, ...categoryDetails(row.name), color: colors.light ? lightColors[index % lightColors.length] : categoryDetails(row.name).color, length: circumference * percentage, offset, percentage };
    offset += slice.length;
    return slice;
  });
  return <View style={{ gap: 18 }}><View style={summaryStyles.donut}>
    <Svg width={180} height={180} viewBox="0 0 180 180" style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel={`Spending by category, total ${formatMoney(total)}`}>
      <Circle cx={90} cy={90} r={66} fill="none" stroke={colors.border} strokeWidth={20} />
      {slices.map(slice => <Circle key={slice.name} cx={90} cy={90} r={66} fill="none" stroke={slice.color} strokeWidth={20} strokeDasharray={`${slice.length} ${circumference}`} strokeDashoffset={-slice.offset} transform="rotate(-90 90 90)" />)}
    </Svg><View style={summaryStyles.donutText}><Copy caption muted>Total expenses</Copy><Copy style={{ fontSize: 17, lineHeight: 24, fontWeight: '700', textAlign: 'center' }}>{formatMoney(total)}</Copy></View>
  </View>{slices.map(slice => <View key={slice.name} style={{ gap: 7 }}><View style={styles.rowBetween}>
    <View style={[styles.row, { flex: 1, minWidth: 110 }]}><View style={[summaryStyles.legendDot, { backgroundColor: slice.color }]} /><Icon name={slice.icon} size={18} color={colors.ink} /><Copy style={{ flexShrink: 1, fontWeight: '600' }}>{slice.label}</Copy></View>
    <Copy style={{ fontWeight: '600' }}>{formatMoney(slice.amount)}</Copy>
  </View><ProgressBar value={slice.amount} max={total} color={slice.color} label={`${slice.label} share of expenses`} /><Copy caption muted>{slice.count} entries · {(slice.percentage * 100).toFixed(1)}% of expenses</Copy></View>)}</View>;
}

function DepartmentExpense({ department, total }) {
  const colors = useFinanceColors();
  return <View style={{ gap: 8 }}><View style={styles.rowBetween}><View style={[styles.row, { flex: 1, minWidth: 110 }]}><Icon name="office-building-outline" size={20} color={colors.accent} /><Copy style={{ fontWeight: '600', flexShrink: 1 }}>{department.name}</Copy></View><Copy>{formatMoney(department.spent)}</Copy></View>
    <ProgressBar value={department.spent} max={total} color={colors.accent} label={`${department.name} share of expenses`} /><Copy caption muted>{department.count} entries · {total > 0 ? (department.spent / total * 100).toFixed(1) : '0.0'}% of expenses</Copy>
  </View>;
}

const summaryStyles = StyleSheet.create({
  profile: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  profileImage: { width: 44, height: 44, borderRadius: 22 }, legendDot: { width: 9, height: 9, borderRadius: 5 },
  donut: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  donutText: { width: 114, gap: 4, alignItems: 'center' },
});
