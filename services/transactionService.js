import { collection, addDoc, getDocsFromServer, doc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, getDocFromServer, documentId } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { MAX_MONEY, validateTransaction, ledgerDate, toMinor, fromMinor, summarize, parseDateOnly, normalizeCategory } from '../utils/finance';
import { invalidateFinance, requireFinanceOwner } from '../utils/financeEvents';

const failure = error => ({ success: false, error: error.message || 'Unable to load transactions' });
const owner = userId => requireFinanceOwner(auth, userId);
const readRows = snapshot => snapshot.docs.map(item => {
  const row = { ...item.data(), id: item.id };
  if (!['income', 'expense'].includes(row.type) || row.amount > MAX_MONEY || toMinor(row.amount) <= 0) throw new Error('A stored transaction needs correction before totals can be shown');
  ledgerDate(row.date || row.createdAt);
  return { ...row, amount: fromMinor(toMinor(row.amount)), category: normalizeCategory(row.category) };
});

class TransactionService {
  async addTransaction(userId, data) {
    try {
      owner(userId);
      const clean = validateTransaction(data);
      if (clean.companyId && clean.companyId !== userId) throw new Error('Company ownership cannot change');
      const timestamp = new Date().toISOString();
      const ref = await addDoc(collection(db, 'transactions'), { ...clean, userId, createdAt: timestamp, updatedAt: timestamp });
      invalidateFinance(userId, 'transactions');
      return { success: true, transactionId: ref.id };
    } catch (error) { return failure(error); }
  }

  // Complete, server-confirmed owner query: never a limited history page.
  async getAllTransactions(userId) {
    try {
      const active = owner(userId);
      const snapshot = await getDocsFromServer(query(collection(db, 'transactions'), where('userId', '==', userId)));
      active();
      const transactions = readRows(snapshot).sort((a, b) => ledgerDate(b.date || b.createdAt).localeCompare(ledgerDate(a.date || a.createdAt)) || b.id.localeCompare(a.id));
      return { success: true, transactions, complete: true };
    } catch (error) { return failure(error); }
  }

  // Bounded server pagination uses document ID as a stable tie-breaker. History
  // filters/search are applied to loaded pages in the UI and labelled as such.
  async getUserTransactions(userId, pageSize = 20, lastDoc = null) {
    try {
      const active = owner(userId);
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Invalid page size');
      if (lastDoc && (typeof lastDoc.data !== 'function' || lastDoc.data()?.userId !== userId)) throw new Error('Invalid history cursor');
      const constraints = [where('userId', '==', userId), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc')];
      if (lastDoc) constraints.push(startAfter(lastDoc));
      // One look-ahead doc gives an exact hasMore without returning an unbounded page.
      const snapshot = await getDocsFromServer(query(collection(db, 'transactions'), ...constraints, limit(pageSize + 1)));
      active();
      const docs = snapshot.docs.slice(0, pageSize);
      return { success: true, transactions: readRows({ docs }), lastDoc: docs.at(-1) || lastDoc, hasMore: snapshot.docs.length > pageSize };
    } catch (error) { return failure(error); }
  }

  async getTransactionsByCategory(userId, category) {
    try {
      const active = owner(userId);
      // Legacy category aliases/casing participate in the same ledger. Query
      // the owner once rather than silently dropping those rows.
      const result = await this.getAllTransactions(userId);
      active();
      if (!result.success) return result;
      return { ...result, transactions: result.transactions.filter(row => row.category === normalizeCategory(category)) };
    } catch (error) { return failure(error); }
  }

  // Half-open local date range, including legacy ISO timestamps consistently.
  async getTransactionsByDateRange(userId, startDate, endDate) {
    try {
      const active = owner(userId);
      parseDateOnly(startDate); parseDateOnly(endDate);
      if (endDate <= startDate) throw new Error('Invalid date range');
      const result = await this.getAllTransactions(userId);
      active();
      if (!result.success) return result;
      return { ...result, transactions: result.transactions.filter(t => { const date = ledgerDate(t.date || t.createdAt); return date >= startDate && date < endDate; }) };
    } catch (error) { return failure(error); }
  }
  async getTransactionStats(userId, startDate, endDate) {
    try {
      const active = owner(userId);
      const result = await this.getTransactionsByDateRange(userId, startDate, endDate);
      active();
      if (!result.success) return result;
      return { success: true, stats: summarize(result.transactions), complete: true };
    } catch (error) { return failure(error); }
  }
  async getTransaction(transactionId) {
    try {
      const active = owner();
      const snapshot = await getDocFromServer(doc(db, 'transactions', transactionId));
      active();
      if (!snapshot.exists()) throw new Error('Transaction not found');
      owner(snapshot.data().userId);
      return { success: true, transaction: readRows({ docs: [snapshot] })[0] };
    } catch (error) { return failure(error); }
  }
  async updateTransaction(transactionId, updateData) {
    try {
      const active = owner();
      const current = await this.getTransaction(transactionId);
      if (!current.success) return current;
      active();
      const data = current.transaction;
      for (const field of ['userId', 'type', 'userType', 'companyId', 'createdAt', 'autoGenerated', 'memberId', 'salaryMonth']) {
        if (field in updateData && updateData[field] !== data[field]) throw new Error(`Transaction ${field} cannot change`);
      }
      const fields = validateTransaction({ ...data, ...updateData, date: 'date' in updateData ? updateData.date : (data.date || data.createdAt) });
      await updateDoc(doc(db, 'transactions', transactionId), { ...fields, updatedAt: new Date().toISOString() });
      invalidateFinance(data.userId, 'transactions');
      return { success: true };
    } catch (error) { return failure(error); }
  }
  async deleteTransaction(transactionId) {
    try {
      const active = owner();
      const current = await this.getTransaction(transactionId);
      if (!current.success) return current;
      active();
      owner(current.transaction.userId);
      await deleteDoc(doc(db, 'transactions', transactionId));
      invalidateFinance(current.transaction.userId, 'transactions');
      return { success: true };
    } catch (error) { return failure(error); }
  }
}
export default new TransactionService();
