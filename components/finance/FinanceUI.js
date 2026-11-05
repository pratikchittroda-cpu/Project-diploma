import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, RefreshControl, KeyboardAvoidingView, Platform, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from '../../constants/Icons';
import GlassCard from '../GlassCard';
import AppBackground from '../AppBackground';
import LogoLoader from '../LogoLoader';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../config/firebase';
import { formatMoney, ledgerDate, normalizeCategory } from '../../utils/finance';

const FinanceSurface = createContext(null);
const whitePalette = {
  ink: '#FFFFFF', muted: '#FFFFFF', border: 'rgba(255,255,255,0.18)',
  surface: 'rgba(255,255,255,0.10)', input: 'rgba(0,0,0,0.12)',
  income: '#91F0B8', expense: '#FFB9C3', warning: '#FFE1A3', accent: '#C7D7FF', light: false,
};

export const CATEGORY_DETAILS = {
  food: ['Food & Dining', 'hamburger', '#FBB45C'], transport: ['Transport', 'car', '#7CC8FF'],
  shopping: ['Shopping', 'shopping', '#F8A6D6'], entertainment: ['Entertainment', 'movie-open', '#C5A7FF'],
  bills: ['Bills & Utilities', 'receipt', '#FEAD9F'], health: ['Healthcare', 'medical-bag', '#8EE3BA'],
  education: ['Education', 'school', '#A9C3FF'], other: ['Other', 'dots-horizontal', '#B8C6DC'],
  salary: ['Salary', 'cash-multiple', '#8EE3BA'], freelance: ['Freelance', 'laptop', '#7CC8FF'],
  business: ['Business', 'briefcase', '#C5A7FF'], investment: ['Investment', 'trending-up', '#8EE3BA'],
  gift: ['Gift', 'gift', '#F8A6D6'], 'office-supplies': ['Office Supplies', 'office-building', '#7CC8FF'],
  marketing: ['Marketing', 'bullhorn', '#F8A6D6'], travel: ['Travel', 'airplane', '#A9C3FF'],
  utilities: ['Utilities', 'flash', '#FFE1A3'], rent: ['Rent & Facilities', 'home', '#C5A7FF'],
  equipment: ['Equipment', 'desktop-mac', '#7CC8FF'], software: ['Software', 'application', '#C5A7FF'],
  salaries: ['Salaries', 'account-group', '#8EE3BA'], 'professional-services': ['Professional Services', 'account-tie', '#FBB45C'],
  insurance: ['Insurance', 'shield-check', '#8EE3BA'], sales: ['Sales', 'cash-register', '#8EE3BA'],
  services: ['Services', 'handshake', '#7CC8FF'], consulting: ['Consulting', 'account-tie', '#C5A7FF'],
};
export function categoryDetails(value) {
  const key = normalizeCategory(value);
  const [label, icon, color] = CATEGORY_DETAILS[key] || [String(value || 'Other').replace(/-/g, ' '), 'help-circle-outline', '#B8C6DC'];
  return { label, icon, color };
}
export function useFinanceCardColors() {
  const { theme } = useTheme();
  const dark = theme.isDarkMode;
  // Inner tiles, tracks and dividers are translucent so they sit on the glass instead of over it.
  return { ink: theme.text, muted: theme.textSecondary, border: dark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.10)',
    card: theme.cardBackground || theme.card || theme.surface, surface: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)',
    input: theme.inputBackground, selected: theme.inputBackgroundFocused || theme.border,
    income: theme.successForeground || (dark ? '#91F0B8' : '#157A45'),
    expense: theme.errorForeground || (dark ? '#FFB9C3' : '#B52E43'), warning: theme.warningForeground || (dark ? '#FFE1A3' : '#865200'),
    accent: theme.accent || theme.primary, light: !dark };
}
export function useFinanceColors() {
  const colors = useFinanceCardColors();
  const surface = useContext(FinanceSurface);
  return surface || colors;
}

function colorBrightness(color) {
  const hex = String(color).replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 0;
  return (parseInt(hex.slice(0, 2), 16) * 299 + parseInt(hex.slice(2, 4), 16) * 587 + parseInt(hex.slice(4, 6), 16) * 114) / 1000;
}

