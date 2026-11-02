import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AccountCard, AccountField, AccountRow, AccountScreen, AccountSection, useAccountTask } from '../../components/account/AccountPrimitives';

export default function SettingsScreen({ navigation, company = false }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { busy, run } = useAccountTask();
  const toggleAppearance = () => run(async (stillMounted) => { if (stillMounted()) await toggleTheme(); });
  const unavailable = (title, subtitle, icon) => <AccountRow key={title} title={title} subtitle={subtitle} icon={icon} disabled
    control={<View style={styles.switchTarget}><Switch value={false} disabled accessibilityLabel={`${title}. ${subtitle}`}
      trackColor={{ false: theme.border, true: theme.primary }} thumbColor={theme.textSecondary} ios_backgroundColor={theme.border} /></View>} />;

  return <AccountScreen title={company ? 'Company Settings' : 'Settings'} navigation={navigation}>
    {company ? <>
      <AccountSection title="Financial Management">
        {unavailable('Automatic Reports', 'Scheduled report delivery is not configured in this build.', 'file-chart-outline')}
        {unavailable('Budget Alerts', 'Automatic budget notifications are unavailable.', 'alert-circle-outline')}
        {unavailable('Expense Approval', 'An expense-approval workflow is not available in this build.', 'check-circle-outline')}
        {unavailable('Multi-Currency Support', 'Transactions use INR. Multiple currencies are unavailable.', 'currency-usd')}
      </AccountSection>
      <AccountSection title="Team & Notifications">
        {unavailable('Employee Notifications', 'Team notification delivery is not configured.', 'account-group-outline')}
        {unavailable('Audit Logging', 'A company audit-history service is not available in this build.', 'history')}
      </AccountSection>
      <AccountSection title="Data Management">
        <AccountCard padding={16}>
          <AccountField label="Data Retention" icon="database-outline" value="" placeholder="Not configured" editable={false}
            helperText="This build has no automatic data-retention policy. Your data is not deleted by this setting." />
        </AccountCard>
        <AccountRow title="Backup Frequency" subtitle="Scheduled company backups require a configured backup service." icon="backup-restore" value="Unavailable" disabled />
      </AccountSection>
    </> : <>
      <AccountSection title="Notifications">
        {unavailable('Push Notifications', 'Transaction and update notifications are not configured in this build.', 'bell-outline')}
        {unavailable('Email Reports', 'Scheduled weekly and monthly email reports are unavailable.', 'email-newsletter')}
      </AccountSection>
      <AccountSection title="Security">
        <AccountRow title="Password & Sign-in" subtitle="Manage the password for your sign-in account" icon="shield-check-outline" tone="green"
          onPress={() => navigation.navigate('SecuritySettings')} />
        {unavailable('Biometric Authentication', 'Fingerprint and Face ID app unlocking are not configured.', 'fingerprint')}
      </AccountSection>
      <AccountSection title="Data Management">
        {unavailable('Auto Backup', 'Automatic cloud backups are not available in this build.', 'cloud-upload-outline')}
        <AccountRow title="Backup & Restore" subtitle="View backup and restore availability" icon="backup-restore" tone="purple"
          onPress={() => navigation.navigate('BackupRestore')} />
      </AccountSection>
      <AccountSection title="Experience">
        {unavailable('Sound Effects', 'Interaction sound effects are not available in this build.', 'volume-high')}
        {unavailable('Haptic Feedback', 'App haptic-feedback preferences are not available in this build.', 'vibrate')}
      </AccountSection>
    </>}
    <AccountSection title="Appearance">
      <AccountRow title="Dark Mode" subtitle="Switch between light and dark themes on this device" icon="theme-light-dark" tone="gray"
        control={<View style={styles.switchTarget}><Switch value={isDarkMode} onValueChange={toggleAppearance} disabled={busy}
          accessibilityLabel="Dark mode" accessibilityState={{ checked: isDarkMode, disabled: busy }} hitSlop={8}
          trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" ios_backgroundColor={theme.border} /></View>} />
      <AccountRow title="Themes & Appearance" subtitle="Choose your Expenzo color palette" icon="palette-outline" tone="orange"
        onPress={() => navigation.navigate('Themes')} />
    </AccountSection>
    <AccountSection title={company ? 'Company Account' : 'Privacy & Account'}>
      {company && <>
        <AccountRow title="Password & Sign-in" subtitle="Manage the password for your sign-in account" icon="shield-check-outline" tone="green"
          onPress={() => navigation.navigate('SecuritySettings')} />
        <AccountRow title="Billing & Subscription" subtitle="Subscription and payment services are unavailable in this build." icon="credit-card-outline" tone="purple"
          onPress={() => navigation.navigate('BillingSubscription')} />
      </>}
      <AccountRow title="Privacy & Data" subtitle="Data use, support and account-deletion resources" icon="shield-lock-outline"
        onPress={() => navigation.navigate('Privacy')} />
    </AccountSection>
  </AccountScreen>;
}

const styles = StyleSheet.create({
  switchTarget: { minWidth: 52, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
