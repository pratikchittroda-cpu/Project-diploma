import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import { useTheme } from '../../contexts/ThemeContext';
import { AccountScreen, AccountText, useAccountTask } from '../../components/account/AccountPrimitives';

const categoryInfo = {
  Classic: ['star-outline', 'Timeless and elegant'], Nature: ['leaf', 'Inspired by natural beauty'],
  Bold: ['flash', 'Vibrant and energetic'], Elegant: ['diamond-stone', 'Sophisticated colors'],
  Pastel: ['flower', 'Soft and gentle tones'], Cosmic: ['rocket-launch-outline', 'Space and galaxy themes'],
  Professional: ['briefcase-outline', 'Business-ready colors'], Vibrant: ['palette-outline', 'Bright and colorful'],
};

const swatchText = (color) => {
  const hex = color.replace('#', '');
  const values = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return values[0] * 0.299 + values[1] * 0.587 + values[2] * 0.114 > 165 ? '#1A1A1A' : '#fff';
};

export default function ThemesScreen({ navigation }) {
  const { theme, isDarkMode, currentThemeId, themeConfigs, toggleTheme, changeTheme } = useTheme();
  const { width } = useWindowDimensions();
  const { busy, run } = useAccountTask();
  const options = Object.values(themeConfigs);
  const categories = options.reduce((groups, option) => {
    const name = option.category || 'Other';
    if (!groups[name]) groups[name] = [];
    groups[name].push(option);
    return groups;
  }, {});
  const setMode = (dark) => {
    if (dark !== isDarkMode) run(() => toggleTheme());
  };

  return <AccountScreen title="Themes & Appearance" navigation={navigation}>
    <GlassCard padding={20} style={[styles.modeCard, { backgroundColor: theme.surface }]}>
      <View style={styles.modeHeader}>
        <View style={[styles.iconBadge, { backgroundColor: theme.primaryContainer }]}>
          <MaterialCommunityIcons name="theme-light-dark" size={26} color={theme.accent || theme.primary} />
        </View>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>Appearance</Text>
          <Text style={[styles.secondary, { color: theme.textSecondary }]}>{isDarkMode ? 'Dark theme active' : 'Light theme active'}</Text>
        </View>
      </View>
      <View style={[styles.modeToggle, { backgroundColor: theme.surfaceVariant }]}>
        {[['Light', 'weather-sunny', false], ['Dark', 'weather-night', true]].map(([label, icon, dark]) => {
          const selected = dark === isDarkMode;
          return <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={`Use ${label.toLowerCase()} mode`}
            accessibilityState={{ selected, disabled: busy }} disabled={busy} onPress={() => setMode(dark)} activeOpacity={0.8}
            style={[styles.modeButton, selected && { backgroundColor: theme.primaryContainer, borderColor: theme.accent || theme.primary }]}>
            <MaterialCommunityIcons name={icon} size={20} color={selected ? (theme.accent || theme.primary) : theme.textSecondary} />
            <Text style={[styles.modeLabel, { color: selected ? theme.text : theme.textSecondary }]}>{label}</Text>
            {selected && <MaterialCommunityIcons name="check" size={16} color={theme.accent || theme.primary} />}
          </TouchableOpacity>;
        })}
      </View>
    </GlassCard>
    <AccountText onGradient>Appearance is a preference for this device. Choose from {options.length} color themes; changes apply immediately.</AccountText>

    {Object.entries(categories).map(([category, themes]) => {
      const [icon, description] = categoryInfo[category] || ['palette-outline', 'More color themes'];
      return <View key={category} style={styles.category}>
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <MaterialCommunityIcons name={icon} size={21} color="#fff" />
          </View>
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={[styles.heading, { color: '#fff' }]}>{category}</Text>
            <Text style={[styles.secondary, { color: 'rgba(255,255,255,0.85)' }]}>{description}</Text>
          </View>
          <Text style={[styles.count, { color: '#fff', backgroundColor: 'rgba(255,255,255,0.18)' }]}>{themes.length}</Text>
        </View>
        <View style={styles.grid}>
          {themes.map((option) => {
            const selected = option.id === currentThemeId;
            const color = swatchText(option.colors[0]);
            return <TouchableOpacity key={option.id} disabled={busy} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel={`${option.name} color theme`}
              accessibilityState={{ selected, disabled: busy }} onPress={() => run(() => changeTheme(option.id))}
              style={[styles.themeCard, { width: width < 360 ? '100%' : '48%', backgroundColor: theme.surface,
                borderColor: selected ? (theme.accent || theme.primary) : theme.border, borderWidth: selected ? 2 : 1 }]}>
              <LinearGradient colors={option.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.preview}>
                <MaterialCommunityIcons name="palette" size={24} color={color} />
                <Text style={[styles.previewLabel, { color }]}>{option.name}</Text>
                {selected && <View style={styles.selectedBadge}><MaterialCommunityIcons name="check" size={16} color="#fff" /></View>}
              </LinearGradient>
              <View style={styles.themeInfo}>
                <Text style={[styles.themeName, { color: theme.text }]}>{option.name}</Text>
                {selected && <Text style={[styles.activeText, { color: theme.textSecondary }]}>Active</Text>}
                <Text style={[styles.description, { color: theme.textSecondary }]}>{option.description}</Text>
                <View style={styles.swatches}>{option.colors.map((swatch, index) => <View key={index}
                  style={[styles.swatch, { backgroundColor: swatch, borderColor: theme.border }]} />)}</View>
              </View>
            </TouchableOpacity>;
          })}
        </View>
      </View>;
    })}
  </AccountScreen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modeCard: { borderRadius: 20, marginBottom: 18 },
  modeHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  iconBadge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 18, fontWeight: '700' },
  secondary: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  modeToggle: { flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4 },
  modeButton: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 8 },
  modeLabel: { fontSize: 15, fontWeight: '600' },
  category: { marginBottom: 26 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  categoryIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 13, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  themeCard: { borderRadius: 16, overflow: 'hidden' },
  preview: { minHeight: 86, alignItems: 'center', justifyContent: 'center', padding: 12 },
  previewLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  selectedBadge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#167D49', alignItems: 'center', justifyContent: 'center' },
  themeInfo: { padding: 12, minHeight: 116 },
  themeName: { fontSize: 14, fontWeight: '600' },
  activeText: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  description: { fontSize: 12, lineHeight: 17, marginTop: 5, marginBottom: 10 },
  swatches: { flexDirection: 'row', gap: 7 },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth },
});
