import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Icon } from '../../constants/Icons';
import MessageService from '../../services/MessageService';
import { AccountButton, AccountCard, AccountField, AccountRow, AccountScreen, AccountSection, AccountText, useAccountTask } from './AccountPrimitives';
import { useAccountActions } from './AccountActions';

export default function AccountRecovery({ navigation }) {
  const { user, userData, profileStatus, profileError, completeProfile, refreshUserData, loading } = useAuth();
  const { theme } = useTheme();
  const incomplete = profileStatus === 'incomplete';
  const setupRequired = profileStatus === 'missing' || incomplete;
  const lockedType = incomplete && ['personal', 'company'].includes(userData?.userType) ? userData.userType : null;
  const [type, setType] = useState(lockedType || 'personal');
  const [name, setName] = useState(userData?.fullName || user?.displayName || '');
  const [companyName, setCompanyName] = useState(userData?.companyName || '');
  const [submissionError, setSubmissionError] = useState(null);
  const { busy, run } = useAccountTask();
  const { requestSignOut, requestDelete, deletionAvailable } = useAccountActions();
  const pending = busy || loading;
  const finish = () => run(async (stillMounted) => {
    if (!stillMounted()) return;
    setSubmissionError(null);
    if (!name.trim() || (type === 'company' && !companyName.trim())) {
      const message = 'Enter your name and, for a company account, your company name.';
      setSubmissionError(message);
      MessageService.showError('Missing details', message); return;
    }
    try {
      const result = await completeProfile({ userType: type, fullName: name.trim(),
        ...(type === 'company' ? { companyName: companyName.trim(), contactPerson: name.trim() } : {}) });
      if (stillMounted() && !result?.success) {
        const message = result?.error || 'The setup could not be saved. Check your connection and try again.';
        setSubmissionError(message);
        MessageService.showError('Setup not saved', message);
      }
    } catch (error) {
      if (!stillMounted()) return;
      const message = error?.message || 'The setup could not be saved. Check your connection and try again.';
      setSubmissionError(message);
      MessageService.showError('Setup not saved', message);
    }
  });
  const retry = () => run(async (stillMounted) => { if (stillMounted()) await refreshUserData(); });
  const hero = <View style={styles.hero}>
    <View style={styles.heroIcon}><Icon name={setupRequired ? 'account-check-outline' : 'shield-alert-outline'} size={44} color="#fff" /></View>
    <Text accessibilityRole="header" style={styles.heroTitle}>{profileStatus === 'missing' ? 'Welcome to Expenzo' : incomplete ? 'Complete your account setup' : 'Let’s recover your account'}</Text>
    {!!user?.email && <Text style={styles.heroEmail}>{user.email}</Text>}
  </View>;
  return <AccountScreen title={setupRequired ? (incomplete ? 'Complete Account Setup' : 'Account Setup') : 'Account Recovery'} navigation={navigation} hero={hero}>
    <AccountCard>
      <View style={[styles.status, { backgroundColor: theme.surfaceVariant }]}> 
        <Icon name="information-outline" size={21} color={theme.textSecondary} />
        <AccountText style={styles.statusText}>{profileError || 'Your profile is not ready. Retry loading it or sign out.'}</AccountText>
      </View>
      {!!submissionError && <View style={[styles.status, styles.errorStatus, { backgroundColor: theme.errorLight || theme.warningLight }]}> 
        <Icon name="alert-circle-outline" size={21} color={theme.error || theme.warning} />
        <AccountText accessibilityRole="alert" style={styles.statusText}>{submissionError}</AccountText>
      </View>}
      {setupRequired && <>
        <AccountText>{incomplete
          ? 'Your sign-in exists, but account setup is incomplete. Confirm your saved account type and finish setup. This does not create another sign-in account.'
          : 'Your sign-in exists, but no app profile was saved. Choose your account type and finish setup. This does not create another sign-in account.'}</AccountText>
        <AccountSection title="Account Type" subtitle={lockedType ? 'The existing account type cannot be changed during recovery.' : undefined}>
          <View style={styles.typeChoices}>
            <AccountButton title={`Personal${type === 'personal' ? ' — selected' : ''}`} icon="account-outline" style={styles.typeButton}
              secondary={type !== 'personal'} onPress={() => setType('personal')} disabled={pending || !!lockedType} />
            <AccountButton title={`Company${type === 'company' ? ' — selected' : ''}`} icon="office-building-outline" style={styles.typeButton}
              secondary={type !== 'company'} onPress={() => setType('company')} disabled={pending || !!lockedType} />
          </View>
        </AccountSection>
        <AccountField label="Your name" icon="account-outline" placeholder="Enter your full name" value={name} onChangeText={value => { setName(value); setSubmissionError(null); }}
          maxLength={120} autoCapitalize="words" autoComplete="name" editable={!pending} />
        {type === 'company' && <AccountField label="Company name" icon="office-building-outline" placeholder="Enter company name" value={companyName}
          onChangeText={value => { setCompanyName(value); setSubmissionError(null); }} maxLength={160} autoCapitalize="words" editable={!pending} />}
        <AccountButton title={pending ? 'Saving setup…' : 'Complete Setup'} icon="check" busy={pending} onPress={finish} />
      </>}
      {profileStatus !== 'blocked' && <AccountButton title="Retry Loading Profile" icon="refresh" disabled={pending} onPress={retry} secondary />}
    </AccountCard>
    <AccountSection title="Support & Account">
      <AccountRow title="Privacy & Data" subtitle="Support and external deletion resources" icon="shield-lock-outline" onPress={() => navigation.navigate('Privacy')} disabled={pending} />
      <AccountRow title="Sign Out" icon="logout" onPress={requestSignOut} disabled={pending} destructive />
      <AccountRow title="Delete Account" icon="delete-alert-outline" onPress={requestDelete} disabled={pending || !deletionAvailable} destructive
        subtitle={deletionAvailable ? 'Permanently delete your account and app data' : 'In-app deletion requires a configured account-deletion service.'} />
      {!deletionAvailable && <AccountText onGradient style={styles.deletionNote}>In-app account deletion is unavailable in this build. Open Privacy & Data for the external deletion or support resource.</AccountText>}
    </AccountSection>
  </AccountScreen>;
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 26 },
  heroIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 23, lineHeight: 31, fontWeight: '700', textAlign: 'center', color: '#fff', marginBottom: 8 },
  heroEmail: { fontSize: 15, lineHeight: 23, color: '#fff', textAlign: 'center' },
  status: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 14, marginBottom: 18 },
  errorStatus: { borderWidth: 1, borderColor: '#B42318' },
  statusText: { flex: 1, fontSize: 14, lineHeight: 22, marginBottom: 0 },
  typeChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeButton: { flex: 1, minWidth: 110 },
  deletionNote: { fontSize: 13, lineHeight: 20 },
});
