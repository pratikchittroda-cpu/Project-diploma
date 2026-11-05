import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { Icon } from '../../constants/Icons';
import { remoteProfileImage } from '../../utils/profileImage';
import BrandLogo from '../BrandLogo';
import GlassCard from '../GlassCard';
import AppBackground from '../AppBackground';
import LogoLoader from '../LogoLoader';

const AccountTone = createContext(false);

// Keep the chosen theme's hues while making white gradient labels readable.
export function accountGradientColors(theme) {
  return [theme.primary, theme.primaryLight || theme.primary].map((color) => {
    if (!/^#[\da-f]{6}$/i.test(color)) return '#4C56A5';
    let rgb = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
    const luminance = () => rgb.reduce((sum, value, index) => {
      const channel = value / 255;
      return sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
    }, 0);
    while (1.05 / (luminance() + 0.05) < 4.5) rgb = rgb.map((value) => Math.floor(value * 0.94));
    return `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  });
}

export function AccountScreen({ title, navigation, children, subtitle, brand = false, hero, headerRight, onBack, contentContainerStyle }) {
  const { theme } = useTheme();
  const backgroundColors = theme.isDarkMode ? theme.pageGradientColors || [theme.background, theme.background] : accountGradientColors(theme);
  const canGoBack = !!onBack || navigation?.canGoBack?.();
  const back = canGoBack ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back"
    onPress={onBack || (() => navigation.goBack())} activeOpacity={0.8} style={styles.backButton}>
    <Icon name="arrow-left" size={24} color="#fff" />
  </TouchableOpacity> : <View style={styles.headerSpacer} />;
  return <View style={[styles.screen, { backgroundColor: backgroundColors[0] }]}>
    <AppBackground colors={backgroundColors} />
    <StatusBar barStyle="light-content" backgroundColor={backgroundColors[0]} />
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AccountTone.Provider value>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.page, contentContainerStyle]}>
            {brand ? <View style={styles.brandHeader}>
              <View style={styles.brandBack}>{back}</View>
              <View style={[styles.brandLogo, { backgroundColor: theme.isDarkMode ? (theme.cardBackgroundElevated || '#f3f5ff') : '#f3f5ff' }]}><BrandLogo size={48} /></View>
              <Text accessibilityRole="header" style={styles.brandTitle}>{title}</Text>
              {!!subtitle && <Text style={styles.brandSubtitle}>{subtitle}</Text>}
            </View> : <View style={styles.header}>
              {back}
              <View style={styles.heading}>
                <Text accessibilityRole="header" style={styles.title}>{title}</Text>
                {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
              </View>
              {headerRight || <View style={styles.headerSpacer} />}
            </View>}
            {hero}
            {children}
          </ScrollView>
        </AccountTone.Provider>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>;
}

export function AccountText({ children, style, onGradient = false, ...props }) {
  const { theme } = useTheme();
  return <Text style={[styles.text, { color: onGradient ? '#fff' : theme.textSecondary || theme.text }, style]} {...props}>{children}</Text>;
}

export function AccountCard({ children, style, padding = 20 }) {
  return <GlassCard padding={padding} borderRadius={22} borderWidth={1} style={[styles.card, style]}>
    <AccountTone.Provider value={false}>{children}</AccountTone.Provider>
  </GlassCard>;
}

export function AccountSection({ title, children, subtitle, style }) {
  const { theme } = useTheme();
  const onGradient = useContext(AccountTone);
  return <View style={[styles.section, style]}>
    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: onGradient ? '#fff' : theme.text }]}>{title}</Text>
    {!!subtitle && <AccountText onGradient={onGradient} style={styles.sectionSubtitle}>{subtitle}</AccountText>}
    {children}
  </View>;
}

export function AccountField({ label, icon, helperText, secureTextEntry, editable = true, style, labelStyle, onFocus, onBlur, ...props }) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return <View style={styles.field}>
    <Text style={[styles.fieldLabel, { color: theme.text }, labelStyle]}>{label}</Text>
    <View style={[styles.inputContainer, { borderColor: focused ? theme.accent || accountGradientColors(theme)[0] : theme.border, backgroundColor: theme.inputBackground || theme.surface }]}>
      {!!icon && <Icon name={icon} size={20} color={theme.textSecondary} style={styles.inputIcon} />}
      <TextInput accessibilityLabel={label} autoCorrect={false} placeholderTextColor={theme.textSecondary} {...props}
        editable={editable} secureTextEntry={!!secureTextEntry && !visible}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }} onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[styles.input, { color: theme.text }, style]} />
      {!!secureTextEntry && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        accessibilityState={{ disabled: !editable }} disabled={!editable} onPress={() => setVisible((value) => !value)} style={styles.eyeButton}>
        <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.textSecondary} />
      </TouchableOpacity>}
    </View>
    {!!helperText && <AccountText style={styles.fieldHelper}>{helperText}</AccountText>}
  </View>;
}

export function AccountButton({ title, onPress, disabled, busy, secondary, destructive, icon, leading, accessibilityLabel, style, textStyle }) {
  const { theme } = useTheme();
  const color = secondary ? (destructive ? (theme.isDarkMode ? '#FFB4AB' : '#B42318') : theme.text) : '#fff';
  const content = <>
    {busy ? <LogoLoader color={color} accessibilityLabel={`${title} in progress`} /> : leading || (!!icon && <Icon name={icon} size={21} color={color} />)}
    <Text style={[styles.buttonText, { color }, textStyle]}>{title}</Text>
  </>;
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }} disabled={disabled || busy}
    accessibilityLabel={accessibilityLabel || title} activeOpacity={0.8} onPress={onPress}
    style={[styles.button, { opacity: disabled || busy ? 0.7 : 1 }, style]}>
    {secondary ? <View style={[styles.buttonContent, styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surface }]}>{content}</View>
      : <LinearGradient colors={destructive ? ['#B42318', '#88170F'] : accountGradientColors(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonContent}>{content}</LinearGradient>}
  </TouchableOpacity>;
}

export function AccountRow({ title, subtitle, icon, onPress, disabled, destructive, control, value, accessibilityLabel, tone }) {
  const { theme } = useTheme();
  const color = destructive ? (theme.isDarkMode ? '#FFB4AB' : '#B42318') : theme.text;
  const iconTone = destructive ? 'red' : tone || (disabled ? 'gray' : 'blue');
  const iconColors = { blue: theme.isDarkMode ? '#93C5FD' : '#2563EB', green: theme.isDarkMode ? '#86EFAC' : '#15803D',
    orange: theme.isDarkMode ? '#FED7AA' : '#9A3412', purple: theme.isDarkMode ? '#D8B4FE' : '#7E22CE', gray: theme.textSecondary, red: color };
  const body = <GlassCard padding={16} borderRadius={16} borderWidth={1}>
    <View style={styles.row}>
      {!!icon && <View style={[styles.rowIcon, { backgroundColor: theme.iconBackground?.[iconTone] || theme.surfaceVariant }]}>
        <Icon name={icon} size={23} color={iconColors[iconTone] || theme.textSecondary} />
      </View>}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
      </View>
      {control || (!!value && <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{value}</Text>)}
      {!!onPress && !control && <Icon name="chevron-right" size={23} color={theme.textSecondary} />}
    </View>
  </GlassCard>;
  return onPress ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel || [title, subtitle].filter(Boolean).join('. ')}
    accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} activeOpacity={0.8} style={styles.rowContainer}>{body}</TouchableOpacity>
    : <View style={styles.rowContainer} accessible={!control} accessibilityLabel={accessibilityLabel || [title, subtitle, value].filter(Boolean).join('. ')}
      accessibilityState={{ disabled: !!disabled }}>{body}</View>;
}

export function AccountAvatar({ uri, company = false, size = 100, onEdit, photoUnavailable = false }) {
  const { theme } = useTheme();
  const [failedImage, setFailedImage] = useState(null);
  const image = remoteProfileImage(uri);
  return <View style={[styles.avatarContainer, { width: size, height: size }]}>
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {image && failedImage !== image ? <Image accessibilityLabel={company ? 'Company logo' : 'Profile photo'} source={{ uri: image }}
        style={{ width: size, height: size }} onError={() => setFailedImage(image)} /> : <Icon name={company ? 'office-building' : 'account'} size={size * 0.55} color="#fff" />}
    </View>
    {(!!onEdit || photoUnavailable) && <TouchableOpacity accessibilityRole="button" accessibilityLabel={photoUnavailable ? 'Photo uploads unavailable in this build' : 'Edit profile'}
      accessibilityState={{ disabled: photoUnavailable }} disabled={photoUnavailable} onPress={onEdit}
      style={[styles.avatarEdit, { backgroundColor: theme.surface }]}>
      <Icon name={photoUnavailable ? 'camera-off-outline' : 'pencil-outline'} size={20} color={theme.text} />
    </TouchableOpacity>}
  </View>;
}

export function useAccountTask() {
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (task) => {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    try { return await task(() => mounted.current); }
    finally { active.current = false; if (mounted.current) setBusy(false); }
  };
  return { busy, run };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 24 },
  heading: { flex: 1, minWidth: 0, alignItems: 'center' },
  title: { fontSize: 21, fontWeight: '700', color: '#fff', textAlign: 'center', lineHeight: 28 },
  headerSubtitle: { fontSize: 13, lineHeight: 19, color: '#fff', textAlign: 'center', marginTop: 4 },
  headerSpacer: { width: 44 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  brandHeader: { alignItems: 'center', paddingTop: 18, paddingBottom: 28, paddingHorizontal: 24 },
  brandBack: { position: 'absolute', top: 8, left: 0 },
  brandLogo: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#f3f5ff', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  brandTitle: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 6 },
  brandSubtitle: { fontSize: 16, lineHeight: 24, color: '#fff', textAlign: 'center' },
  text: { fontSize: 16, lineHeight: 24, marginBottom: 16 },
  card: { marginBottom: 16 },
  section: { marginTop: 10, marginBottom: 14 },
  sectionTitle: { fontSize: 18, lineHeight: 26, fontWeight: '700', marginBottom: 14 },
  sectionSubtitle: { fontSize: 14, lineHeight: 21, marginTop: -6, marginBottom: 12 },
  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, minHeight: 56, paddingLeft: 14, paddingRight: 4 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, minWidth: 0, minHeight: 54, paddingVertical: 14, paddingRight: 10, fontSize: 16 },
  eyeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fieldHelper: { fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 0 },
  button: { minHeight: 54, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  buttonContent: { minHeight: 54, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  secondaryButton: { borderRadius: 14, borderWidth: 1 },
  buttonText: { flexShrink: 1, fontSize: 16, lineHeight: 24, fontWeight: '700', textAlign: 'center' },
  rowContainer: { minHeight: 44, marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  rowSubtitle: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  rowValue: { maxWidth: 90, fontSize: 12, lineHeight: 18, textAlign: 'right', flexShrink: 1 },
  avatarContainer: { position: 'relative', marginBottom: 18 },
  avatar: { overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  avatarEdit: { position: 'absolute', bottom: -3, right: -6, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
