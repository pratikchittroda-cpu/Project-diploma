import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Animated, Easing, StatusBar, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import BrandLogo from '../../components/BrandLogo';
import { accountGradientColors } from '../../components/account/AccountPrimitives';
import * as NativeSplashScreen from 'expo-splash-screen';

export default function SplashScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const entrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const didHideNativeSplash = useRef(false);
  const gradient = accountGradientColors(theme || { primary: '#667eea', primaryLight: '#764ba2' });
  useEffect(() => {
    const appear = Animated.spring(entrance, { toValue: 1, tension: 65, friction: 9, useNativeDriver: true });
    const ring = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true, isInteraction: false }),
    ]));
    const orbs = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(drift, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    appear.start(); ring.start(); orbs.start();
    return () => { appear.stop(); ring.stop(); orbs.stop(); };
  }, [entrance, pulse, drift]);

  // The auth-driven navigator owns readiness; loading artwork never redirects a session.
  return <View onLayout={() => {
    if (didHideNativeSplash.current) return;
    didHideNativeSplash.current = true;
    NativeSplashScreen.hideAsync().catch(() => {});
  }} style={styles.page}>
    <StatusBar barStyle="light-content" />
    <LinearGradient colors={[gradient[1], gradient[0], '#1f2937']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Animated.View pointerEvents="none" style={[styles.orbTop, { transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) }] }]} />
    <Animated.View pointerEvents="none" style={[styles.orbBottom, { transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) }] }]} />
    <View style={styles.center}>
      <View style={styles.logoWrap}>
        <Animated.View style={[styles.ring, {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.05] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.2] }) }],
        }]} />
        <Animated.View style={[styles.logoBadge, { opacity: entrance,
          transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        }]}>
          <BrandLogo size={74} />
        </Animated.View>
      </View>
      <Animated.View style={{ alignItems: 'center', opacity: entrance }}>
        <Text style={styles.title}>Expenzo</Text>
        <Text style={styles.subtitle}>Smart Finance Management</Text>
      </Animated.View>
    </View>
    <View style={[styles.footer, { bottom: Math.max(insets.bottom, 20) + 30 }]}>
      <ActivityIndicator accessibilityLabel="Loading your account" color="rgba(255,255,255,0.95)" />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#667eea' },
  orbTop: { position: 'absolute', top: -90, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.14)' },
  orbBottom: { position: 'absolute', bottom: -120, left: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.1)' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoWrap: { width: 170, height: 170, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  ring: { position: 'absolute', width: 168, height: 168, borderRadius: 84, borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)' },
  logoBadge: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f5ff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  title: { color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: 1.2 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500', letterSpacing: 1.1, marginTop: 8, textAlign: 'center' },
  footer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
