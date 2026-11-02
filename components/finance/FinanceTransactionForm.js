import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../config/firebase';
import { PERSONAL_EXPENSES, COMPANY_EXPENSES, PERSONAL_INCOME, COMPANY_INCOME, localDate, validateTransaction, formatMoney, parseMoney, toMinor, MAX_MONEY } from '../../utils/finance';
import { FinanceAccount, FinancePage, Card, Copy, Button, Field, Choices, CategoryChoices, Notice, useFinanceAction } from './FinanceUI';
import AITransactionTools from './AITransactionTools';

export default function FinanceTransactionForm(props) { return <FinanceAccount component={TransactionForm} {...props} />; }
function TransactionForm({ navigation, company = false }) {
  const { user, userData } = useAuth();
  const { addTransaction } = useTransactions();
  const [draft, setDraft] = useState(() => ({ revision: 0, type: 'expense',
    category: company ? 'office-supplies' : 'food', amount: '', description: '', department: 'General', date: localDate() }));
  const draftRef = useRef(draft);
  const aiToolsRef = useRef(null);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const { type, category, amount, description, department, date } = draft;
  const action = useFinanceAction();
  const scrollRef = useRef(null);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => navigation?.addListener?.('blur', () => aiToolsRef.current?.reset()), [navigation]);
  useEffect(() => { if (action.message) scrollRef.current?.scrollTo({ y: 0, animated: true }); }, [action.message]);
  const categories = type === 'expense' ? (company ? COMPANY_EXPENSES : PERSONAL_EXPENSES) : (company ? COMPANY_INCOME : PERSONAL_INCOME);
  const getDraftSnapshot = useCallback(() => ({ ...draftRef.current }), []);
  const isSaving = useCallback(() => savingRef.current, []);
  const writeDraft = (changes, resetTools = false) => {
    // Invalidate before updating refs: even a same-tick response cannot overwrite an edit.
    if (resetTools) aiToolsRef.current?.reset(); else aiToolsRef.current?.invalidateDraft();
    const next = { ...draftRef.current, ...changes, revision: draftRef.current.revision + 1 };
    draftRef.current = next;
    setDraft(next);
  };
  const editDraft = changes => { if (!savingRef.current) writeDraft(changes); };
  const canApply = snapshot => mountedRef.current && !savingRef.current && auth.currentUser === user
    && snapshot?.user === user && snapshot.revision === draftRef.current.revision && draftRef.current.type === 'expense';
  const applyCategory = (suggestion, snapshot) => {
    if (!canApply(snapshot) || !(company ? COMPANY_EXPENSES : PERSONAL_EXPENSES).includes(suggestion.category)) return false;
    writeDraft({ category: suggestion.category });
    return true;
  };
  const applyReceiptItem = (item, snapshot) => {
    if (!canApply(snapshot)) return false;
    const unitPrice = parseMoney(item.price);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000 ||
        typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120) throw new Error('Review a valid receipt item first.');
    const totalMinor = toMinor(unitPrice) * item.quantity;
    if (!Number.isSafeInteger(totalMinor) || totalMinor > toMinor(MAX_MONEY)) throw new Error('This item total exceeds the supported transaction amount.');
    const total = `${Math.floor(totalMinor / 100)}.${String(totalMinor % 100).padStart(2, '0')}`;
    writeDraft({ amount: total, description: item.name.trim() });
    return true;
  };
  const save = () => action.run(async notify => {
    savingRef.current = true;
    aiToolsRef.current?.invalidateDraft();
    const session = auth.currentUser;
    try {
      if (session !== user) throw new Error('Please sign in again before saving.');
      const current = draftRef.current;
      const allowed = current.type === 'expense' ? (company ? COMPANY_EXPENSES : PERSONAL_EXPENSES) : (company ? COMPANY_INCOME : PERSONAL_INCOME);
      if (!allowed.includes(current.category)) throw new Error('Choose a category supported by this account.');
      const fields = validateTransaction({ type: current.type, category: current.category, amount: current.amount,
        description: current.description, date: current.date,
        ...(company ? { department: current.department.trim(), companyId: user.uid, userType: 'company' } : {}) });
      if (company && (!current.department.trim() || current.department.length > 100)) throw new Error('Enter a department (maximum 100 characters)');
      const result = await addTransaction(fields);
      if (!mountedRef.current || auth.currentUser !== session || result.stale) return;
      if (!result.success) throw new Error(result.error);
      writeDraft({ amount: '', description: '', date: localDate() }, true);
      notify(result.refreshError ? `Saved ${formatMoney(fields.amount)}. Refresh failed: ${result.refreshError}` : `Saved ${fields.type} of ${formatMoney(fields.amount)}.`);
    } finally { savingRef.current = false; }
  });
  return <FinancePage title={company ? 'Add Company Transaction' : 'Add Transaction'} subtitle={company ? `Record activity for ${userData?.companyName || 'your company'}` : `Welcome, ${userData?.fullName || user.displayName || 'User'}!`} navigation={navigation} scrollRef={scrollRef}>
    <Notice message={action.message} />
    <Card><Copy heading>Transaction Type</Copy><Choices values={[{ value: 'expense', label: 'Expense', tone: 'expense' }, { value: 'income', label: company ? 'Revenue' : 'Income', tone: 'income' }]} icons={{ expense: 'minus-circle', income: 'plus-circle' }} selected={type} disabled={action.busy} onSelect={value => editDraft({ type: value, category: value === 'expense' ? (company ? COMPANY_EXPENSES[0] : PERSONAL_EXPENSES[0]) : (company ? COMPANY_INCOME[0] : PERSONAL_INCOME[0]) })} />
      <Copy caption muted>{type === 'expense' ? 'Money spent from your account.' : 'Money received into your account.'}</Copy>
    </Card>
    <Card><Field label="Amount (INR)" prefix="₹" large value={amount} onChangeText={value => editDraft({ amount: value })} keyboardType="decimal-pad" maxLength={14} placeholder="0.00" editable={!action.busy} />
      <Field label="Description" value={description} onChangeText={value => editDraft({ description: value })} maxLength={500} multiline placeholder={type === 'expense' ? 'What was this expense for?' : 'Where did this income come from?'} editable={!action.busy} />
      <Field label="Date (YYYY-MM-DD)" icon="calendar-outline" value={date} onChangeText={value => editDraft({ date: value })} maxLength={10} placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false} editable={!action.busy} />
      <Copy caption muted>Calendar date in your local time zone. Future entries are not supported.</Copy>
      {company && <Field label="Department" icon="office-building-outline" value={department} onChangeText={value => editDraft({ department: value })} maxLength={100} placeholder="e.g. Operations" editable={!action.busy} />}
    </Card>
    <Card><Copy heading>Choose a Category</Copy><Copy caption muted>Select the category that best fits this {type}.</Copy><CategoryChoices values={categories} selected={category} onSelect={value => editDraft({ category: value })} disabled={action.busy} /></Card>
    <AITransactionTools ref={aiToolsRef} company={company} draft={draft} getDraftSnapshot={getDraftSnapshot}
      isSaving={isSaving} disabled={action.busy} onApplyCategory={applyCategory} onApplyReceiptItem={applyReceiptItem} />
    <Button title={action.busy ? 'Saving…' : 'Save transaction'} icon="check-circle-outline" showLabel variant="primary" disabled={action.busy} onPress={save} />
  </FinancePage>;
}
