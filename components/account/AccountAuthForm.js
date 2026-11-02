import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Icon } from '../../constants/Icons';
import { getGoogleAuthSetup } from '../../utils/googleAuth';
import MessageService from '../../services/MessageService';
import { AccountButton, AccountCard, AccountField, AccountScreen, AccountText, useAccountTask } from './AccountPrimitives';

export default function AccountAuthForm({ navigation, accountType, registering = false }) {
  const { signIn, signUp, signInWithGoogle, resetPassword, loading } = useAuth();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [industry, setIndustry] = useState('');
  const { busy, run } = useAccountTask();
  const company = accountType === 'company';
  const google = getGoogleAuthSetup();
  const pending = busy || loading;
  const report = (result) => {
    if (!result.success && !result.canceled && !result.user) MessageService.showError(registering ? 'Registration failed' : 'Sign-in failed', result.error);
    // The auth-driven navigator handles success and incomplete-profile recovery.
  };
  const submit = () => run(async (stillMounted) => {
    if (!stillMounted()) return;
    if (!email.trim() || !password || (registering && (!name.trim() || (company && !companyName.trim())))) {
      MessageService.showError('Missing details', 'Complete all fields.'); return;
    }
    if (registering && (password !== confirmation || password.length < 6)) {
      MessageService.showError('Check your password', 'Passwords must match and contain at least 6 characters.'); return;
    }
    const result = registering
      ? await signUp(email, password, { fullName: name.trim(), userType: accountType,
        ...(company ? { companyName: companyName.trim(), contactPerson: name.trim(), phone: phone.trim(), industry: industry.trim() } : {}) })
      : await signIn(email, password, accountType);
    if (stillMounted()) report(result);
  });
  const googleSignIn = () => run(async (stillMounted) => {
    if (!stillMounted() || !google.isConfigured) return;
    const result = await signInWithGoogle(accountType);
    if (stillMounted()) report(result);
  });
  const forgotPassword = () => MessageService.showPrompt('Reset password', 'Enter the email used for your account.', (value) => run(async (stillMounted) => {
    if (!stillMounted()) return;
    if (!value?.trim()) { MessageService.showError('Email required', 'Enter an email address.'); return; }
    const result = await resetPassword(value);
    if (!stillMounted()) return;
    if (result.success) MessageService.showSuccess('Check your inbox', 'If this email has an eligible account, a password reset link has been sent.');
    else MessageService.showError('Reset failed', result.error);
  }), undefined, { initialValue: email, placeholder: 'Email', keyboardType: 'email-address', confirmButtonText: 'Send link' });
  const switchAccountScreen = () => navigation.navigate(company ? (registering ? 'CompanyLogin' : 'CompanyRegister') : (registering ? 'Login' : 'Register'));

  return <AccountScreen title={company ? 'Expenzo Business' : 'Expenzo'} navigation={navigation} brand
    subtitle={company ? 'Manage. Analyze. Grow.' : 'Track. Save. Succeed.'}>
    <AccountCard style={styles.form} padding={22}>
      <View style={styles.formHeading}>
        <Text accessibilityRole="header" style={[styles.welcome, { color: theme.text }]}>{registering ? 'Create Account' : 'Welcome Back!'}</Text>
        <AccountText style={styles.subtitle}>{registering ? (company ? 'Start managing your business finances' : 'Sign up to get started')
          : (company ? 'Sign in to your business account' : 'Sign in to continue')}</AccountText>
      </View>
      {registering && <>
        {company && <AccountField label="Company name" icon="office-building-outline" placeholder="Enter company name" value={companyName}
          onChangeText={setCompanyName} maxLength={160} autoCapitalize="words" editable={!pending} />}
        <AccountField label={company ? 'Contact name' : 'Full name'} icon="account-outline" placeholder={company ? 'Enter contact name' : 'Enter your full name'}
          value={name} onChangeText={setName} maxLength={120} autoCapitalize="words" autoComplete="name" editable={!pending} />
      </>}
      <AccountField label={company ? 'Company email' : 'Email'} icon="email-outline" placeholder="you@example.com" value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" maxLength={320} editable={!pending} />
      {registering && company && <>
        <AccountField label="Phone (optional)" icon="phone-outline" placeholder="Enter phone number" value={phone} onChangeText={setPhone}
          keyboardType="phone-pad" autoComplete="tel" maxLength={40} editable={!pending} />
        <AccountField label="Industry (optional)" icon="domain" placeholder="Enter your industry" value={industry} onChangeText={setIndustry}
          autoCapitalize="words" maxLength={120} editable={!pending} />
      </>}
      <AccountField label="Password" icon="lock-outline" placeholder="Enter password" value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry
        autoComplete={registering ? 'new-password' : 'current-password'} textContentType={registering ? 'newPassword' : 'password'}
        helperText={registering ? 'Use at least 6 characters.' : undefined} returnKeyType={registering ? 'next' : 'done'}
        onSubmitEditing={registering ? undefined : submit} editable={!pending} />
      {registering && <AccountField label="Confirm password" icon="lock-check-outline" placeholder="Re-enter password" value={confirmation}
        onChangeText={setConfirmation} autoCapitalize="none" secureTextEntry autoComplete="new-password" textContentType="newPassword"
        returnKeyType="done" onSubmitEditing={submit} editable={!pending} />}
      {!registering && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Forgot password?" accessibilityState={{ disabled: pending }}
        onPress={forgotPassword} disabled={pending} style={styles.forgotPassword}>
        <Text style={[styles.link, { color: theme.text }]}>Forgot Password?</Text>
      </TouchableOpacity>}
      <AccountButton title={pending ? (registering ? 'Creating account…' : 'Signing in…') : (registering ? 'Create Account' : 'Sign In')}
        onPress={submit} busy={pending} icon={registering ? 'account-plus-outline' : 'login'} />
      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} /><Text style={[styles.dividerText, { color: theme.textSecondary }]}>OR</Text>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      </View>
      <AccountButton title="Continue with Google" onPress={googleSignIn} disabled={!google.isConfigured || pending} secondary
        leading={<Image source={require('../../assets/g_logo.png')} style={styles.googleLogo} accessibilityIgnoresInvertColors />} />
      {!google.isConfigured && <View style={[styles.notice, { backgroundColor: theme.surfaceVariant }]}>
        <Icon name="information-outline" size={18} color={theme.textSecondary} />
        <AccountText style={styles.noticeText}>{google.reason}</AccountText>
      </View>}
      <View style={styles.switchRow}>
        <Text style={[styles.switchText, { color: theme.textSecondary }]}>{registering ? 'Already have an account?' : "Don't have an account?"}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={registering ? 'Go to sign in' : 'Create an account'}
          accessibilityState={{ disabled: pending }} disabled={pending} onPress={switchAccountScreen} style={styles.switchLink}>
          <Text style={[styles.link, { color: theme.text }]}>{registering ? 'Sign In' : 'Sign Up'}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Read Privacy & data" onPress={() => navigation.navigate('Privacy')} style={styles.privacyLink}>
        <Icon name="shield-lock-outline" size={16} color={theme.textSecondary} />
        <Text style={[styles.privacyText, { color: theme.textSecondary }]}>Privacy & data</Text>
      </TouchableOpacity>
    </AccountCard>
  </AccountScreen>;
}

const styles = StyleSheet.create({
  form: { borderRadius: 30 },
  formHeading: { marginBottom: 10 },
  welcome: { fontSize: 25, lineHeight: 33, fontWeight: '700', marginBottom: 5 },
  subtitle: { fontSize: 15, lineHeight: 23, marginBottom: 18 },
  forgotPassword: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end', marginTop: -8, marginBottom: 12 },
  link: { fontSize: 14, lineHeight: 21, fontWeight: '700', textDecorationLine: 'underline' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 14 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontWeight: '500' },
  googleLogo: { width: 22, height: 22, resizeMode: 'contain' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, marginBottom: 8 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 20, marginBottom: 0 },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  switchText: { fontSize: 14, lineHeight: 21 },
  switchLink: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  privacyLink: { minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 },
  privacyText: { fontSize: 13, lineHeight: 20 },
});
