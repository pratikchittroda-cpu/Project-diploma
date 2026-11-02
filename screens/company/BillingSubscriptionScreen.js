import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import { useTheme } from '../../contexts/ThemeContext';
import { AccountScreen, accountGradientColors } from '../../components/account/AccountPrimitives';

export default function BillingSubscriptionScreen({ navigation }) {
  const { theme } = useTheme();
  const actions = [
    ['credit-card-edit-outline', 'Update Payment Method', 'No payment provider or payment-method editor is configured.'],
    ['file-document-outline', 'View Invoices', 'This build does not generate invoices or billing history.'],
    ['cancel', 'Cancel Subscription', 'No subscription service is connected, so cancellation is unavailable.'],
  ];
  return <AccountScreen title="Billing & Subscription" navigation={navigation}>
    <GlassCard padding={22} style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.currentHeader}>
        <LinearGradient colors={accountGradientColors(theme)} style={styles.heroIcon}>
          <MaterialCommunityIcons name="credit-card-outline" size={30} color="#fff" />
        </LinearGradient>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>Current Subscription</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Billing service not configured</Text>
        </View>
      </View>
      <Text style={[styles.body, { color: theme.textSecondary }]}>This build has no subscription or payment service. No paid plan, payment method or entitlement can be verified here.</Text>
      <View style={[styles.billingInfo, { borderTopColor: theme.border }]}>
        {[['Current plan', 'Not available'], ['Next billing', 'Not available'], ['Payment method', 'Not connected']].map(([label, value]) => <View key={label} style={styles.billingRow}>
          <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>{label}</Text>
          <Text style={[styles.billingValue, { color: theme.text }]}>{value}</Text>
        </View>)}
      </View>
    </GlassCard>

    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: '#fff' }]}>Subscription Plans</Text>
    <GlassCard padding={22} style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.planHeader}>
        <View style={[styles.planIcon, { backgroundColor: theme.primaryContainer }]}>
          <MaterialCommunityIcons name="crown-outline" size={28} color={theme.accent || theme.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.heading, { color: theme.text }]}>Plans unavailable</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>No plans are offered in this build</Text>
        </View>
      </View>
      <View style={styles.features}>
        {['Prices and billing cycles are not configured.', 'Purchases and upgrades are not implemented.', 'No paid entitlements are granted by this screen.'].map((item) => <View key={item} style={styles.featureRow}>
          <MaterialCommunityIcons name="information-outline" size={18} color={theme.textSecondary} />
          <Text style={[styles.featureText, { color: theme.textSecondary }]}>{item}</Text>
        </View>)}
      </View>
      <TouchableOpacity disabled accessibilityRole="button" accessibilityState={{ disabled: true }}
        style={[styles.planButton, { backgroundColor: theme.surfaceVariant }]}>
        <MaterialCommunityIcons name="lock-outline" size={18} color={theme.textSecondary} />
        <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Upgrade unavailable</Text>
      </TouchableOpacity>
    </GlassCard>

    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: '#fff' }]}>Billing Management</Text>
    {actions.map(([icon, title, description]) => <TouchableOpacity key={title} disabled
      accessibilityRole="button" accessibilityLabel={`${title}. Unavailable. ${description}`}
      accessibilityState={{ disabled: true }} style={styles.action}>
      <GlassCard padding={18} style={{ backgroundColor: theme.surface }}>
        <View style={styles.actionRow}>
          <View style={[styles.actionIcon, { backgroundColor: theme.primaryContainer }]}>
            <MaterialCommunityIcons name={icon} size={23} color={theme.accent || theme.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.actionTitle, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{description}</Text>
            <Text style={[styles.inactiveLabel, { color: theme.textSecondary }]}>Unavailable</Text>
          </View>
          <MaterialCommunityIcons name="lock-outline" size={18} color={theme.textSecondary} />
        </View>
      </GlassCard>
    </TouchableOpacity>)}
  </AccountScreen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 20, marginBottom: 24 },
  currentHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  heroIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 18, fontWeight: '700', lineHeight: 25 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 5 },
  body: { fontSize: 15, lineHeight: 23 },
  billingInfo: { marginTop: 18, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  billingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  billingLabel: { fontSize: 14 },
  billingValue: { fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  planIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  features: { gap: 10, marginBottom: 22 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureText: { flex: 1, fontSize: 14, lineHeight: 21 },
  planButton: { minHeight: 50, padding: 14, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
  action: { borderRadius: 18, overflow: 'hidden', marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 16, fontWeight: '600' },
  inactiveLabel: { fontSize: 12, fontWeight: '600', marginTop: 8 },
});