export const styles = StyleSheet.create({
  page: { flex: 1 }, centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, gap: 12 },
  headerText: { flex: 1, minWidth: 0, gap: 4 }, title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.3 },
  // Finance screens can sit above the floating personal/company tab bar.
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 180, gap: 20 },
  card: { borderRadius: 24 },
  cardContent: { padding: 20, gap: 14 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  button: { minHeight: 48, minWidth: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  iconButton: { width: 48, height: 48, borderRadius: 24, padding: 0 }, iconButtonContent: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  iconButtonGlyph: { width: 24, height: 24, lineHeight: 24, textAlign: 'center', textAlignVertical: 'center' }, buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  text: { fontSize: 15, lineHeight: 23 }, heading: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  caption: { fontSize: 12, lineHeight: 18 }, amount: { fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: 0.3 },
  input: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, lineHeight: 24 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  field: { gap: 8 }, prefix: { fontSize: 28, lineHeight: 36, fontWeight: '600', paddingLeft: 16 },
  inputLarge: { fontSize: 32, lineHeight: 40, fontWeight: '700', minHeight: 76 }, inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', padding: 4, borderRadius: 16, gap: 4 }, choice: { flexGrow: 1, minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, categoryChoice: { flexGrow: 1, flexBasis: '45%', minHeight: 92, borderRadius: 16, borderWidth: 1, padding: 12, gap: 8 },
  categoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, metricCard: { flex: 1, minWidth: 135 },
  metric: { flexGrow: 1, minWidth: 105, gap: 6 }, metricValue: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  iconCircle: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  refreshLoader: { alignItems: 'center', paddingBottom: 8 },
  divider: { borderTopWidth: 1, paddingTop: 14, gap: 6 }, section: { gap: 12 }, badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  state: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 14 }, stateText: { textAlign: 'center' },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 4 },
  ring: { alignSelf: 'center', width: 168, height: 168, alignItems: 'center', justifyContent: 'center' }, ringText: { alignItems: 'center', maxWidth: 122 },
  transactionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }, transactionDetails: { flex: 1, minWidth: 100, gap: 4 },
  transactionAmount: { fontSize: 17, lineHeight: 25, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  transactionBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingLeft: 54 },
});

