import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import { AccountScreen, accountGradientColors } from '../../components/account/AccountPrimitives';
import { useTheme } from '../../contexts/ThemeContext';
import { PRIVACY_POLICY_URL, ACCOUNT_DELETION_URL, SUPPORT_EMAIL } from '../../config/publicConfig';
import MessageService from '../../services/MessageService';

export default function PrivacyScreen({ navigation }) {
  const { theme } = useTheme();
  const open = async (url, email = false) => {
    const valid = email ? /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(url) : /^https:\/\/[^\s]+$/.test(url);
    if (!valid) return MessageService.showError('Configuration incomplete', 'The publisher has not supplied this public contact or URL. This is a publishing requirement.');
    try { await Linking.openURL(email ? `mailto:${url}?subject=Expenzo%20privacy%20request` : url); }
    catch { MessageService.showError('Unable to open', 'Please try again or use the public policy contact.'); }
  };
  const sections = [
    ['Account and finance data', 'Firebase Authentication manages sign-in. Firestore stores profile information and the income, expense, budget, team and employee records you enter. Company records belong to the company account owner; adding an employee does not create a shared employee login.'],
    ['AI and provider transfer', 'AI features use an authenticated API on Expo EAS Hosting. Only after you choose sharing consent and request a reply, chat sends your question, bounded recent chat and verified month-to-date finance/budget aggregates to NVIDIA. Raw ledger descriptions, employee details and account identifiers are not included in the chat provider context. Category and receipt tools send only the description or receipt text you explicitly submit; remove private details you do not want to share. Local budget insights are calculated on your device and do not use an AI provider.'],
    ['Chat storage and usage', 'Expenzo does not persist AI questions, answers, receipt text or sharing consent on its API. Chat stays in memory until Clear chat, closing the conversation or changing accounts; opening Privacy does not clear an ongoing conversation. Chat sharing consent is asked once and remembered on this device for your account until you revoke it in chat or sign out. AI transaction tools have their own consent, also asked once and remembered on this device for your account until you revoke it on the form or sign out. Firestore stores daily request counters linked to your account and an aggregate service counter to protect usage; these are retained until the publisher removes them. AI reporting is not enabled. Expo and NVIDIA processing, service logs and retention are governed by their own policies.'],
    ['Deletion', 'Server account deletion is unavailable in this free-tier release. The AI API does not implement account deletion, and the app does not open an in-app server-deletion prompt. Use the external account-deletion route or contact privacy support below when configured; those links remain the available request path.'],
    ['External requests', 'The public account-deletion page provides a support-email request flow. The free-tier release does not include a server-side deletion function, so support must verify ownership and manually process requests. Do not send passwords, sign-in codes, ID tokens or financial records.'],
    ['Security and other data', 'Firebase Authentication manages sign-in and Firestore rules restrict account access to core finance, budget and team data. The hosted AI API verifies your Firebase session, reads only your finance records, requires explicit sharing consent and enforces daily request caps. Provider keys stay on the server, not in the APK. Profile photo uploads are unavailable and no Firebase Storage upload is attempted; file:// image links are not accepted for Firestore profile updates.'],
  ];
  const sectionIcons = ['database-outline', 'robot-outline', 'file-document-outline', 'account-remove-outline', 'open-in-new', 'shield-lock-outline'];
  const links = [
    [PRIVACY_POLICY_URL, 'Public privacy policy', 'file-document-outline'],
    [ACCOUNT_DELETION_URL, 'Request account deletion online', 'account-remove-outline'],
    [SUPPORT_EMAIL, 'Contact privacy support', 'email-outline', true],
  ];
  return <AccountScreen title="Privacy & data" navigation={navigation}>
    <GlassCard padding={22} style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.intro}>
        <LinearGradient colors={accountGradientColors(theme)} style={styles.heroIcon}>
          <MaterialCommunityIcons name="shield-account" size={32} color="#fff" />
        </LinearGradient>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>Your data, clearly explained</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>How this release uses account and financial information.</Text>
        </View>
      </View>
    </GlassCard>
    {sections.map(([title, body], index) => <GlassCard key={title} padding={20}
      style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: theme.primaryContainer }]}>
          <MaterialCommunityIcons name={sectionIcons[index]} size={22} color={theme.accent || theme.primary} />
        </View>
        <Text accessibilityRole="header" style={[styles.heading, styles.flex, { color: theme.text }]}>{title}</Text>
      </View>
      <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>
    </GlassCard>)}
    <GlassCard padding={20} style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text accessibilityRole="header" style={[styles.heading, styles.linksTitle, { color: theme.text }]}>Policy & requests</Text>
      {links.map(([url, label, icon, email], index) => <TouchableOpacity accessibilityRole="link" key={label}
        accessibilityHint={!url ? 'This publisher contact is not configured' : email ? 'Open your email app' : 'Open the public website'}
        onPress={() => open(url, email)} activeOpacity={0.8}
        style={[styles.link, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
        <MaterialCommunityIcons name={icon} size={23} color={theme.accent || theme.primary} />
        <View style={styles.flex}>
          <Text style={[styles.linkText, { color: theme.text }]}>{label}</Text>
          {!url && <Text style={[styles.notConfigured, { color: theme.textSecondary }]}>Not configured</Text>}
        </View>
        <MaterialCommunityIcons name="open-in-new" size={18} color={theme.textSecondary} />
      </TouchableOpacity>)}
    </GlassCard>
  </AccountScreen>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, card: { borderRadius: 20, marginBottom: 16 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroIcon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 18, fontWeight: '700', lineHeight: 25 },
  body: { fontSize: 15, lineHeight: 23, marginTop: 6 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  sectionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  linksTitle: { marginBottom: 8 },
  link: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  linkText: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  notConfigured: { fontSize: 12, marginTop: 4 },
});
