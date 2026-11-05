import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Icon } from '../../constants/Icons';
import { AI_FEATURES_ENABLED, SERVER_FEATURES_ENABLED } from '../../config/releaseFeatures';
import { AI_API_BASE_URL, API_BASE_URL } from '../../config/publicConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useStoredChatConsent } from '../../utils/aiConsent';
import { Card, Copy, useFinanceCardColors } from './FinanceUI';

const AI_CONNECTED = Boolean((AI_FEATURES_ENABLED || SERVER_FEATURES_ENABLED) && (AI_API_BASE_URL || API_BASE_URL));

export default function HomeAIEntry({ navigation }) {
  const colors = useFinanceCardColors();
  const { user } = useAuth() || {};
  // Consent is asked once per account; once given, the badge confirms it instead of asking again.
  const sharingOn = useStoredChatConsent(user?.uid);
  const badge = !AI_CONNECTED ? 'Setup required' : sharingOn ? 'Sharing on' : 'Consent required';
  return <TouchableOpacity testID="home-ai-entry" accessibilityRole="button" accessibilityLabel="Ask Financial AI"
    accessibilityHint={`Opens secure financial chat. ${sharingOn ? 'Data sharing is on for this account; revoke it in chat at any time.' : 'Review sharing and consent before sending a question to hosted NVIDIA AI.'} No data is sent automatically.`}
    onPress={() => navigation.navigate('AIChat')} activeOpacity={0.85} style={styles.entry}>
    <Card padding={16} style={styles.card} contentStyle={styles.entryContent}>
    <View style={[styles.icon, { backgroundColor: colors.surface }]}><Icon name="robot-excited-outline" size={20} color={colors.accent} /></View>
    <View style={styles.textWrap}>
      <View style={styles.titleRow}>
        <Copy heading style={styles.title}>Ask Financial AI</Copy>
        <View style={[styles.badge, { backgroundColor: colors.surface }]}><Copy style={[styles.badgeText, { color: AI_CONNECTED && sharingOn ? colors.income : colors.warning }]}>{badge}</Copy></View>
      </View>
      <Copy muted style={styles.subtitle}>Ask about spending, budgets and savings.</Copy>
      {!AI_CONNECTED && <Copy style={[styles.connectionNote, { color: colors.warning }]}>Configure the secure AI connection to receive replies.</Copy>}
    </View>
    <Icon name="chevron-right" size={20} color={colors.muted} />
    </Card>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  entry: { minHeight: 76, minWidth: 44, borderRadius: 22 },
  card: { borderRadius: 22 },
  entryContent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, lineHeight: 16, fontWeight: '700' },
  subtitle: { fontSize: 13, lineHeight: 20 },
  connectionNote: { fontSize: 12, lineHeight: 18 },
});
