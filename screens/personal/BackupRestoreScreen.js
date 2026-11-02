import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import { useTheme } from '../../contexts/ThemeContext';
import { AccountButton, AccountScreen, accountGradientColors } from '../../components/account/AccountPrimitives';

export default function BackupRestoreScreen({ navigation }) {
  const { theme } = useTheme();
  const inactiveAction = (icon, title, description) => <TouchableOpacity key={title} disabled
    accessibilityRole="button" accessibilityLabel={`${title}. Unavailable. ${description}`}
    accessibilityState={{ disabled: true }} style={styles.inactiveAction}>
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
        <MaterialCommunityIcons name="lock-outline" size={19} color={theme.textSecondary} />
      </View>
    </GlassCard>
  </TouchableOpacity>;

  return <AccountScreen title="Backup & Restore" navigation={navigation}>
    <GlassCard padding={22} style={[styles.statusCard, { backgroundColor: theme.surface }]}>
      <View style={styles.statusHeader}>
        <LinearGradient colors={accountGradientColors(theme)} style={styles.statusIcon}>
          <MaterialCommunityIcons name="cloud-off-outline" size={30} color="#fff" />
        </LinearGradient>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>Backup Status</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Service not configured</Text>
        </View>
      </View>
      <Text style={[styles.notice, { color: theme.textSecondary }]}>This build does not offer an export, backup or restore feature. No backup service or cloud-storage connection is implemented.</Text>
      <View style={[styles.statusInfo, { borderTopColor: theme.border }]}>
        {[["Last backup", 'Not available'], ['Backup size', 'Not available'], ['Cloud provider', 'Not connected']].map(([label, value]) => <View key={label} style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>{label}</Text>
          <Text style={[styles.statusValue, { color: theme.text }]}>{value}</Text>
        </View>)}
      </View>
    </GlassCard>

    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.heading, styles.sectionTitle, { color: '#fff' }]}>Backup Actions</Text>
      {inactiveAction('backup-restore', 'Backup Now', 'Creating or exporting a backup is not implemented.')}
      {inactiveAction('restore', 'Restore from Backup', 'Importing files or replacing account data is not implemented.')}
    </View>
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.heading, styles.sectionTitle, { color: '#fff' }]}>Settings</Text>
      {inactiveAction('cloud-sync-outline', 'Cloud Provider', 'No Google Drive, iCloud or Dropbox backup connection is configured.')}
      {inactiveAction('calendar-clock', 'Backup Schedule', 'Automatic backup scheduling is not implemented.')}
    </View>
    <GlassCard padding={20} style={[styles.statusCard, { backgroundColor: theme.surface }]}>
      <View style={styles.actionRow}>
        <MaterialCommunityIcons name="information-outline" size={24} color={theme.accent || theme.primary} />
        <Text style={[styles.notice, styles.flex, { color: theme.textSecondary }]}>Your account records are stored in Firestore. That does not provide an in-app export or user-managed restore.</Text>
      </View>
    </GlassCard>
    <AccountButton title="Privacy & data" onPress={() => navigation.navigate('Privacy')} secondary />
  </AccountScreen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  statusCard: { borderRadius: 20, marginBottom: 22 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  statusIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 18, fontWeight: '700' },
  notice: { fontSize: 15, lineHeight: 23 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 5 },
  statusInfo: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 18, gap: 10 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 },
  statusLabel: { fontSize: 14 },
  statusValue: { fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 16 },
  sectionTitle: { marginBottom: 14 },
  inactiveAction: { marginBottom: 12, borderRadius: 18, overflow: 'hidden' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 16, fontWeight: '600' },
  inactiveLabel: { fontSize: 12, fontWeight: '600', marginTop: 8 },
});
