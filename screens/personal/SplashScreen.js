import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StatusBar, StyleSheet, AccessibilityInfo, Platform } from 'react-native';
import Svg, { Path, Defs, ClipPath, G, RadialGradient, Stop, Circle } from 'react-native-svg';
import * as NativeSplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Syne_800ExtraBold } from '@expo-google-fonts/syne/800ExtraBold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { useTheme } from '../../contexts/ThemeContext';

// Built from the "Expenzo Splash Screen" design artifact (light, dark and motion storyboard).
const SKEW = '-33.69deg';
const MARK = 156;
const UNIT = MARK / 48; // logo viewBox is 48x48
const BARS = ['M17 5h30l-6 9H11l6-9Z', 'M10 20h27l-6 9H4l6-9Z', 'M6 35h28l-6 9H0l6-9Z'];
const INK = 'M40 35h8l-6 9h-8l6-9Z';
const LETTERS = 'EXPENZO'.split('');
const BRAND = '#3157FF';
const AnimatedG = Animated.createAnimatedComponent(G);
// The design's typefaces: Syne for the wordmark, Manrope for the tagline (both ExtraBold).
const BRAND_FONTS = { Syne_800ExtraBold, Manrope_800ExtraBold };
const FONT_WAIT_MS = 2000;
const FONTS = {
  brand: { title: { fontFamily: 'Syne_800ExtraBold' }, tagline: { fontFamily: 'Manrope_800ExtraBold' } },
  system: {
    title: Platform.OS === 'ios' ? { fontFamily: 'AvenirNext-Heavy' } : { fontWeight: '800' },
    tagline: { fontWeight: '800' },
  },
};

const PALETTES = {
  light: {
    background: '#F3F5FF', title: '#10121D', tagline: '#535B7C', ink: '#10121D', ripple: BRAND, track: '#DCE2FF',
    bloom: { size: 460, stops: [0.18, 0.06] }, ring: { width: 150, height: 100, peak: 0.5, from: 0.72, to: 2.7 },
    decoTop: ['rgba(49,87,255,0.07)', 'rgba(49,87,255,0.05)', 'rgba(49,87,255,0.035)'],
    decoBottom: ['rgba(49,87,255,0.05)', 'rgba(16,18,29,0.04)'], statusBar: 'dark-content',
    // seconds: bloom, bars, ink, glint, ripples, letters, tagline, loader, loader fill
    at: { tile: 0, bars: 0.25, ink: 0.85, glint: 1.3, ripples: 1.05, letters: 1.2, tag: 1.8, load: 2.05, fill: 2.2 },
  },
  dark: {
    background: '#0A0C17', title: '#FFFFFF', tagline: '#A9B3DA', ink: '#10121D', ripple: '#6F8BFF', track: 'rgba(243,245,255,0.12)',
    bloom: { size: 520, stops: [0.42, 0.14] }, ring: { width: 170, height: 112, peak: 0.6, from: 0.8, to: 2.5 },
    decoTop: ['rgba(49,87,255,0.13)', 'rgba(49,87,255,0.08)', 'rgba(49,87,255,0.05)'],
    decoBottom: ['rgba(49,87,255,0.08)', 'rgba(243,245,255,0.04)'], statusBar: 'light-content',
    at: { tile: 0.1, bars: 0.45, ink: 1.05, glint: 1.45, ripples: 1.2, letters: 1.35, tag: 1.95, load: 2.2, fill: 2.35 },
  },
};

const curve = (x1, y1, x2, y2) => Easing.bezier(x1, y1, x2, y2);
const EASE = {
  bloom: curve(0.2, 0.8, 0.2, 1), bar: curve(0.18, 1.35, 0.4, 1), ink: curve(0.3, 0.9, 0.3, 1),
  glint: curve(0.45, 0, 0.2, 1), ripple: curve(0.2, 0.6, 0.3, 1), rise: curve(0.2, 1, 0.3, 1),
  slide: curve(0.6, 0, 0.3, 1), tile: curve(0.2, 0.9, 0.25, 1),
};
const run = (value, delay, duration, easing, useNativeDriver = true) =>
  Animated.timing(value, { toValue: 1, delay: delay * 1000, duration, easing, useNativeDriver, isInteraction: false });
