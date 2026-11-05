import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, AccessibilityInfo } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { withAlpha } from './GlassSurface';

// The Expenzo mark (48×48 viewBox): three slanted bars and the small "ink" block.
const BARS = ['M17 5h30l-6 9H11l6-9Z', 'M10 20h27l-6 9H4l6-9Z', 'M6 35h28l-6 9H0l6-9Z'];
const INK = 'M40 35h8l-6 9h-8l6-9Z';
export const BRAND_BLUE = '#3157FF';
const BRAND_INK = '#10121D';
const CYCLE_MS = 1700;
const SIZES = { small: 22, large: 40 };

// Keyframes on one 0→1 cycle: each bar slides in at the logo's slant, the ink block drops last,
// everything holds, then fades together before the loop restarts.
const barIn = i => [0.06 + i * 0.09, 0.3 + i * 0.09];
const FADE = [0.82, 0.96];

/**
 * Loading indicator built from the Expenzo "E": a looping version of the splash intro.
 * Drop-in for ActivityIndicator: accepts size ('small' | 'large' | number), color and a11y props.
 * With no color it uses the brand blue + dark ink; with a color (e.g. white on a gradient
 * button) the bars use it and the ink block a translucent version, so it shows on any surface.
 */
export default function LogoLoader({ size = 'small', color, accessibilityLabel = 'Loading', style, testID }) {
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.small;
  const unit = px / 48;
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const bar = color || BRAND_BLUE;
  const ink = color ? withAlpha(color, 0.55) : BRAND_INK;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then(enabled => { if (active) setReduceMotion(!!enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion) { progress.setValue(0.6); return undefined; }
    const loop = Animated.loop(Animated.timing(progress, {
      toValue: 1, duration: CYCLE_MS, easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    }), { resetBeforeIteration: true });
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  const fadeOut = (input, output) => progress.interpolate({ inputRange: [...input, ...FADE], outputRange: [...output, output[output.length - 1], 0], extrapolate: 'clamp' });
  const piece = (d, fill, [start, end], from) => <Animated.View key={d} style={[StyleSheet.absoluteFill, {
    opacity: fadeOut([start, end], [0, 1]),
    transform: [
      { translateX: progress.interpolate({ inputRange: [start, end], outputRange: [from.x * unit, 0], extrapolate: 'clamp' }) },
      { translateY: progress.interpolate({ inputRange: [start, end], outputRange: [from.y * unit, 0], extrapolate: 'clamp' }) },
    ],
  }]}>
    <Svg width={px} height={px} viewBox="0 0 48 48"><Path d={d} fill={fill} /></Svg>
  </Animated.View>;

  return <View accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} testID={testID}
    style={[{ width: px, height: px }, style]}>
    {BARS.map((d, i) => piece(d, bar, barIn(i), { x: -14, y: 0 }))}
    {piece(INK, ink, [0.42, 0.62], { x: 5, y: -12 })}
  </View>;
}
