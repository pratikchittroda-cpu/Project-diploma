import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../constants/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../config/firebase';
import teamService from '../../services/teamService';
import MessageService from '../../services/MessageService';
import { localDate, parseMoney, sumMoney, formatMoney } from '../../utils/finance';
import { FinanceAccount, FinancePage, Card, Copy, Button, Field, Choices, LoadState, EmptyState, Notice, Metric, useFinanceColors, useFocusRefresh, useFinanceAction, styles } from './FinanceUI';

export default function FinanceTeamScreen(props) { return <FinanceAccount component={Team} {...props} />; }
const blankMember = () => ({ name: '', role: '', salary: '', department: 'General', email: '', status: 'active', joinDate: localDate() });
function Team({ navigation }) {
  const { user } = useAuth();
  const uid = user.uid;
  const generation = useRef(0);
  const [data, setData] = useState({ members: [], teams: [], loading: true, complete: false, error: null });
  const [tab, setTab] = useState('Members');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [member, setMember] = useState(blankMember);
  const [team, setTeam] = useState({ name: '', budget: '' });
  const action = useFinanceAction();
  const scrollRef = useRef(null);
  useEffect(() => { if (action.message) scrollRef.current?.scrollTo({ y: 0, animated: true }); }, [action.message]);
  const refresh = useCallback(async () => {
    if (auth?.currentUser !== user) return { success: false, error: 'Account changed' };
    const revision = ++generation.current;
    const active = () => revision === generation.current && auth.currentUser === user;
    setData(previous => ({ ...previous, loading: true, error: null }));
    try {
      const [members, teams] = await Promise.all([teamService.getMembers(uid), teamService.getTeams(uid)]);
      if (!active()) return { success: false, stale: true };
      if (!members.success || !teams.success) throw new Error(members.error || teams.error);
      // Invalid legacy numeric fields produce an error, never a false zero total.
      sumMoney(members.members, m => m.salary);
      sumMoney(teams.teams, t => t.budget);
      setData({ members: members.members, teams: teams.teams, loading: false, complete: true, error: null });
      return { success: true };
    } catch (error) {
      if (active()) setData(previous => ({ ...previous, loading: false, error: error.message }));
      return { success: false, error: error.message };
    }
  }, [uid, user]);
  useEffect(() => { refresh(); return () => { generation.current++; }; }, [refresh]);
  useFocusRefresh(navigation, refresh);
  const saveMember = () => action.run(async notify => {
    const fields = { ...member, salary: parseMoney(member.salary) };
    const result = form.id ? await teamService.updateMember(form.id, fields) : await teamService.addMember(uid, fields);
    if (!result.success) throw new Error(result.error);
    setForm(null); setMember(blankMember());
    const loaded = await refresh();
    notify(`Member saved. Salary expenses are recorded separately.${loaded.success ? '' : ` Refresh failed: ${loaded.error}`}`);
  });
  const saveTeam = () => action.run(async notify => {
    const fields = { name: team.name, budget: parseMoney(team.budget) };
    const result = form.id ? await teamService.updateTeam(form.id, fields) : await teamService.addTeam(uid, fields);
    if (!result.success) throw new Error(result.error);
    setForm(null); setTeam({ name: '', budget: '' });
    const loaded = await refresh();
    notify(loaded.success ? 'Team saved.' : `Team saved. Refresh failed: ${loaded.error}`);
  });
  const generate = () => MessageService.showConfirm('Record monthly salary expenses', 'Create this month’s ledger expense for each active member using annual salary / 12, rounded to paise? Existing member/month entries are skipped. This does not pay anyone.', () => action.run(async notify => {
    const result = await teamService.checkAndCreateMonthlySalaries(uid);
    notify(`Salary expense records: ${result.createdCount || 0} created, ${result.skippedCount || 0} skipped, ${result.failedCount || 0} failed.${result.error ? ` ${result.error}` : ''} No payments were made.`);
  }));
  const remove = (item, kind) => MessageService.showConfirm(`Delete ${kind}`, `Delete ${item.name}? Existing expense records are retained.`, () => action.run(async notify => {
    const result = kind === 'member' ? await teamService.deleteMember(item.id) : await teamService.deleteTeam(item.id);
    if (!result.success) throw new Error(result.error);
    const loaded = await refresh();
    notify(loaded.success ? `${kind} deleted.` : `${kind} deleted. Refresh failed: ${loaded.error}`);
  }));
  const editMember = item => { setMember(item ? { ...item, salary: String(item.salary) } : blankMember()); setForm({ kind: 'member', id: item?.id }); scrollRef.current?.scrollTo({ y: 0, animated: true }); };
  const editTeam = item => { setTeam(item ? { name: item.name, budget: String(item.budget) } : { name: '', budget: '' }); setForm({ kind: 'team', id: item?.id }); scrollRef.current?.scrollTo({ y: 0, animated: true }); };
  const ready = data.complete && !data.error;
  const filteredMembers = data.members.filter(m => m.name.toLowerCase().includes(search.trim().toLowerCase()));
  const filteredTeams = data.teams.filter(t => t.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <FinancePage title="Team Management" subtitle="Your people, teams and salary records" navigation={navigation} scrollRef={scrollRef} onRefresh={refresh} refreshing={data.loading}
    actions={<Button title={tab === 'Members' ? 'Add member' : 'Add team'} icon="plus" disabled={action.busy || !ready} onPress={() => tab === 'Members' ? editMember() : editTeam()} />}>
    <LoadState loading={data.loading && !data.complete} loadingLabel="Loading complete team data" error={data.error} onRetry={refresh} />
    <Notice message={action.message} />
    {ready && <>
      {form?.kind === 'member' && <Card><View style={styles.rowBetween}><Copy heading>{form.id ? 'Edit Member' : 'Add Member'}</Copy><Button title="Close member form" icon="close" disabled={action.busy} onPress={() => setForm(null)} /></View>
        <Field label="Name" icon="account-outline" value={member.name} onChangeText={name => setMember(m => ({ ...m, name }))} maxLength={100} editable={!action.busy} placeholder="Full name" />
        <Field label="Role" icon="briefcase-outline" value={member.role} onChangeText={role => setMember(m => ({ ...m, role }))} maxLength={100} editable={!action.busy} placeholder="Role or title" />
        <Field label="Annual salary (INR)" prefix="₹" value={member.salary} onChangeText={salary => setMember(m => ({ ...m, salary }))} keyboardType="decimal-pad" maxLength={14} editable={!action.busy} placeholder="0.00" />
        <Field label="Department" icon="office-building-outline" value={member.department} onChangeText={department => setMember(m => ({ ...m, department }))} maxLength={100} editable={!action.busy} />
        <Field label="Email (optional)" icon="email-outline" value={member.email} onChangeText={email => setMember(m => ({ ...m, email }))} autoCapitalize="none" keyboardType="email-address" maxLength={254} editable={!action.busy} placeholder="name@example.com" />
        <Copy caption muted>Status</Copy><Choices values={['active', 'inactive']} selected={member.status} disabled={action.busy} onSelect={status => setMember(m => ({ ...m, status }))} />
        <Copy caption muted>Salary expenses are recorded separately from member details.</Copy><Button title={action.busy ? 'Saving…' : 'Save member'} icon="check-circle-outline" showLabel variant="primary" disabled={action.busy} onPress={saveMember} /><Button title="Cancel" disabled={action.busy} onPress={() => setForm(null)} />
      </Card>}
      {form?.kind === 'team' && <Card><View style={styles.rowBetween}><Copy heading>{form.id ? 'Edit Team' : 'Add Team'}</Copy><Button title="Close team form" icon="close" disabled={action.busy} onPress={() => setForm(null)} /></View>
        <Field label="Team name" icon="account-group-outline" value={team.name} onChangeText={name => setTeam(t => ({ ...t, name }))} maxLength={100} editable={!action.busy} placeholder="e.g. Operations" />
        <Field label="Team budget (INR)" prefix="₹" value={team.budget} onChangeText={budget => setTeam(t => ({ ...t, budget }))} maxLength={14} keyboardType="decimal-pad" editable={!action.busy} placeholder="0.00" />
        <Copy caption muted>This is the team’s recorded allocation. Category budgets are managed on the Budget screen.</Copy>
        <Button title={action.busy ? 'Saving…' : 'Save team'} icon="check-circle-outline" showLabel variant="primary" disabled={action.busy} onPress={saveTeam} /><Button title="Cancel" disabled={action.busy} onPress={() => setForm(null)} />
      </Card>}
      <Card><Copy heading>Team Overview</Copy><View style={styles.grid}>
        <Metric label="Total members" value={String(data.members.length)} icon="account-group-outline" /><Metric label="Teams" value={String(data.teams.length)} icon="office-building-outline" />
      </View><View style={styles.grid}><Metric label="Active members" value={String(data.members.filter(m => m.status === 'active').length)} tone="income" /><Metric label="Active annual salaries" value={formatMoney(sumMoney(data.members.filter(m => m.status === 'active'), m => m.salary))} tone="income" /></View>
        <Copy caption muted>Salary generation records bookkeeping expenses only. It does not transfer or verify payment.</Copy><Button title={action.busy ? 'Working…' : 'Record monthly salary expenses'} icon="cash-multiple" showLabel disabled={action.busy} onPress={generate} />
      </Card>
      <Choices values={['Members', 'Teams']} icons={{ Members: 'account-group-outline', Teams: 'office-building-outline' }} selected={tab} disabled={action.busy} onSelect={value => { setTab(value); setForm(null); }} />
      <Card padding={16}><Field label="Search names" icon="magnify" value={search} onChangeText={setSearch} maxLength={100} placeholder={tab === 'Members' ? 'Search members…' : 'Search teams…'} />{!!search && <Button title="Clear search" icon="close" showLabel onPress={() => setSearch('')} />}</Card>
      <View style={styles.section}><View style={styles.rowBetween}><Copy heading>{tab === 'Members' ? 'All Members' : 'Departments & Teams'}</Copy><Button title={tab === 'Members' ? 'Add member' : 'Add team'} icon="plus" showLabel disabled={action.busy} onPress={() => tab === 'Members' ? editMember() : editTeam()} /></View>
        {tab === 'Members' ? filteredMembers.map(m => <Card key={m.id}><MemberDetails member={m} busy={action.busy} onEdit={() => editMember(m)} onRemove={() => remove(m, 'member')} /></Card>)
          : filteredTeams.map(t => <Card key={t.id}><TeamDetails team={t} memberCount={data.members.filter(m => m.department === t.name).length} busy={action.busy} onEdit={() => editTeam(t)} onRemove={() => remove(t, 'team')} /></Card>)}
        {(tab === 'Members' ? filteredMembers : filteredTeams).length === 0 && <Card><EmptyState title={search ? `No matching ${tab.toLowerCase()}` : `No ${tab.toLowerCase()} yet`} description={search ? 'Try a different name.' : `Add your first ${tab === 'Members' ? 'member' : 'team'} to get started.`} icon={tab === 'Members' ? 'account-group-outline' : 'office-building-outline'} /></Card>}
      </View>
    </>}
  </FinancePage>;
}

function MemberDetails({ member, busy, onEdit, onRemove }) {
  const colors = useFinanceColors();
  const active = member.status === 'active';
  return <View style={{ gap: 14 }}><View style={styles.rowBetween}><View style={[styles.row, { flex: 1, minWidth: 130 }]}>
    <View style={[teamStyles.avatar, { backgroundColor: colors.surface }]}><Text style={[teamStyles.initial, { color: colors.accent }]}>{member.name.trim().charAt(0).toUpperCase()}</Text></View>
    <View style={{ flex: 1, minWidth: 70 }}><Copy heading>{member.name}</Copy><Copy caption muted>{member.role}</Copy></View>
  </View><View style={[styles.badge, { backgroundColor: colors.surface }]}><Copy caption style={{ color: active ? colors.income : colors.muted, fontWeight: '700' }}>{active ? 'Active' : 'Inactive'}</Copy></View></View>
    <View style={[styles.row, { alignItems: 'flex-start' }]}><Icon name="office-building-outline" size={18} color={colors.muted} /><Copy caption muted style={{ flex: 1 }}>{member.department}</Copy></View>
    {!!member.email && <View style={[styles.row, { alignItems: 'flex-start' }]}><Icon name="email-outline" size={18} color={colors.muted} /><Copy caption muted style={{ flex: 1 }}>{member.email}</Copy></View>}
    <View style={[teamStyles.salaryPanel, { backgroundColor: colors.surface }]}><Metric label="Annual salary" value={formatMoney(member.salary)} />
      <View style={styles.row}><Button title="Edit" label={`Edit ${member.name}`} icon="pencil-outline" showLabel disabled={busy} onPress={onEdit} /><Button title="Delete" label={`Delete ${member.name}`} icon="trash-can-outline" variant="danger" disabled={busy} onPress={onRemove} /></View>
    </View>
  </View>;
}

function TeamDetails({ team, memberCount, busy, onEdit, onRemove }) {
  const colors = useFinanceColors();
  return <View style={{ gap: 14 }}><View style={[styles.row, { flexWrap: 'nowrap' }]}><View style={[styles.iconCircle, { backgroundColor: colors.surface }]}><Icon name="office-building-outline" size={24} color={colors.accent} /></View>
    <View style={{ flex: 1 }}><Copy heading>{team.name}</Copy><Copy caption muted>{memberCount} {memberCount === 1 ? 'member' : 'members'} assigned by department name</Copy></View>
  </View><Metric label="Recorded allocation" value={formatMoney(team.budget)} /><Copy caption muted>Category limits are managed separately on the Budget screen.</Copy>
    <View style={styles.row}><Button title="Edit" label={`Edit ${team.name}`} icon="pencil-outline" showLabel disabled={busy} onPress={onEdit} /><Button title="Delete" label={`Delete ${team.name}`} icon="trash-can-outline" showLabel variant="danger" disabled={busy} onPress={onRemove} /></View>
  </View>;
}

const teamStyles = StyleSheet.create({
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 20, fontWeight: '700' }, salaryPanel: { borderRadius: 16, padding: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
});