const repeat = (value, delay, duration, easing, useNativeDriver = true) => Animated.sequence([
  Animated.delay(delay * 1000),
  Animated.loop(Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver, isInteraction: false })),
]);
const between = (value, from, to) => value.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

function useValues() {
  const ref = useRef(null);
  if (!ref.current) {
    const make = () => new Animated.Value(0);
    ref.current = {
      bloom: make(), deco: make(), drift: make(), tile: make(), bars: BARS.map(make), ink: make(), glint: make(),
      ripples: [make(), make(), make()], letters: LETTERS.map(make), tag: make(), load: make(), fill: make(),
    };
  }
  return ref.current;
}

export default function SplashScreen({ onFinish } = {}) {
  const { theme } = useTheme() || {};
  const palette = theme?.isDarkMode ? PALETTES.dark : PALETTES.light;
  const values = useValues();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fontsLoaded, fontError] = useFonts(BRAND_FONTS);
  const [fontWaitOver, setFontWaitOver] = useState(false);
  // Hold the intro (and the native launch screen) until the fonts are in, but never for long.
  const fontsReady = fontsLoaded || !!fontError || fontWaitOver;
  const fonts = fontsLoaded ? FONTS.brand : FONTS.system;
  const didHideNativeSplash = useRef(false);
  // Report once when the intro has played through, so the launch overlay can wait for it.
  const finishRef = useRef(null);
  finishRef.current = onFinish;
  const didFinish = useRef(false);
  const finish = () => {
    if (didFinish.current) return;
    didFinish.current = true;
    finishRef.current?.();
  };

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then(enabled => { if (active) setReduceMotion(!!enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) return undefined;
    const wait = setTimeout(() => setFontWaitOver(true), FONT_WAIT_MS);
    return () => clearTimeout(wait);
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (!fontsReady) return undefined;
    const { at } = palette;
    const settled = [values.bloom, values.deco, values.tile, ...values.bars, values.ink, ...values.letters, values.tag, values.load];
    if (reduceMotion) {
      settled.forEach(value => value.setValue(1));
      const hold = setTimeout(finish, 800);
      return () => clearTimeout(hold);
    }
    const intro = Animated.parallel([
      run(values.bloom, 0, 1300, EASE.bloom),
      run(values.deco, 0, 1400, Easing.out(Easing.quad)),
      run(values.tile, at.tile, 900, EASE.tile),
      ...values.bars.map((value, i) => run(value, at.bars + i * 0.12, 800, EASE.bar)),
      run(values.ink, at.ink, 750, EASE.ink),
      run(values.glint, at.glint, 950, EASE.glint, false),
      ...values.letters.map((value, i) => run(value, at.letters + i * 0.05, 750, EASE.rise)),
      run(values.tag, at.tag, 1000, EASE.bloom, false),
      run(values.load, at.load, 600, Easing.out(Easing.quad)),
    ]);
    const drift = Animated.sequence([Animated.delay(1400), Animated.loop(Animated.sequence([
      Animated.timing(values.drift, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true, isInteraction: false }),
      Animated.timing(values.drift, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true, isInteraction: false }),
    ]))]);
    const loops = [
      drift,
      ...values.ripples.map((value, i) => repeat(value, at.ripples + i * 0.85, 2600, EASE.ripple)),
      repeat(values.fill, at.fill, 1500, EASE.slide),
    ];
    intro.start(({ finished } = {}) => { if (finished) finish(); });
    loops.forEach(loop => loop.start());
    // Never hold the app hostage if an animation callback is dropped.
    const fallback = setTimeout(finish, 4500);
    return () => { clearTimeout(fallback); intro.stop(); loops.forEach(loop => loop.stop()); };
  }, [fontsReady, palette, reduceMotion, values]);

  const { bloom, ring } = palette;
  const inkWidth = 14 * UNIT;
  const inkHeight = 9 * UNIT;
  const decoStyle = (color, width, offset) => [styles.deco, { width, backgroundColor: color, ...offset, opacity: values.deco,
    transform: [{ skewX: SKEW }, { translateX: between(values.drift, 0, -22) }] }];

  // Same colour as the native launch screen, which stays up until the fonts are ready.
  if (!fontsReady) return <View style={[styles.page, { backgroundColor: palette.background }]} />;

  // The auth-driven navigator owns readiness; this artwork never redirects a session.
  return <View onLayout={() => {
    if (didHideNativeSplash.current) return;
    didHideNativeSplash.current = true;
    NativeSplashScreen.hideAsync().catch(() => {});
  }} style={[styles.page, { backgroundColor: palette.background }]}>
    <StatusBar barStyle={palette.statusBar} />

    <View pointerEvents="none" style={styles.decoTop}>
      <Animated.View style={decoStyle(palette.decoTop[0], 230)} />
      <Animated.View style={decoStyle(palette.decoTop[1], 180, { marginRight: 40 })} />
      <Animated.View style={decoStyle(palette.decoTop[2], 120, { marginRight: 10 })} />
    </View>
    <View pointerEvents="none" style={styles.decoBottom}>
      <Animated.View style={decoStyle(palette.decoBottom[0], 200)} />
      <Animated.View style={decoStyle(palette.decoBottom[1], 150, { marginLeft: 30 })} />
    </View>

    <View style={styles.content}>
      <View style={styles.markArea}>
        <Animated.View pointerEvents="none" style={[styles.bloom, {
          width: bloom.size, height: bloom.size, marginLeft: -bloom.size / 2, marginTop: -bloom.size / 2,
          opacity: values.bloom, transform: [{ scale: between(values.bloom, 0.35, 1) }],
        }]}>
          <Svg width={bloom.size} height={bloom.size}>
            <Defs>
              <RadialGradient id="ezBloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={BRAND} stopOpacity={bloom.stops[0]} />
                <Stop offset="0.36" stopColor={BRAND} stopOpacity={bloom.stops[1]} />
                <Stop offset="0.67" stopColor={BRAND} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={bloom.size / 2} cy={bloom.size / 2} r={bloom.size / 2} fill="url(#ezBloom)" />
          </Svg>
        </Animated.View>

        {!reduceMotion && values.ripples.map((value, i) => <Animated.View key={i} pointerEvents="none" style={[styles.ripple, {
          width: ring.width, height: ring.height, marginLeft: -ring.width / 2, marginTop: -ring.height / 2, borderColor: palette.ripple,
          opacity: value.interpolate({ inputRange: [0, 0.14, 1], outputRange: [0, ring.peak, 0] }),
          transform: [{ skewX: SKEW }, { scale: between(value, ring.from, ring.to) }],
        }]} />)}

        <Animated.View accessible accessibilityRole="image" accessibilityLabel="Expenzo logo" style={[styles.mark, {
          opacity: values.tile, transform: [{ scale: between(values.tile, 0.8, 1) }],
        }]}>
          {BARS.map((d, i) => <Animated.View key={d} style={[StyleSheet.absoluteFill, {
            opacity: values.bars[i], transform: [{ translateX: between(values.bars[i], -26 * UNIT, 0) }],
          }]}>
            <Svg width={MARK} height={MARK} viewBox="0 0 48 48"><Path d={d} fill={BRAND} /></Svg>
          </Animated.View>)}
          <Animated.View style={[styles.ink, {
            left: 34 * UNIT, top: 35 * UNIT, width: inkWidth, height: inkHeight,
            opacity: values.ink.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] }),
            transform: [
              { translateX: values.ink.interpolate({ inputRange: [0, 0.55, 1], outputRange: [9 * UNIT, 0, 0] }) },
              { translateY: values.ink.interpolate({ inputRange: [0, 0.55, 0.78, 1], outputRange: [-20 * UNIT, 1.4 * UNIT, -0.7 * UNIT, 0] }) },
              // rotate about the block's bottom-centre, like the design's transform-origin
              { translateY: inkHeight / 2 },
              { rotate: values.ink.interpolate({ inputRange: [0, 0.55, 1], outputRange: ['-28deg', '0deg', '0deg'] }) },
              { translateY: -inkHeight / 2 },
            ],
          }]}>
            <Svg width={inkWidth} height={inkHeight} viewBox="34 35 14 9"><Path d={INK} fill={palette.ink} /></Svg>
          </Animated.View>
          {!reduceMotion && <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={MARK} height={MARK} viewBox="0 0 48 48">
            <Defs>
              <ClipPath id="ezMarkClip"><Path d={`${BARS.join('')}${INK}`} /></ClipPath>
            </Defs>
            <G clipPath="url(#ezMarkClip)">
              <AnimatedG x={between(values.glint, 0, 78)}
                opacity={values.glint.interpolate({ inputRange: [0, 0.18, 0.8, 1], outputRange: [0, 0.8, 0.8, 0] })}>
                <Path d="M8 -3h5l-35.3 53h-5Z" fill="#FFFFFF" />
              </AnimatedG>
            </G>
          </Svg>}
        </Animated.View>
      </View>

      <View accessible accessibilityRole="header" accessibilityLabel="Expenzo" style={styles.wordmark}>
        {LETTERS.map((letter, i) => <Animated.Text key={i} style={[styles.letter, fonts.title, { color: letter === 'X' ? BRAND : palette.title,
          opacity: values.letters[i], transform: [{ translateY: between(values.letters[i], 54, 0) }] }]}>{letter}</Animated.Text>)}
      </View>
      <Animated.Text style={[styles.tagline, fonts.tagline, { color: palette.tagline, opacity: values.tag,
        letterSpacing: between(values.tag, 11 * 0.55, 11 * 0.16) }]}>SMART FINANCE MANAGEMENT</Animated.Text>
    </View>

    <Animated.View accessible accessibilityRole="progressbar" accessibilityLabel="Loading your account" style={[styles.loader, {
      opacity: values.load, transform: [{ translateY: between(values.load, 10, 0) }],
    }]}>
      <View style={[styles.track, { backgroundColor: palette.track }]}>
        <Animated.View style={[styles.fill, { transform: [{ translateX: between(values.fill, -0.34 * 132 * 1.3, 0.34 * 132 * 3.2) }] }]} />
      </View>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden', backgroundColor: '#F3F5FF' },
  deco: { height: 52 },
  decoTop: { position: 'absolute', top: 34, right: -70, alignItems: 'flex-end', gap: 22 },
  decoBottom: { position: 'absolute', bottom: 150, left: -80, gap: 22 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 64 },
  markArea: { width: 176, height: 176, alignItems: 'center', justifyContent: 'center' },
  bloom: { position: 'absolute', left: '50%', top: '50%' },
  ripple: { position: 'absolute', left: '50%', top: '50%', borderWidth: 1.5, borderRadius: 2 },
  mark: { width: MARK, height: MARK },
  ink: { position: 'absolute' },
  wordmark: { flexDirection: 'row', marginTop: 40, paddingBottom: 8, overflow: 'hidden' },
  letter: { fontSize: 46, lineHeight: 51, letterSpacing: -3 },
  tagline: { marginTop: 8, fontSize: 11, textAlign: 'center' },
  loader: { position: 'absolute', left: 0, right: 0, bottom: 84, alignItems: 'center' },
  track: { width: 132, height: 6, overflow: 'hidden', transform: [{ skewX: SKEW }] },
  fill: { width: '34%', height: '100%', backgroundColor: BRAND },
});
