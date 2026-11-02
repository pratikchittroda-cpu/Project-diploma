import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTransactions } from '../../hooks/useTransactions';
import { useBudgets } from '../../hooks/useBudgets';
import { PERIODS, PERSONAL_EXPENSES, COMPANY_EXPENSES, periodRange, summarize, formatMoney, parseMoney, sumMoney, subtractMoney, daysBetween, localDate } from '../../utils/finance';
import { getBudgetRecommendations } from '../../utils/budgetRecommendations';
import BudgetAdvisor from '../BudgetAdvisor';
import MessageService from '../../services/MessageService';
import { FinanceAccount, FinancePage, Card, Copy, Button, Field, Choices, CategoryChoices, LoadState, EmptyState, Notice, Metric, ProgressRing, BudgetProgress, categoryDetails, useFocusRefresh, useFinanceAction, styles } from './FinanceUI';

export default function FinanceBudgetScreen(props) { return <FinanceAccount component={Budget} {...props} />; }
function Budget({ navigation, company = false }) {
  const ledger = useTransactions();
  const budgets = useBudgets();
  const [period, setPeriod] = useState('Monthly');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(company ? 'office-supplies' : 'food');
  const [amount, setAmount] = useState('');
  const action = useFinanceAction();
  const scrollRef = useRef(null);
  useEffect(() => { if (action.message) scrollRef.current?.scrollTo({ y: 0, animated: true }); }, [action.message]);
  const refresh = useCallback(() => Promise.all([ledger.refresh(), budgets.refresh()]), [ledger.refresh, budgets.refresh]);
  useFocusRefresh(navigation, refresh);
  const ready = ledger.complete && budgets.complete && !ledger.error && !budgets.error;
  const now = new Date();
  const range = periodRange(period, now);
  let stats, rows = [], totalBudget = 0, unbudgeted = 0, recommendations = [], insightSignature, calculationError;
  try {
    if (ready) {
      stats = summarize(ledger.transactions, range);
      const spending = new Map(stats.categoryBreakdown.map(c => [c.name, c.amount]));
      rows = budgets.budgets.filter(b => b.period === period).map(b => { const spent = spending.get(b.category) || 0; return { ...b, spent, remaining: subtractMoney(b.amount, spent) }; });
      totalBudget = sumMoney(rows, b => b.amount);
      unbudgeted = sumMoney(stats.categoryBreakdown.filter(c => !rows.some(b => b.category === c.name)), c => c.amount);
      recommendations = getBudgetRecommendations(ledger.transactions, budgets.budgets, { now });
      insightSignature = JSON.stringify([localDate(now), ledger.transactions, budgets.budgets]);
    }
  } catch (error) { calculationError = error.message; }
  const error = ledger.error || budgets.error || calculationError;
  const open = budget => { setEditing(budget || null); setCategory(budget?.category || (company ? 'office-supplies' : 'food')); setAmount(budget ? String(budget.amount) : ''); setShowForm(true); scrollRef.current?.scrollTo({ y: 0, animated: true }); };
  const save = () => action.run(async notify => {
    const fields = { category, amount: parseMoney(amount), period: editing?.period || period, type: company ? 'company' : 'personal', categoryName: categoryDetails(category).label };
    const result = editing ? await budgets.updateBudget(editing.id, fields) : await budgets.createBudget(fields);
    if (!result.success) throw new Error(result.error);
    setShowForm(false); setEditing(null); setAmount('');
    notify(result.refreshError ? `Saved in all periods. Refresh failed: ${result.refreshError}` : 'Budget saved in all three periods.');
  });
  const remove = budget => MessageService.showConfirm('Remove category budget', `Archive ${categoryDetails(budget.category).label} in all three periods? Legacy records are retained but will no longer count toward budgets.`, () => action.run(async notify => {
    const result = await budgets.deleteBudget(budget.id);
    if (!result.success) throw new Error(result.error);
    notify(result.refreshError ? `Removed. Refresh failed: ${result.refreshError}` : 'Category budget removed from all periods.');
  }));
  return <FinancePage title={company ? 'Company Budget' : 'Budget'} subtitle="Set category limits. Keep spending in view." navigation={navigation} scrollRef={scrollRef} onRefresh={refresh} refreshing={ledger.refreshing || budgets.refreshing}
    actions={<Button title="Add budget" icon="plus" disabled={action.busy || !ready || !!error} onPress={() => open()} />}>
    <Choices values={PERIODS} selected={period} disabled={action.busy} onSelect={value => { setPeriod(value); setShowForm(false); setEditing(null); }} />
    <LoadState loading={!ready && !error} error={error} onRetry={refresh} />
    <Notice message={action.message} />
    {ready && !error && <>
      {showForm && <Card><View style={styles.rowBetween}><Copy heading>{editing ? 'Edit Budget' : 'Add Budget'}</Copy><Button title="Close budget form" icon="close" disabled={action.busy} onPress={() => setShowForm(false)} /></View>
        <Field label={`${editing?.period || period} amount (INR)`} prefix="₹" large value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={14} placeholder="0.00" editable={!action.busy} />
        <Copy style={{ fontWeight: '600' }}>Choose a category</Copy><CategoryChoices values={company ? COMPANY_EXPENSES : PERSONAL_EXPENSES} selected={category} onSelect={setCategory} disabled={action.busy} />
        <Copy caption muted>Saving updates all periods atomically, using 52 weeks / 12 months per year and rounding to paise. Changing category moves all three periods. An existing target category is replaced.</Copy>
        <Button title={action.busy ? 'Saving…' : 'Save all periods'} icon="check-circle-outline" showLabel variant="primary" disabled={action.busy} onPress={save} /><Button title="Cancel" disabled={action.busy} onPress={() => setShowForm(false)} />
      </Card>}
      <Card><View style={styles.rowBetween}><Copy heading>{period} Budget</Copy><Copy caption muted>{rows.length} saved categories</Copy></View>
        <Copy caption muted>{range.start} through {localDate()} · local dates · Monday weeks</Copy><ProgressRing value={stats.totalExpenses} max={totalBudget} />
        <View style={styles.grid}><Metric label="Saved budget" value={formatMoney(totalBudget)} icon="wallet-outline" /><Metric label="Spent to date" value={formatMoney(stats.totalExpenses)} icon="arrow-up-circle" tone="expense" /></View>
        <Metric label="Remaining after all expenses" value={formatMoney(subtractMoney(totalBudget, stats.totalExpenses))} tone={stats.totalExpenses > totalBudget ? 'expense' : 'income'} />
        <Copy caption muted>{daysBetween(localDate(), range.periodEnd)} days including today remain · {stats.count} entries</Copy><Copy caption muted>Spending without a category budget: {formatMoney(unbudgeted)}</Copy>
      </Card>
      <View style={styles.section}><View style={styles.rowBetween}><Copy heading>Category Budgets</Copy>{!showForm && <Button title="Add budget" icon="plus" showLabel disabled={action.busy} onPress={() => open()} />}</View>
        {!rows.length && <Card><EmptyState title="No budgets set for this period" description="Choose a category and set your first spending limit." icon="wallet-plus-outline"><Button title="Create first budget" icon="plus" showLabel disabled={action.busy} onPress={() => open()} /></EmptyState></Card>}
        {rows.map(b => <Card key={b.id}><BudgetProgress budget={b} />
          <Metric label="Remaining" value={formatMoney(b.remaining)} tone={b.remaining < 0 ? 'expense' : 'income'} />
          <View style={styles.row}><Button title="Edit" label={`Edit ${categoryDetails(b.category).label}`} icon="pencil-outline" showLabel disabled={action.busy} onPress={() => open(b)} /><Button title="Remove" label={`Remove ${categoryDetails(b.category).label}`} icon="trash-can-outline" showLabel variant="danger" disabled={action.busy} onPress={() => remove(b)} /></View>
        </Card>)}
      </View>
      <BudgetAdvisor recommendations={recommendations} dataSignature={insightSignature} />
    </>}
  </FinancePage>;
}