export function FinanceAccount({ component: Component, ...props }) {
  const { user } = useAuth();
  const { theme, isLoading } = useTheme();
  if (isLoading || !theme) return <SafeAreaView style={styles.centered}><LogoLoader size="large" accessibilityLabel="Loading theme" /></SafeAreaView>;
  if (!user || auth?.currentUser !== user) return <SafeAreaView style={[styles.centered, { backgroundColor: theme.background }]}><Icon name="account-lock-outline" size={40} color={theme.text} /><Text style={[styles.text, styles.stateText, { color: theme.text }]}>Please sign in to view your finances.</Text></SafeAreaView>;
  return <Component key={user.uid} {...props} />;
}
export function Copy({ children, heading = false, muted = false, caption = false, style, ...props }) {
  const colors = useFinanceColors();
  return <Text accessibilityRole={heading ? 'header' : undefined} style={[styles.text, { color: muted ? colors.muted : colors.ink }, heading && styles.heading, caption && styles.caption, style]} {...props}>{children}</Text>;
}
export function Card({ children, style, contentStyle, padding = 20, ...props }) {
  const colors = useFinanceCardColors();
  return <GlassCard borderRadius={24} borderWidth={1} padding={0} style={[styles.card, style]} {...props}>
    <FinanceSurface.Provider value={colors}><View style={[styles.cardContent, { padding }, contentStyle]}>{children}</View></FinanceSurface.Provider>
  </GlassCard>;
}
export function Button({ title, icon, onPress, disabled = false, selected = false, label, showLabel = false, variant = 'secondary', style }) {
  const colors = useFinanceColors();
  const iconOnly = !!icon && !showLabel;
  const foreground = variant === 'danger' ? colors.expense : variant === 'primary' || selected ? '#182139' : colors.ink;
  const background = variant === 'primary' || selected ? '#FFFFFF' : variant === 'danger' ? 'rgba(239,68,68,0.09)' : colors.surface;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label || title} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    activeOpacity={0.8} style={[styles.button, iconOnly && styles.iconButton, { borderColor: colors.border, backgroundColor: background, opacity: disabled ? 0.55 : 1 }, style]}>
     {icon && (iconOnly ? <View style={styles.iconButtonContent}><Icon name={icon} size={24} color={foreground} style={styles.iconButtonGlyph} /></View> : <Icon name={icon} size={20} color={foreground} />)}{!iconOnly && <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>}
  </TouchableOpacity>;
}
export function Field({ label, value, onChangeText, icon, prefix, large = false, style, ...props }) {
  const colors = useFinanceColors();
  return <View style={styles.field}><Copy muted style={{ fontWeight: '600', fontSize: 14 }}>{label}</Copy>
    <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.input, opacity: props.editable === false ? 0.65 : 1 }]}>
      {icon && <Icon name={icon} size={22} color={colors.muted} style={{ marginLeft: 14 }} />}
      {prefix && <Text style={[styles.prefix, { color: colors.ink }]}>{prefix}</Text>}
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholderTextColor={colors.muted} selectionColor={colors.accent}
        style={[styles.input, { color: colors.ink }, large && styles.inputLarge, props.multiline && styles.inputMultiline, style]} {...props} />
    </View></View>;
}
export function Choices({ values, selected, onSelect, disabled = false, icons }) {
  const colors = useFinanceColors();
  return <View style={[styles.choices, { backgroundColor: colors.surface }]}>{values.map(option => {
    const value = typeof option === 'string' ? option : option.value;
    const label = typeof option === 'string' ? option.charAt(0).toUpperCase() + option.slice(1) : option.label;
    const active = selected === value;
    const tone = typeof option === 'string' ? null : option.tone;
    const background = active ? (colors[tone] || '#FFFFFF') : 'transparent';
    const color = active ? (colorBrightness(background) > 155 ? '#182139' : '#FFFFFF') : colors.ink;
    return <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active, disabled }} disabled={disabled}
      onPress={() => onSelect(value)} activeOpacity={0.8} style={[styles.choice, { backgroundColor: background, opacity: disabled ? 0.55 : 1 }]}>
      {icons?.[value] && <Icon name={icons[value]} size={18} color={!active && tone ? colors[tone] : color} />}<Text style={[styles.buttonText, { color }]}>{label}</Text>
    </TouchableOpacity>;
  })}</View>;
}
export function CategoryChoices({ values, selected, onSelect, disabled = false }) {
  const colors = useFinanceColors();
  return <View style={styles.categoryGrid}>{values.map(value => {
    const details = categoryDetails(value), active = selected === value;
    return <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={details.label} accessibilityState={{ selected: active, disabled }} disabled={disabled}
      onPress={() => onSelect(value)} activeOpacity={0.8} style={[styles.categoryChoice, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? (colors.light ? 'rgba(68,92,160,0.12)' : 'rgba(255,255,255,0.18)') : colors.surface, opacity: disabled ? 0.55 : 1 }]}>
      <View style={styles.categoryTop}><Icon name={details.icon} size={24} color={colors.light ? colors.accent : details.color} />{active && <Icon name="check-circle" size={18} color={colors.light ? colors.accent : colors.ink} />}</View>
      <Copy style={{ fontSize: 13, lineHeight: 19, fontWeight: active ? '700' : '500' }}>{details.label}</Copy>
    </TouchableOpacity>;
  })}</View>;
}
export function LoadState({ loading, error, onRetry, loadingLabel = 'Loading complete financial data' }) {
  if (error) return <Card><View style={styles.state}><StateIcon name="cloud-alert" /><Copy heading>Data unavailable</Copy><Copy accessibilityRole="alert" style={styles.stateText}>Unable to verify your financial data. {error}</Copy><Button title="Retry" icon="refresh" showLabel onPress={onRetry} /></View></Card>;
  if (loading) return <Card><View style={styles.state}><LoadingIndicator label={loadingLabel} /><Copy muted style={styles.stateText}>{loadingLabel}…</Copy></View></Card>;
  return null;
}
// Pull-to-refresh: the native spinner is hidden on both platforms and the Expenzo logo loader shows
// at the top of the list instead. iOS: transparent tint. Android always draws its white disc, so
// it is also parked far above the screen (the pull distance that triggers a refresh is unchanged).
export const HIDDEN_REFRESH_SPINNER = {
  tintColor: 'transparent', colors: ['transparent'], progressBackgroundColor: 'transparent',
  ...(Platform.OS === 'android' ? { progressViewOffset: -1000 } : null),
};
// Pull-to-refresh state that shows the logo from the moment you release until the refresh
// finishes, and for at least one pass of the animation even when local data returns instantly.
const MIN_REFRESH_MS = 1200;
export function usePullRefresh(onRefresh, externalRefreshing = false) {
  const [pulling, setPulling] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const start = useCallback(() => {
    if (!onRefresh) return;
    setPulling(true);
    const minimum = new Promise(resolve => setTimeout(resolve, MIN_REFRESH_MS));
    Promise.allSettled([Promise.resolve().then(onRefresh), minimum])
      .then(() => { if (mountedRef.current) setPulling(false); });
  }, [onRefresh]);
  return { refreshing: pulling || !!externalRefreshing, onRefresh: start };
}
export function RefreshLoader() {
  return <View style={styles.refreshLoader}><LogoLoader size={30} color="white" accessibilityLabel="Refreshing" /></View>;
}
function LoadingIndicator({ label }) {
  const colors = useFinanceColors();
  return <LogoLoader color={colors.ink} accessibilityLabel={label} />;
}
function StateIcon({ name }) {
  const colors = useFinanceColors();
  return <Icon name={name} size={36} color={colors.muted} />;
}
export function EmptyState({ title, description, icon = 'receipt-text-outline', children }) {
  return <View style={styles.state}><StateIcon name={icon} /><Copy heading style={styles.stateText}>{title}</Copy>{description && <Copy muted style={styles.stateText}>{description}</Copy>}{children}</View>;
}
export function Notice({ message }) {
  if (!message) return null;
  return <Card padding={16}><View style={[styles.row, { flexWrap: 'nowrap', alignItems: 'flex-start' }]}><StateIcon name="information-outline" /><Copy accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flex: 1 }}>{message}</Copy></View></Card>;
}
export function FinancePage({ title, subtitle, navigation, children, onRefresh, refreshing: dataRefreshing = false, actions, showBack = true, onBack, scrollRef }) {
  const { theme } = useTheme();
  const pull = usePullRefresh(onRefresh, dataRefreshing);
  const refreshing = pull.refreshing;
  const backgroundColors = theme.pageGradientColors || (theme.isDarkMode ? [theme.background, theme.background] : [theme.primary, theme.primaryLight]);
  const canGoBack = typeof navigation?.canGoBack === 'function' && navigation.canGoBack();
  const backAction = onBack || (() => navigation?.goBack?.());
  return <View style={[styles.page, { backgroundColor: backgroundColors[0] }]}>
    <StatusBar barStyle="light-content" backgroundColor={backgroundColors[0]} />
    <AppBackground colors={backgroundColors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
    <FinanceSurface.Provider value={whitePalette}><SafeAreaView edges={['top', 'left', 'right']} style={styles.page}>
      <View style={styles.header}>
        {showBack && (onBack || canGoBack) && <Button title="Back" icon="arrow-left" onPress={backAction} />}
        <View style={styles.headerText}><Text accessibilityRole="header" style={[styles.title, { color: whitePalette.ink }]}>{title}</Text>{subtitle && <Copy caption muted>{subtitle}</Copy>}</View>
        {actions || (onRefresh && <Button title="Refresh" icon="refresh" disabled={refreshing} onPress={pull.onRefresh} />)}
      </View>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={pull.onRefresh} {...HIDDEN_REFRESH_SPINNER} /> : undefined}>
          {refreshing && <RefreshLoader />}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView></FinanceSurface.Provider>
  </View>;
}
export function Metric({ label, value, icon, tone, style }) {
  const colors = useFinanceColors();
  const color = colors[tone] || colors.ink;
  return <View style={[styles.metric, style]}>{icon && <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}><Icon name={icon} size={23} color={color} /></View>}
    <Copy caption muted>{label}</Copy><Copy style={[styles.metricValue, { color }]}>{value}</Copy>
  </View>;
}
export function ProgressBar({ value, max, color, label = 'Budget used' }) {
  const colors = useFinanceColors();
  const percentage = Number.isFinite(value) && Number.isFinite(max) && max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={max > 0 ? { min: 0, max: 100, now: Math.round(percentage) } : { text: 'No budget limit set' }}
    style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: color || (value > max ? colors.expense : colors.accent) }]} /></View>;
}
export function ProgressRing({ value, max }) {
  const colors = useFinanceColors();
  const percentage = Number.isFinite(value) && Number.isFinite(max) && max > 0 ? value / max * 100 : null;
  const fill = percentage === null ? 0 : Math.min(100, Math.max(0, percentage));
  const color = percentage > 100 ? colors.expense : colors.accent;
  const circumference = 2 * Math.PI * 70;
  return <View style={styles.ring} accessibilityRole="image" accessibilityLabel={percentage === null ? 'No budget limit set' : `${percentage.toFixed(1)} percent of budget used`}>
    <Svg width={168} height={168} viewBox="0 0 168 168" style={StyleSheet.absoluteFill}>
      <Circle cx={84} cy={84} r={70} fill="none" stroke={colors.border} strokeWidth={12} />
      {fill > 0 && <Circle cx={84} cy={84} r={70} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - fill / 100)} transform="rotate(-90 84 84)" />}
    </Svg><View style={styles.ringText}><Copy style={[styles.amount, { fontSize: 26, color }]}>{percentage === null ? '—' : `${percentage.toFixed(1)}%`}</Copy><Copy caption muted style={styles.stateText}>{percentage === null ? 'No limit set' : 'of budget used'}</Copy></View>
  </View>;
}
export function LedgerOverview({ stats, title, company = false, detail, children }) {
  const colors = useFinanceColors();
  const rate = stats.totalIncome > 0 ? stats.netAmount / stats.totalIncome * 100 : null;
  return <View style={{ gap: 18 }}><View style={styles.rowBetween}><Copy heading>{title}</Copy><Icon name="wallet-outline" size={24} color={colors.muted} /></View>
    <View style={{ gap: 4 }}><Copy caption muted>{company ? 'Net cash flow' : 'Net balance'}</Copy><Copy style={styles.amount}>{formatMoney(stats.netAmount)}</Copy></View>
    <View style={styles.grid}><Metric label={company ? 'Revenue' : 'Income'} value={formatMoney(stats.totalIncome)} icon="arrow-down-circle" tone="income" /><Metric label="Expenses" value={formatMoney(stats.totalExpenses)} icon="arrow-up-circle" tone="expense" /></View>
    <View style={[styles.divider, { borderTopColor: colors.border }]}><View style={styles.rowBetween}><Copy caption muted>{detail || `${stats.count} entries · complete ledger`}</Copy>
      {rate !== null && <View style={[styles.badge, { backgroundColor: colors.surface }]}><Copy caption style={{ color: stats.netAmount < 0 ? colors.expense : colors.income }}>{rate.toFixed(1)}% {company ? 'net margin' : 'savings rate'}</Copy></View>}
    </View>{children}</View>
  </View>;
}
export function BudgetProgress({ budget }) {
  const colors = useFinanceColors();
  const details = categoryDetails(budget.category);
  const percentage = budget.amount > 0 ? budget.spent / budget.amount * 100 : null;
  const color = budget.spent > budget.amount ? colors.expense : colors.accent;
  return <View style={{ gap: 8 }}><View style={styles.rowBetween}><View style={[styles.row, { flex: 1, minWidth: 120 }]}><Icon name={details.icon} size={20} color={color} /><Copy style={{ flexShrink: 1, fontWeight: '600' }}>{details.label}</Copy></View>
    <Copy caption style={{ color }}>{percentage === null ? 'No limit' : `${percentage.toFixed(1)}%`}</Copy></View>
    <ProgressBar value={budget.spent} max={budget.amount} color={color} label={`${details.label} budget used`} />
    <Copy caption muted>{formatMoney(budget.spent)} spent of {formatMoney(budget.amount)}{budget.spent > budget.amount ? ' · Exceeded' : budget.spent === budget.amount && budget.amount > 0 ? ' · Fully used' : ''}</Copy>
  </View>;
}
export function TransactionRow({ transaction, onDelete, disabled = false }) {
  const colors = useFinanceColors();
  const details = categoryDetails(transaction.category);
  const color = transaction.type === 'income' ? colors.income : colors.expense;
  return <View style={{ gap: 8 }}><View style={styles.transactionRow}>
    <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}><Icon name={details.icon} size={22} color={color} /></View>
    <View style={styles.transactionDetails}><Copy style={{ fontWeight: '600' }}>{transaction.description}</Copy><Copy caption muted>{details.label}{transaction.department ? ` · ${transaction.department}` : ''}</Copy></View>
    <Copy style={[styles.transactionAmount, { color }]}>{transaction.type === 'income' ? '+' : '−'}{formatMoney(transaction.amount)}</Copy>
  </View><View style={styles.transactionBottom}><View style={{ flex: 1, gap: 2 }}><Copy caption muted>{ledgerDate(transaction.date || transaction.createdAt)}</Copy>{transaction.autoGenerated && <Copy caption muted>Salary expense record</Copy>}</View>
    {onDelete && <Button title="Delete" label={`Delete ${transaction.description}`} icon="trash-can-outline" variant="danger" disabled={disabled} onPress={onDelete} />}
  </View></View>;
}
export function useFocusRefresh(navigation, refresh) {
  useEffect(() => navigation?.addListener('focus', refresh), [navigation, refresh]);
}
// Synchronous ref locking prevents two presses before React renders disabled.
export function useFinanceAction() {
  const lock = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = useCallback(async task => {
    if (lock.current || !mounted.current) return;
    const session = auth?.currentUser;
    if (!session) return;
    const active = () => mounted.current && auth?.currentUser === session;
    lock.current = true;
    setBusy(true); setMessage('');
    try { return await task(value => { if (active()) setMessage(value); }); }
    catch (error) { if (active()) setMessage(error.message || 'Unable to save. Please retry.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }, []);
  return { busy, message, run };
}
