import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTransactions, useTransactionHistory } from '../../hooks/useTransactions';
import { PERIODS, periodRange, summarize, formatMoney, inRange, ledgerDate } from '../../utils/finance';
import MessageService from '../../services/MessageService';
import { FinanceAccount, FinancePage, Card, Copy, Button, Field, Choices, LoadState, EmptyState, Notice, LedgerOverview, TransactionRow, useFocusRefresh, useFinanceAction, styles } from './FinanceUI';

export default function FinanceHistoryScreen(props) { return <FinanceAccount component={History} {...props} />; }
function History({ navigation, company = false }) {
  const ledger = useTransactions();
  const history = useTransactionHistory(20);
  const [period, setPeriod] = useState('Monthly');
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const action = useFinanceAction();
  const refresh = useCallback(() => Promise.all([ledger.refresh(), history.refresh()]), [ledger.refresh, history.refresh]);
  useFocusRefresh(navigation, refresh);
  const range = periodRange(period);
  let stats, rows = [], calculationError;
  try {
    if (ledger.complete && !ledger.error) stats = summarize(ledger.transactions, range);
    rows = history.rows.filter(t => inRange(t.date || t.createdAt, range) && (type === 'all' || t.type === type) && `${t.description || ''} ${t.category || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
    rows.sort((a, b) => ledgerDate(b.date || b.createdAt).localeCompare(ledgerDate(a.date || a.createdAt)) || b.id.localeCompare(a.id));
  } catch (error) { calculationError = error.message; }
  const remove = entry => MessageService.showConfirm('Delete transaction', `Delete ${entry.description}?`, () => action.run(async notify => {
    const result = await ledger.deleteTransaction(entry.id);
    if (!result.success) throw new Error(result.error);
    await history.refresh();
    notify(result.refreshError ? `Deleted. Refresh failed: ${result.refreshError}` : 'Transaction deleted.');
  }));
  const goBack = () => company ? navigation?.goBack?.() : navigation?.navigate?.('Home');
  return <FinancePage title={company ? 'Company Transactions' : 'Transactions'} subtitle={company ? 'Your company’s financial activity' : 'Your income and expenses, in one place'} navigation={navigation} showBack onBack={goBack} onRefresh={refresh} refreshing={ledger.refreshing || history.loading}
    actions={<Button title="Add transaction" icon="plus" onPress={() => navigation.navigate(company ? 'AddCompanyTransactionDetail' : 'AddTransaction')} />}>
    <Choices values={[...PERIODS, 'Past Year', 'All Time']} selected={period} onSelect={setPeriod} />
    <Copy caption muted>{range.start} through {ledgerDate(new Date().toISOString())} · local dates · Monday weeks</Copy>
    <LoadState loading={!ledger.complete && !ledger.error} error={ledger.error || calculationError} onRetry={refresh} />
    {stats && !ledger.error && !calculationError && <Card><LedgerOverview stats={stats} company={company} title={`${period} Summary`} detail={`${stats.count} entries through today · complete ledger`}>
      <Copy caption muted>Average daily spending: {formatMoney(stats.avgDailySpending)}. Future entries excluded.</Copy>
    </LedgerOverview></Card>}
    <Card padding={16}><Field label="Search loaded history" icon="magnify" value={search} onChangeText={setSearch} maxLength={200} placeholder="Search description or category" autoCapitalize="none" />
      {!!search && <Button title="Clear search" icon="close" showLabel onPress={() => setSearch('')} />}
    </Card>
    <Choices values={[{ value: 'all', label: 'All' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expenses' }]} icons={{ all: 'format-list-bulleted', income: 'trending-up', expense: 'trending-down' }} selected={type} onSelect={setType} />
    <Copy caption muted>History loads 20 entries per request. Filters and search apply to the {history.rows.length} loaded entries; totals above use the complete ledger.</Copy>
    <Notice message={action.message} />
    <View style={styles.section}><View style={styles.rowBetween}><Copy heading>Transactions</Copy><Copy caption muted>{rows.length} matching · {history.rows.length} loaded</Copy></View>
      {rows.map((t, index) => <View key={t.id} style={{ gap: 10 }}>
        {(!index || ledgerDate(rows[index - 1].date || rows[index - 1].createdAt) !== ledgerDate(t.date || t.createdAt)) && <Copy caption muted style={{ fontWeight: '600' }}>{ledgerDate(t.date || t.createdAt)}</Copy>}
        <Card padding={16}><TransactionRow transaction={t} disabled={action.busy} onDelete={() => remove(t)} /></Card>
      </View>)}
      {!rows.length && !history.loading && !history.error && !calculationError && <Card><EmptyState title="No transactions found" description={history.hasMore ? 'No matches in the loaded pages. Load more to search older entries.' : search || type !== 'all' ? 'Try another search or filter.' : 'Add a transaction to start recording your financial activity.'} /></Card>}
    </View>
    <LoadState loading={history.loading} loadingLabel="Loading the next history page" error={history.error} onRetry={history.loadMore} />
    {history.hasMore && <Button title={history.loading ? 'Loading history…' : 'Load more history'} icon="chevron-down" showLabel disabled={history.loading} onPress={history.loadMore} />}
  </FinancePage>;
}
