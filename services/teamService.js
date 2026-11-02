import { collection, addDoc, getDocsFromServer, doc, updateDoc, deleteDoc, query, where, getDocFromServer, runTransaction } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import transactionService from './transactionService';
import { parseMoney, requireText, optionalText, localDate, ledgerDate, salaryId, divideMoney, validateTransaction, toMinor, fromMinor, MAX_MONEY } from '../utils/finance';
import { invalidateFinance, requireFinanceOwner } from '../utils/financeEvents';

const failure = error => ({ success: false, error: error.message || 'Unable to load team data' });
const owner = userId => requireFinanceOwner(auth, userId);
const cleanTeam = data => ({ name: requireText(data.name, 'Team name', 100), budget: parseMoney(data.budget), color: optionalText(data.color ?? '#667eea', 'Color', 40), icon: optionalText(data.icon ?? 'office-building', 'Icon', 80) });
const cleanMember = data => {
  const email = optionalText(data.email ?? '', 'Email', 254);
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Enter a valid email');
  if (!['active', 'inactive'].includes(data.status)) throw new Error('Choose active or inactive status');
  return { name: requireText(data.name, 'Name', 100), role: requireText(data.role, 'Role', 100), salary: parseMoney(data.salary),
    department: requireText(data.department ?? 'General', 'Department', 100), email, status: data.status,
    joinDate: ledgerDate(data.joinDate ?? localDate()), avatar: optionalText(data.avatar ?? 'account', 'Avatar', 80), color: optionalText(data.color ?? '#667eea', 'Color', 40) };
};
const teamCollection = name => { if (!['teams', 'members'].includes(name)) throw new Error('Invalid team collection'); };
const validMonth = month => { if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid salary month'); };

class TeamService {
  getSalaryMonth(date = new Date()) { return date instanceof Date ? localDate(date).slice(0, 7) : ledgerDate(date).slice(0, 7); }
  async list(collectionName, userId) {
    try {
      teamCollection(collectionName);
      const active = owner(userId);
      const snapshot = await getDocsFromServer(query(collection(db, collectionName), where('userId', '==', userId)));
      active();
      const records = snapshot.docs.map(item => {
        const row = { ...item.data(), id: item.id };
        const field = collectionName === 'members' ? 'salary' : 'budget';
        if (row[field] > MAX_MONEY || toMinor(row[field]) <= 0) throw new Error('A stored team amount needs correction');
        requireText(row.name, 'Name', 120);
        if (collectionName === 'members' && !['active', 'inactive'].includes(row.status)) throw new Error('A stored member status needs correction');
        return { ...row, [field]: fromMinor(toMinor(row[field])) };
      });
      return { success: true, [collectionName]: records, complete: true };
    } catch (error) { return failure(error); }
  }
  getTeams(userId) { return this.list('teams', userId); }
  getMembers(userId) { return this.list('members', userId); }
  async get(collectionName, id) {
    try {
      teamCollection(collectionName);
      const active = owner();
      const snapshot = await getDocFromServer(doc(db, collectionName, id));
      active();
      if (!snapshot.exists()) throw new Error('Record not found');
      owner(snapshot.data().userId);
      return { success: true, [collectionName === 'members' ? 'member' : 'team']: { ...snapshot.data(), id: snapshot.id } };
    } catch (error) { return failure(error); }
  }
  getTeam(id) { return this.get('teams', id); }
  getMember(id) { return this.get('members', id); }
  async add(collectionName, userId, data) {
    try {
      teamCollection(collectionName);
      owner(userId);
      const clean = collectionName === 'members' ? cleanMember(data) : cleanTeam(data);
      const timestamp = new Date().toISOString();
      const fields = { ...clean, userId, createdAt: timestamp, updatedAt: timestamp };
      const ref = await addDoc(collection(db, collectionName), fields);
      return { success: true, [collectionName === 'members' ? 'member' : 'team']: { ...fields, id: ref.id } };
    } catch (error) { return failure(error); }
  }
  addTeam(userId, data) { return this.add('teams', userId, data); }
  addMember(userId, data) { return this.add('members', userId, data); }
  async update(collectionName, id, data) {
    try {
      const active = owner();
      const result = await this.get(collectionName, id);
      if (!result.success) return result;
      active();
      const current = result[collectionName === 'members' ? 'member' : 'team'];
      if ('userId' in data && data.userId !== current.userId) throw new Error('Ownership cannot change');
      const clean = collectionName === 'members' ? cleanMember({ ...current, ...data }) : cleanTeam({ ...current, ...data });
      owner(current.userId);
      await updateDoc(doc(db, collectionName, id), { ...clean, updatedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) { return failure(error); }
  }
  updateTeam(id, data) { return this.update('teams', id, data); }
  updateMember(id, data) { return this.update('members', id, data); }
  async remove(collectionName, id) {
    try {
      const active = owner();
      const result = await this.get(collectionName, id);
      if (!result.success) return result;
      active();
      owner(result[collectionName === 'members' ? 'member' : 'team'].userId);
      await deleteDoc(doc(db, collectionName, id));
      return { success: true };
    } catch (error) { return failure(error); }
  }
  deleteTeam(id) { return this.remove('teams', id); }
  deleteMember(id) { return this.remove('members', id); }

  // One complete legacy salary query for the whole run, never one per member.
  async salaryMembers(userId, month) {
    const active = owner(userId);
    validMonth(month);
    const result = await transactionService.getTransactionsByCategory(userId, 'salaries');
    active();
    if (!result.success || !result.complete) throw new Error(result.error || 'Unable to verify existing salary records');
    return new Set(result.transactions.filter(t => t.type === 'expense' && t.memberId && (t.salaryMonth || ledgerDate(t.date || t.createdAt).slice(0, 7)) === month).map(t => t.memberId));
  }
  async hasSalaryGeneratedForMonth(userId, memberId, month = this.getSalaryMonth()) {
    try {
      const active = owner(userId);
      requireText(memberId, 'Member ID', 128);
      const members = await this.salaryMembers(userId, month);
      active();
      return { success: true, exists: members.has(memberId) };
    } catch (error) { return failure(error); }
  }
  async createMonthlySalaryExpense(userId, memberData) {
    try {
      const active = owner(userId);
      const date = localDate();
      const legacy = await this.salaryMembers(userId, date.slice(0, 7));
      active();
      return this.recordSalary(userId, memberData, legacy, date, active);
    } catch (error) { return { ...failure(error), memberId: memberData?.id }; }
  }
  async recordSalary(userId, memberData, legacy, date, active) {
    try {
      owner(userId);
      active();
      const memberId = requireText(memberData?.id, 'Member ID', 128);
      if (memberId.includes('/')) throw new Error('Invalid member ID');
      const month = date.slice(0, 7);
      if (legacy.has(memberId)) return { success: true, skipped: true, reason: 'already_recorded', memberId, salaryMonth: month };
      const ref = doc(db, 'transactions', salaryId(userId, memberId, month));
      const result = await runTransaction(db, async transaction => {
        active();
        const [existing, member] = await Promise.all([transaction.get(ref), transaction.get(doc(db, 'members', memberId))]);
        active();
        if (existing.exists()) {
          const saved = existing.data();
          if (saved.userId !== userId || saved.type !== 'expense' || saved.category !== 'salaries' || saved.memberId !== memberId || saved.salaryMonth !== month) throw new Error('Salary record mismatch');
          return { success: true, skipped: true, reason: 'already_recorded', memberId, salaryMonth: month };
        }
        if (!member.exists() || member.data().userId !== userId) throw new Error('Member not found');
        const saved = cleanMember(member.data());
        if (saved.status !== 'active') return { success: true, skipped: true, reason: 'inactive_member', memberId, salaryMonth: month };
        const amount = divideMoney(saved.salary, 12);
        const fields = validateTransaction({ type: 'expense', amount, description: `Salary - ${saved.name} (${saved.role})`, category: 'salaries', department: saved.department,
          date, companyId: userId, userType: 'company', autoGenerated: true, memberId, salaryMonth: month });
        const timestamp = new Date().toISOString();
        transaction.set(ref, { ...fields, userId, createdAt: timestamp, updatedAt: timestamp });
        return { success: true, skipped: false, transactionId: ref.id, memberId, salaryMonth: month };
      });
      if (!result.skipped) invalidateFinance(userId, 'transactions');
      return result;
    } catch (error) { return { ...failure(error), memberId: memberData?.id }; }
  }
  async checkAndCreateMonthlySalaries(userId) {
    try {
      const active = owner(userId);
      const date = localDate();
      const membersResult = await this.getMembers(userId);
      active();
      if (!membersResult.success) return { ...membersResult, createdCount: 0, skippedCount: 0, failedCount: 0 };
      const month = date.slice(0, 7);
      const members = membersResult.members.filter(m => m.status === 'active');
      let legacy;
      try { legacy = await this.salaryMembers(userId, month); }
      catch (error) { return { ...failure(error), createdCount: 0, skippedCount: 0, failedCount: members.length }; }
      const results = [];
      for (const member of members) results.push(await this.recordSalary(userId, member, legacy, date, active));
      const createdCount = results.filter(r => r.success && !r.skipped).length;
      const skippedCount = results.filter(r => r.success && r.skipped).length;
      const failedCount = results.filter(r => !r.success).length;
      return { success: failedCount === 0, salaryMonth: month, results, createdCount, skippedCount, failedCount,
        ...(failedCount ? { error: `${failedCount} salary expense record(s) failed. Retry to record only missing entries.` } : {}) };
    } catch (error) { return { ...failure(error), createdCount: 0, skippedCount: 0, failedCount: 0 }; }
  }
}
export default new TeamService();
