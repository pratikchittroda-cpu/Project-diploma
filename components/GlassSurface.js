import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

// Turn a theme colour into a translucent tint so the background effects show through the card.
export function withAlpha(color, alpha) {
  if (typeof color !== 'string') return color;
  const value = color.trim();
  const hex = value.match(/^#([\da-f]{3,8})$/i)?.[1];
  if (hex && [3, 6, 8].includes(hex.length)) {
    const full = hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
    const own = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
    return `rgba(${r}, ${g}, ${b}, ${+(own * alpha).toFixed(3)})`;
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/i)?.[1].split(',').map(part => part.trim());
  if (rgb && rgb.length >= 3) {
    const own = rgb.length > 3 ? Number(rgb[3]) : 1;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${+((Number.isFinite(own) ? own : 1) * alpha).toFixed(3)})`;
  }
  return value;
}

// The light rim and top sheen that make a pane read as glass on any backdrop, even a dark one.
export const glassEdge = dark => (dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)');
const SHEEN = { dark: ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0)'], light: ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)'] };

/**
 * Glass backdrop for a card: fills its parent (which should clip with overflow: 'hidden').
 * iOS with Liquid Glass gets Expo's native GlassView tinted with the card colour; older iOS
 * gets a blur under a translucent tint; Android a slightly more opaque tint (no live blur).
 * Every path adds the same soft top sheen.
 */
export default function GlassSurface({ color, dark, borderRadius, intensity, interactive = false }) {
  const shape = [StyleSheet.absoluteFill, borderRadius != null && { borderRadius }];
  const sheen = <LinearGradient pointerEvents="none" colors={SHEEN[dark ? 'dark' : 'light']}
    start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.55 }} style={shape} />;
  if (isLiquidGlassAvailable()) {
    // Liquid glass adapts to whatever moves behind it, and on some screens (e.g. lazily mounted
    // tabs) its own tint is not applied. A plain card-colour layer behind the glass gives every card
    // the same frosted base, and keeps its text readable, whatever is underneath.
    return <>
      <View pointerEvents="none" style={[shape, { backgroundColor: withAlpha(color, dark ? 0.34 : 0.56) }]} />
      <GlassView pointerEvents="none" glassEffectStyle="regular" isInteractive={interactive}
        colorScheme={dark ? 'dark' : 'light'} tintColor={withAlpha(color, dark ? 0.2 : 0.3)} style={shape} />
      {sheen}
    </>;
  }
  const blur = Platform.OS === 'ios';
  return <>
    {blur && <BlurView pointerEvents="none" intensity={intensity ?? (dark ? 40 : 60)} tint={dark ? 'dark' : 'light'} style={shape} />}
    <View pointerEvents="none" style={[shape, { backgroundColor: withAlpha(color, blur ? 0.62 : 0.86) }]} />
    {sheen}
  </>;
}
