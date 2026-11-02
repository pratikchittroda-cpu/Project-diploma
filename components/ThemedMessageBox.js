import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { accountGradientColors } from './account/AccountPrimitives';

export default function ThemedMessageBox({ visible, title, message, type = 'info', buttons = [], onDismiss,
  autoHide = false, autoHideDelay = 3000, showInput = false, initialValue = '', placeholder,
  secureTextEntry = false, keyboardType = 'default', showIcon = true, customIcon, animationType = 'fade' }) {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [input, setInput] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const pressed = useRef(false);
  const entrance = useRef(new Animated.Value(0)).current;
  const isDialog = type === 'confirm' || showInput || buttons.length > 0;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!visible) return;
    entrance.setValue(0);
    const animation = Animated.timing(entrance, { toValue: 1, duration: 220, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [entrance, visible]);
  useEffect(() => {
    if (!visible || !autoHide || type === 'confirm') return;
    const timer = setTimeout(() => onDismiss?.(), autoHideDelay);
    return () => clearTimeout(timer);
  }, [visible, autoHide, autoHideDelay, type, onDismiss]);
  useEffect(() => {
    if (!visible || isDialog) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!pressed.current) onDismiss?.();
      return true;
    });
    return () => subscription.remove();
  }, [visible, isDialog, onDismiss]);

  const press = async (button) => {
    if (pressed.current) return;
    pressed.current = true;
    setBusy(true);
    try { await button.onPress?.(showInput ? input : undefined); }
    finally {
      if (mounted.current) { pressed.current = false; setBusy(false); }
    }
  };
  const dismiss = () => { if (!pressed.current) onDismiss?.(); };
  const typeConfig = {
    success: { icon: 'check-circle', color: theme.success || '#10B981', background: theme.successLight || '#D1FAE5' },
    error: { icon: 'alert-circle', color: theme.error || '#EF4444', background: theme.errorLight || '#FEE2E2' },
    warning: { icon: 'alert', color: theme.warning || '#F59E0B', background: theme.warningLight || '#FEF3C7' },
    info: { icon: 'information', color: theme.info || '#3B82F6', background: theme.infoLight || '#DBEAFE' },
    confirm: { icon: 'help-circle-outline', color: theme.primary, background: theme.primaryContainer },
  };
  const appearance = typeConfig[type] || typeConfig.info;
  const gradient = accountGradientColors(theme);
  const animationStyle = { opacity: entrance,
    transform: animationType === 'scale'
      ? [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }]
      : [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [animationType === 'slide' ? -24 : -8, 0] }) }],
  };
  if (!visible) return null;

  const icon = showIcon && <View style={[styles.icon, isDialog && styles.dialogIcon,
    { backgroundColor: isDarkMode ? theme.surfaceVariant : appearance.background }]}>
    <MaterialCommunityIcons name={customIcon || appearance.icon} size={isDialog ? 32 : 24} color={appearance.color} />
  </View>;

  if (!isDialog) return <View pointerEvents="box-none" style={[styles.toastOverlay,
    { paddingTop: Math.max(insets.top, 12) + 8, paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16) }]}>
    <Animated.View accessibilityLiveRegion="polite" style={[styles.toast, animationStyle,
      { backgroundColor: theme.surface || theme.background, borderColor: theme.border, maxHeight: height - insets.top - insets.bottom - 40 }]}>
      {icon}
      <ScrollView style={styles.toastText} showsVerticalScrollIndicator={false}>
        {!!title && <Text accessibilityRole="header" style={[styles.toastTitle, { color: theme.text }]}>{title}</Text>}
        {!!message && <Text style={[styles.toastMessage, { color: theme.textSecondary }]}>{message}</Text>}
      </ScrollView>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={dismiss} style={styles.close}>
        <MaterialCommunityIcons name="close" size={21} color={theme.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  </View>;

  return <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.overlay,
      { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24),
        paddingLeft: Math.max(insets.left, 24), paddingRight: Math.max(insets.right, 24) }]}>
      <Animated.View accessibilityViewIsModal style={[styles.card, animationStyle,
        { backgroundColor: theme.surface || theme.background, borderColor: theme.border }]}>
        <ScrollView style={styles.dialogScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.dialogContent}>
          {icon}
          {!!title && <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>}
          {!!message && <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>}
          {showInput && <TextInput accessibilityLabel={placeholder || title}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBackground }]}
            value={input} onChangeText={setInput} placeholder={placeholder} placeholderTextColor={theme.textSecondary}
            secureTextEntry={secureTextEntry} autoCapitalize="none" autoCorrect={false} autoFocus keyboardType={keyboardType} editable={!busy} />}
          {busy && <ActivityIndicator accessibilityLabel="Processing action" color={theme.primary} style={styles.spinner} />}
          <View style={styles.buttons}>
            {buttons.length ? buttons.map((button, index) => {
              const cancel = button.style === 'cancel';
              const color = button.color || (button.style === 'destructive' ? '#B42318' : gradient[0]);
              return <TouchableOpacity key={index} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy}
                onPress={() => press(button)} activeOpacity={0.8}
                style={[styles.button, { backgroundColor: cancel ? theme.surfaceVariant : color }]}>
                {!cancel && <LinearGradient colors={[color, button.color || (button.style === 'destructive' ? '#88170F' : gradient[1])]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
                <Text style={[styles.buttonText, { color: cancel ? theme.text : '#fff' }]}>{button.text}</Text>
              </TouchableOpacity>;
            }) : <TouchableOpacity accessibilityRole="button" onPress={dismiss} activeOpacity={0.8} style={[styles.button, { backgroundColor: theme.primary }]}>
              <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
              <Text style={[styles.buttonText, { color: '#fff' }]}>OK</Text>
            </TouchableOpacity>}
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  card: { borderRadius: 32, borderWidth: 1, width: '100%', maxWidth: 440, maxHeight: '100%',
    elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20 },
  dialogContent: { padding: 24, alignItems: 'center' },
  dialogScroll: { flexGrow: 0, flexShrink: 1 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 17, lineHeight: 25, marginBottom: 18, textAlign: 'center' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  dialogIcon: { width: 64, height: 64, borderRadius: 32, marginRight: 0, marginBottom: 16 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 52, marginBottom: 16, fontSize: 16 },
  spinner: { marginBottom: 12 },
  buttons: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 6 },
  button: { flexGrow: 1, flexBasis: 120, padding: 14, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buttonText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  toastOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', zIndex: 999, elevation: 40 },
  toast: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 600, borderRadius: 36,
    borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, elevation: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 14 },
  toastText: { flex: 1 },
  toastTitle: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  toastMessage: { fontSize: 14, lineHeight: 20 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
});
