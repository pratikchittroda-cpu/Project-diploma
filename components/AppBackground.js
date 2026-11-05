import React, { useContext, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, AccessibilityInfo, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { NavigationContext } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { withAlpha } from './GlassSurface';

// The splash's slant (the logo's own angle) reused for the background bars.
const SKEW = '-33.69deg';
const BRAND_BLUE = '#3157FF';
const CYCLE_MS = 8000;

// Relative luminance of a #rrggbb colour (0 = black, 1 = white); unknown formats count as dark.
export function luminance(color) {
  const hex = String(color || '').match(/^#([\da-f]{6})$/i)?.[1];
  if (!hex) return 0;
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

function mixWithWhite(color, amount) {
  const hex = color.slice(1);
  const mixed = [0, 2, 4].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount) + 255 * amount));
  return `#${mixed.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

// The theme colour the dark-mode effects use: the brighter of the theme's two colours, lifted
// toward white until it clearly shows on a black page (so dim themes like Executive still glow).
export function visibleAccent(theme) {
  const candidates = [theme?.primary, theme?.primaryLight].filter(color => /^#[\da-f]{6}$/i.test(color || ''));
  let accent = candidates.sort((a, b) => luminance(b) - luminance(a))[0] || BRAND_BLUE;
  for (let step = 0; step < 8 && luminance(accent) < 0.22; step++) accent = mixWithWhite(accent, 0.18);
  return accent;
}

// Colours and strengths for the decorative layers, per mode. Light pages are the theme's own
// (darkened) gradient, so white effects show on every theme; dark pages are black, so the
// effects take the theme accent.
export function backgroundPalette(theme) {
  if (!theme?.isDarkMode) {
    return { glow: '#FFFFFF', glowStrength: [0.34, 0.24], bar: 'rgba(255,255,255,0.28)', barSoft: 'rgba(255,255,255,0.17)' };
  }
  const accent = visibleAccent(theme);
  return { glow: accent, glowStrength: [0.5, 0.36], bar: withAlpha(accent, 0.32), barSoft: withAlpha(accent, 0.19) };
}

function Glow({ id, size, color, opacity, style }) {
  // Cached as a texture so moving/scaling it doesn't redraw the large gradient every frame.
  return <Animated.View pointerEvents="none" renderToHardwareTextureAndroid shouldRasterizeIOS
    style={[styles.glow, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }, style]}>
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.4" stopColor={color} stopOpacity={opacity * 0.4} />
          <Stop offset="0.7" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  </Animated.View>;
}

/**
 * Page background shared by every screen: the page gradient plus the splash's soft brand glows
 * and slanted streaks, coloured from the active theme and gently moving (glows drift and breathe,
 * streaks glide and pulse). Purely decorative and never intercepts touches.
 */
export default function AppBackground({ colors, start = { x: 0, y: 0 }, end = { x: 1, y: 1 } }) {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const palette = backgroundPalette(theme);
  const float = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  // Each screen has its own background; only the focused one animates, so hidden tabs and
  // screens under the stack don't keep the UI thread busy.
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused?.() ?? true);

  useEffect(() => {
    if (!navigation?.addListener) return undefined;
    setFocused(navigation.isFocused?.() ?? true);
    const onFocus = navigation.addListener('focus', () => setFocused(true));
    const onBlur = navigation.addListener('blur', () => setFocused(false));
    return () => { onFocus?.(); onBlur?.(); };
  }, [navigation]);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then(enabled => { if (active) setReduceMotion(!!enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion) { float.setValue(0.5); return undefined; }
    if (!focused) return undefined;
    const step = toValue => Animated.timing(float, { toValue, duration: CYCLE_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false });
    const loop = Animated.loop(Animated.sequence([step(1), step(0)]));
    loop.start();
    return () => loop.stop();
  }, [float, reduceMotion, focused]);

  const move = (from, to) => float.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const glowMotion = (dx, dy) => ({ opacity: move(0.7, 1), transform: [{ translateX: move(-dx, dx) }, { translateY: move(-dy, dy) }, { scale: move(0.9, 1.1) }] });
  // Each streak fades out toward the middle of the screen, glides along its slant and pulses.
  const streak = ({ width: barWidth, color, distance, fromRight, style }) => (
    <Animated.View style={[styles.bar, { width: barWidth, opacity: move(0.55, 1), transform: [{ skewX: SKEW }, { translateX: move(0, distance) }] }, style]}>
      <LinearGradient colors={fromRight ? ['rgba(0,0,0,0)', color] : [color, 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>);
  const fill = colors?.length ? colors : [theme?.background || '#0A0C17', theme?.background || '#0A0C17'];
  const glowSize = Math.max(width, 380);

  return <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="app-background">
    <LinearGradient colors={fill} start={start} end={end} style={StyleSheet.absoluteFill} />
    {/* Glows sit behind where content cards land, giving the glass light to bend. */}
    <Glow id="appGlowUpper" size={glowSize * 1.2} color={palette.glow} opacity={palette.glowStrength[0]}
      style={[{ left: width * 0.12, top: height * 0.32 }, glowMotion(28, 18)]} />
    <Glow id="appGlowLower" size={glowSize * 1.1} color={palette.glow} opacity={palette.glowStrength[1]}
      style={[{ left: width * 0.92, top: height * 0.7 }, glowMotion(-24, -20)]} />
    <View style={[styles.barsRight, { top: height * 0.34 }]}>
      {streak({ fromRight: true, width: 260, color: palette.bar, distance: -60 })}
      {streak({ fromRight: true, width: 190, color: palette.barSoft, distance: -40, style: { marginRight: 40 } })}
    </View>
    <View style={[styles.barsLeft, { top: height * 0.72 }]}>
      {streak({ width: 220, color: palette.barSoft, distance: 50 })}
      {streak({ width: 160, color: palette.bar, distance: 34, style: { marginLeft: 30 } })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
  bar: { height: 44, overflow: 'hidden' },
  barsRight: { position: 'absolute', right: -110, alignItems: 'flex-end', gap: 18 },
  barsLeft: { position: 'absolute', left: -110, gap: 18 },
});
