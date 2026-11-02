import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Icon } from '../../constants/Icons';
import { remoteProfileImage } from '../../utils/profileImage';
import { AccountAvatar, AccountCard, AccountRow, AccountScreen, AccountSection, AccountText, useAccountTask } from './AccountPrimitives';
import { useAccountActions } from './AccountActions';

function memberSince(value) {
  if (!value) return null;
  try {
    const date = value.toDate ? value.toDate() : new Date(typeof value.seconds === 'number' ? value.seconds * 1000 : value);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : null;
  } catch (_) { return null; }
}

export default function AccountProfile({ navigation, company = false }) {
  const { user, userData, loading } = useAuth();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { busy: appearanceBusy, run: runAppearance } = useAccountTask();
  const { requestSignOut, requestDelete, deletionAvailable } = useAccountActions();
  const image = (company && remoteProfileImage(userData?.companyLogoUri)) || remoteProfileImage(userData?.profileImageUri) || remoteProfileImage(user?.photoURL);
  const joined = memberSince(userData?.createdAt);
  const name = company ? userData?.companyName || 'Company profile' : userData?.fullName || 'Your profile';
  const editProfile = () => navigation.navigate(company ? 'EditCompanyProfile' : 'EditProfile');
  const toggleAppearance = () => runAppearance(async (stillMounted) => { if (stillMounted()) await toggleTheme(); });
  const inactiveSwitch = (label) => <View style={styles.switchTarget}><Switch value={false} disabled
    accessibilityLabel={`${label}. Not available in this build.`} trackColor={{ false: theme.border }} thumbColor={theme.textSecondary} ios_backgroundColor={theme.border} /></View>;
  const details = [
    { label: company ? 'Company name' : 'Full name', value: name, icon: company ? 'office-building-outline' : 'account-outline' },
    ...(company ? [{ label: 'Contact person', value: userData?.contactPerson || userData?.fullName || 'Not provided', icon: 'account-tie-outline' }] : []),
    { label: 'Email', value: user?.email || 'Not provided', icon: 'email-outline' },
    { label: 'Phone', value: userData?.phone || 'Not provided', icon: 'phone-outline' },
    ...(company ? [{ label: 'Industry', value: userData?.industry || 'Not provided', icon: 'domain' }] : []),
    ...(joined ? [{ label: 'Member since', value: joined, icon: 'calendar-outline' }] : []),
  ];
  const hero = <View style={styles.profileHeader}>
    <AccountAvatar uri={image} company={company} onEdit={loading ? undefined : editProfile} />
    <Text accessibilityRole="header" style={styles.profileName}>{name}</Text>
    {company && !!(userData?.contactPerson || userData?.fullName) && <Text style={styles.contactName}>{userData.contactPerson || userData.fullName}</Text>}
    {!!user?.email && <Text style={styles.profileEmail}>{user.email}</Text>}
    <View style={styles.badges}>
      <View style={styles.badge}><Icon name={company ? 'briefcase-outline' : 'account-outline'} size={16} color="#fff" />
        <Text style={styles.badgeText}>{company ? 'Company account' : 'Personal account'}</Text></View>
      {user?.emailVerified && <View style={styles.badge}><Icon name="check-decagram-outline" size={16} color="#fff" /><Text style={styles.badgeText}>Email verified</Text></View>}
    </View>
  </View>;
  return <AccountScreen title={company ? 'Company Profile' : 'Profile'} navigation={navigation} hero={hero}>
    <AccountSection title={company ? 'Company Information' : 'Account Information'}>
      <AccountCard padding={18}>
        {details.map((detail, index) => <View key={detail.label} accessible accessibilityLabel={`${detail.label}: ${detail.value}`}
          style={[styles.detailRow, index < details.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
          <View style={[styles.detailIcon, { backgroundColor: theme.surfaceVariant }]}><Icon name={detail.icon} size={21} color={theme.textSecondary} /></View>
          <View style={styles.detailText}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{detail.label}</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{detail.value}</Text>
          </View>
        </View>)}
      </AccountCard>
    </AccountSection>
    <AccountSection title="Account Management">
      <AccountRow title={company ? 'Edit Company Profile' : 'Edit Profile'} subtitle="Update your name and contact details" icon="account-edit-outline" onPress={editProfile} disabled={loading} />
      <AccountRow title="Password & Sign-in" subtitle="Manage your account password" icon="shield-check-outline" tone="green" onPress={() => navigation.navigate('SecuritySettings')} disabled={loading} />
      <AccountRow title={company ? 'Billing & Subscription' : 'Backup & Restore'}
        subtitle={company ? 'View billing availability for this build' : 'View backup and restore availability'} icon={company ? 'credit-card-outline' : 'backup-restore'}
        onPress={() => navigation.navigate(company ? 'BillingSubscription' : 'BackupRestore')} disabled={loading} tone="purple" />
    </AccountSection>
    {company && <AccountSection title="Business Management">
      <AccountRow title="View Reports" icon="chart-line" tone="orange" onPress={() => navigation.navigate('CompanyReportsDetail')} disabled={loading} />
      <AccountRow title="Manage Team" icon="account-group-outline" onPress={() => navigation.navigate('TeamManagementDetail')} disabled={loading} />
      <AccountRow title="Budget Management" icon="wallet-outline" tone="purple" onPress={() => navigation.navigate('CompanyBudgetDetail')} disabled={loading} />
    </AccountSection>}
    <AccountSection title="Preferences">
      <AccountRow title="App Settings" subtitle="Preferences and feature availability" icon="cog-outline" tone="gray" onPress={() => navigation.navigate(company ? 'CompanySettings' : 'Settings')} disabled={loading} />
      <AccountRow title="Themes & Appearance" subtitle="Choose your theme and display mode" icon="palette-outline" tone="orange" onPress={() => navigation.navigate('Themes')} disabled={loading} />
      <AccountRow title="Push Notifications" subtitle="Notification delivery is not configured in this build." icon="bell-outline" disabled control={inactiveSwitch('Push notifications')} />
      {company && <AccountRow title="Email Reports" subtitle="Scheduled email reports are unavailable." icon="email-outline" disabled control={inactiveSwitch('Email reports')} />}
      <AccountRow title="Dark Mode" subtitle="Use a dark display on this device" icon="theme-light-dark" tone="gray"
        control={<View style={styles.switchTarget}><Switch value={isDarkMode} onValueChange={toggleAppearance} disabled={loading || appearanceBusy}
          accessibilityLabel="Dark mode" accessibilityState={{ checked: isDarkMode, disabled: loading || appearanceBusy }} hitSlop={8}
          trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" ios_backgroundColor={theme.border} /></View>} />
      <AccountRow title="Privacy & Data" subtitle="Data use, support and deletion resources" icon="shield-lock-outline" onPress={() => navigation.navigate('Privacy')} disabled={loading} />
    </AccountSection>
    <AccountSection title="Account Actions">
      <AccountRow title="Sign Out" icon="logout" onPress={requestSignOut} disabled={loading} destructive />
      <AccountRow title="Delete Account" subtitle={deletionAvailable ? 'Permanently delete your account and app data' : 'Requires the account-deletion service. See Privacy & Data for help.'}
        icon="delete-alert-outline" onPress={requestDelete} disabled={loading || !deletionAvailable} destructive />
      {!deletionAvailable && <AccountText onGradient style={styles.deletionNote}>In-app account deletion is unavailable in this build. Open Privacy & Data for the external deletion or support resource.</AccountText>}
    </AccountSection>
  </AccountScreen>;
}

const styles = StyleSheet.create({
  profileHeader: { alignItems: 'center', paddingTop: 4, paddingBottom: 24 },
  profileName: { fontSize: 25, lineHeight: 34, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 5 },
  contactName: { fontSize: 16, lineHeight: 24, color: '#fff', textAlign: 'center', marginBottom: 3 },
  profileEmail: { fontSize: 15, lineHeight: 23, color: '#fff', textAlign: 'center', marginBottom: 16 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.16)' },
  badgeText: { fontSize: 13, lineHeight: 20, color: '#fff', fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  detailIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  detailText: { flex: 1, minWidth: 0 },
  detailLabel: { fontSize: 12, lineHeight: 18, marginBottom: 3 },
  detailValue: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  switchTarget: { minWidth: 52, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  deletionNote: { fontSize: 13, lineHeight: 20, marginBottom: 0 },
});
