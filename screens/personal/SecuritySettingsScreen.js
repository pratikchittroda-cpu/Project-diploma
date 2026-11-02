import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import MessageService from '../../services/MessageService';
import { AccountButton, AccountCard, AccountField, AccountScreen, AccountText, accountGradientColors, useAccountTask } from '../../components/account/AccountPrimitives';

export default function SecuritySettingsScreen({ navigation }) {
  const { user, updatePassword } = useAuth();
  const { theme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const { busy, run } = useAccountTask();
  const passwordProvider = user?.providerData?.some((provider) => provider.providerId === 'password');
  const changePassword = () => run(async (stillMounted) => {
    if (!currentPassword || newPassword.length < 6 || confirmation !== newPassword) {
      MessageService.showError('Check your passwords', 'Enter your current password and matching new passwords of at least 6 characters.'); return;
    }
    const result = await updatePassword(currentPassword, newPassword);
    if (!stillMounted()) return;
    setCurrentPassword('');
    if (result.success) {
      setNewPassword(''); setConfirmation('');
      MessageService.showSuccess('Password changed', 'Your Firebase account password was updated.');
    } else MessageService.showError('Password not changed', result.error);
  });
  const inactiveOptions = [
    ['fingerprint', 'Biometric Authentication', 'Fingerprint and Face ID unlock are not implemented in this build.'],
    ['two-factor-authentication', 'Two-Factor Authentication', 'This build has no in-app two-factor setup.'],
    ['bell-outline', 'Login Alerts', 'New-device login notifications are not implemented.'],
    ['lock-clock', 'Auto Lock', 'This build does not lock the app automatically.'],
  ];
  return <AccountScreen title="Security Settings" navigation={navigation}>
    <AccountCard style={styles.card}>
      <View style={styles.intro}>
        <LinearGradient colors={accountGradientColors(theme)} style={styles.iconBadge}>
          <MaterialCommunityIcons name="shield-check" size={30} color="#fff" />
        </LinearGradient>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>Password & sign-in</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{passwordProvider ? 'Email and password sign-in' : 'External provider sign-in'}</Text>
        </View>
      </View>
      <AccountText>Firebase Authentication manages your sign-in. Your financial records remain protected by account access rules.</AccountText>
    </AccountCard>

    <AccountCard style={styles.card}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="lock-reset" size={24} color={theme.accent || theme.primary} />
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>Change Password</Text>
      </View>
      {passwordProvider ? <>
        <AccountText>Your current password is verified before a new password is saved.</AccountText>
        <AccountField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry
          editable={!busy} autoCapitalize="none" autoComplete="current-password" />
        <AccountField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry
          editable={!busy} autoCapitalize="none" autoComplete="new-password" placeholder="At least 6 characters" />
        <AccountField label="Confirm new password" value={confirmation} onChangeText={setConfirmation} secureTextEntry
          editable={!busy} autoCapitalize="none" autoComplete="new-password" />
        <AccountButton title="Change password" onPress={changePassword} busy={busy} />
      </> : <AccountText>You sign in through an external provider. Manage your password and account protection with that provider.</AccountText>}
    </AccountCard>

    <AccountCard style={styles.card}>
      <Text accessibilityRole="header" style={[styles.heading, styles.sectionTitle, { color: theme.text }]}>Additional Security</Text>
      {inactiveOptions.map(([icon, title, description], index) => <View key={title}
        style={[styles.option, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
        <View style={[styles.optionIcon, { backgroundColor: theme.primaryContainer }]}>
          <MaterialCommunityIcons name={icon} size={22} color={theme.accent || theme.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.optionTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{description}</Text>
          <Text style={[styles.unavailable, { color: theme.textSecondary }]}>Unavailable</Text>
        </View>
      </View>)}
    </AccountCard>
    <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Privacy')} activeOpacity={0.8}>
      <AccountCard padding={18} style={styles.card}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="shield-account-outline" size={24} color={theme.accent || theme.primary} />
          <Text style={[styles.optionTitle, styles.flex, { color: theme.text }]}>Privacy & data</Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textSecondary} />
        </View>
      </AccountCard>
    </TouchableOpacity>
  </AccountScreen>;
}

const styles = StyleSheet.create({
  card: { marginBottom: 18, borderRadius: 20 },
  flex: { flex: 1 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  iconBadge: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionTitle: { marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 16 },
  optionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 16, fontWeight: '600' },
  unavailable: { fontSize: 12, fontWeight: '600', marginTop: 8 },
});
