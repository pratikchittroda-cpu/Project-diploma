const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createHooks, native, esm, treeNodes } = require('./helpers/react-ui.cjs');

const flatten = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const surface = (os, liquid) => load('components/GlassSurface.js', {
  react: {}, 'react-native': { ...native, Platform: { OS: os } }, 'expo-blur': { BlurView: 'Blur' },
  'expo-linear-gradient': { LinearGradient: 'Sheen' },
  'expo-glass-effect': { GlassView: 'GlassView', isLiquidGlassAvailable: () => liquid },
});
const layers = element => treeNodes({ props: { children: element } });

test('theme colours become translucent tints without losing their hue', () => {
  const { withAlpha } = surface('ios', false);
  assert.equal(withAlpha('#1E1E1E', 0.5), 'rgba(30, 30, 30, 0.5)');
  assert.equal(withAlpha('#fff', 0.62), 'rgba(255, 255, 255, 0.62)');
  assert.equal(withAlpha('#3157FF80', 0.5), 'rgba(49, 87, 255, 0.251)');
  assert.equal(withAlpha('rgba(10, 20, 30, 0.5)', 0.5), 'rgba(10, 20, 30, 0.25)');
  assert.equal(withAlpha('rgb(10,20,30)', 0.4), 'rgba(10, 20, 30, 0.4)');
  assert.equal(withAlpha('transparent', 0.4), 'transparent');
  assert.equal(withAlpha(undefined, 0.4), undefined);
});

test('glass surface picks Expo liquid glass, then blur, then a plain tint', () => {
  const liquidLayers = layers(surface('ios', true).default({ color: '#1E1E1E', dark: true, borderRadius: 22, interactive: true }));
  const liquid = liquidLayers.find(node => node.type === 'GlassView');
  assert.equal(liquid.props.pointerEvents, 'none');
  assert.equal(liquid.props.isInteractive, true);
  assert.equal(liquid.props.colorScheme, 'dark');
  assert.equal(liquid.props.tintColor, 'rgba(30, 30, 30, 0.2)');
  // A plain card-colour base sits behind the glass so every card has the same frosted look.
  const base = liquidLayers.find(node => node.type === 'View');
  assert.equal(liquidLayers.indexOf(base) < liquidLayers.indexOf(liquid), true);
  assert.equal(flatten(base.props.style).backgroundColor, 'rgba(30, 30, 30, 0.34)');
  assert.equal(flatten(liquid.props.style).borderRadius, 22);
  // Every path adds a soft top sheen so glass reads even over a black page.
  for (const [os, glass] of [['ios', true], ['ios', false], ['android', false]]) {
    const sheen = layers(surface(os, glass).default({ color: '#1E1E1E', dark: true, borderRadius: 22 })).find(node => node.type === 'Sheen');
    assert.equal(sheen.props.pointerEvents, 'none');
    assert.deepEqual(Array.from(sheen.props.colors), ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0)']);
    assert.equal(flatten(sheen.props.style).borderRadius, 22);
  }
  assert.equal(surface('ios', false).glassEdge(true), 'rgba(255,255,255,0.14)');
  assert.equal(surface('ios', false).glassEdge(false), 'rgba(255,255,255,0.6)');
  const ios = layers(surface('ios', false).default({ color: '#FFFFFF', dark: false, intensity: 25 }));
  assert.equal(ios.find(node => node.type === 'Blur').props.intensity, 25);
  assert.equal(flatten(ios.find(node => node.type === 'View').props.style).backgroundColor, 'rgba(255, 255, 255, 0.62)');
  const android = layers(surface('android', false).default({ color: '#FFFFFF', dark: false }));
  assert.equal(android.some(node => node.type === 'Blur'), false);
  assert.equal(flatten(android.find(node => node.type === 'View').props.style).backgroundColor, 'rgba(255, 255, 255, 0.86)');
});

test('app background keeps the page gradient, adds glows and bars, and never takes touches', () => {
  for (const isDarkMode of [false, true]) {
    const hooks = createHooks();
    const started = [];
    const animation = { start() { started.push(1); }, stop() {} };
    const Background = load('components/AppBackground.js', {
      react: hooks.react, 'react-native': { ...native, useWindowDimensions: () => ({ width: 402, height: 874 }),
        Animated: { View: 'AnimatedView', Value: class { interpolate() { return 0; } }, timing: () => animation, sequence: () => animation, loop: () => animation },
        Easing: { inOut: x => x, ease: x => x }, AccessibilityInfo: { isReduceMotionEnabled: async () => false } },
      'expo-linear-gradient': { LinearGradient: 'Gradient' },
      'react-native-svg': { ...esm('Svg'), Defs: 'Defs', RadialGradient: 'RadialGradient', Stop: 'Stop', Circle: 'Circle' },
      '../contexts/ThemeContext': { useTheme: () => ({ theme: { isDarkMode, primary: '#3157FF', background: '#0A0C17' } }) },
      './GlassSurface': surface('ios', false),
      // No navigator here: the background treats itself as focused.
      '@react-navigation/native': { NavigationContext: { value: undefined } },
    }).default;
    const tree = hooks.render(() => Background({ colors: ['#111111', '#222222'] }));
    assert.equal(tree.props.pointerEvents, 'none');
    assert.equal(tree.props.testID, 'app-background');
    const nodes = treeNodes(tree);
    const gradients = nodes.filter(node => node.type === 'Gradient');
    assert.deepEqual(gradients[0].props.colors, ['#111111', '#222222']);
    assert.equal(nodes.filter(node => node.type === 'Circle').length, 2);
    const animated = nodes.filter(node => node.type === 'AnimatedView');
    const glows = animated.filter(node => treeNodes(node).some(child => child.type === 'Circle'));
    const bars = animated.filter(node => !glows.includes(node));
    assert.equal(glows.length, 2);
    assert.equal(bars.length, 4);
    // Each bar is a soft streak fading to transparent toward the screen centre.
    for (const bar of bars) assert.ok(treeNodes(bar).find(node => node.type === 'Gradient').props.colors.includes('rgba(0,0,0,0)'));
    assert.equal(started.length, 1);
    hooks.unmount();
  }
});

test('background effects stay visible on every catalogue theme in both modes', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const glass = surface('ios', false);
  const background = load('components/AppBackground.js', { react: {}, 'react-native': native, 'expo-linear-gradient': {}, 'react-native-svg': {}, '@react-navigation/native': { NavigationContext: {} },
    '../contexts/ThemeContext': {}, './GlassSurface': glass });
  const source = fs.readFileSync(path.join(__dirname, '../contexts/ThemeContext.js'), 'utf8');
  const themes = [...source.matchAll(/id: '([a-z-]+)',[\s\S]*?primary: '(#[\da-f]{6})',\s*primaryLight: '(#[\da-f]{6})'/gi)];
  assert.ok(themes.length >= 20);
  for (const [, id, primary, primaryLight] of themes) {
    // Dark pages are black, so the accent must clearly show on black (≥ 4.5:1).
    const accent = background.visibleAccent({ primary, primaryLight });
    assert.ok((background.luminance(accent) + 0.05) / (0.0015 + 0.05) >= 4.5, `${id} accent ${accent}`);
    const dark = background.backgroundPalette({ isDarkMode: true, primary, primaryLight });
    assert.equal(dark.glow, accent);
    assert.match(dark.bar, /^rgba\(/);
    // Light pages are the theme gradient (darkened for white text), so white effects show.
    const light = background.backgroundPalette({ isDarkMode: false, primary, primaryLight });
    assert.equal(light.glow, '#FFFFFF');
    assert.ok(light.glowStrength[0] >= 0.3);
  }
  // A dim theme colour is lifted rather than used as is.
  assert.notEqual(background.visibleAccent({ primary: '#434343', primaryLight: '#000000' }), '#434343');
});

test('logo loader replays the E intro in a loop and works as an ActivityIndicator stand-in', () => {
  for (const reduceMotion of [false, true]) {
    const { createHooks: makeHooks } = require('./helpers/react-ui.cjs');
    const hooks = makeHooks();
    const loops = [];
    const values = [];
    class Value { constructor(v) { this.v = v; values.push(this); } setValue(v) { this.v = v; } interpolate({ inputRange, outputRange }) {
      for (let i = 1; i < inputRange.length; i++) assert.ok(inputRange[i] >= inputRange[i - 1], 'monotonic keyframes');
      return { inputRange, outputRange }; } }
    const Loader = load('components/LogoLoader.js', {
      react: hooks.react, 'react-native': { ...native, Animated: { View: 'AnimatedView', Value, timing: () => ({}), loop: () => ({ start() { loops.push('start'); }, stop() { loops.push('stop'); } }) },
        Easing: { linear: x => x }, AccessibilityInfo: { isReduceMotionEnabled: async () => reduceMotion } },
      'react-native-svg': { ...esm('Svg'), Path: 'Path' }, './GlassSurface': surface('ios', false),
    });
    const tree = hooks.render(() => Loader.default({ size: 'large', accessibilityLabel: 'Loading theme', testID: 'loader' }));
    assert.equal(tree.props.accessibilityRole, 'progressbar');
    assert.equal(tree.props.accessibilityLabel, 'Loading theme');
    assert.equal(tree.props.testID, 'loader');
    assert.deepEqual(flatten(tree.props.style), { width: 40, height: 40 });
    const paths = treeNodes(tree).filter(node => node.type === 'Path');
    assert.equal(paths.length, 4);
    assert.deepEqual(paths.map(node => node.props.fill), ['#3157FF', '#3157FF', '#3157FF', '#10121D']);
    assert.deepEqual(loops, ['start']);
    hooks.unmount();
    // A custom colour (white on a gradient button) tints the bars and a translucent ink block.
    const white = hooks.render(() => Loader.default({ color: '#FFFFFF' }));
    assert.deepEqual(flatten(white.props.style), { width: 22, height: 22 });
    assert.deepEqual(treeNodes(white).filter(node => node.type === 'Path').map(node => node.props.fill),
      ['#FFFFFF', '#FFFFFF', '#FFFFFF', 'rgba(255, 255, 255, 0.55)']);
    assert.equal(Loader.default({ size: 64 }).props.style[0].width, 64);
  }
});

test('only the focused screen animates its background; glows are cached as textures', () => {
  const hooks = createHooks();
  const listeners = {};
  let focused = false;
  const navigation = { isFocused: () => focused, addListener: (event, fn) => { listeners[event] = fn; return () => { delete listeners[event]; }; } };
  const starts = [], stops = [];
  const animation = { start() { starts.push(1); }, stop() { stops.push(1); } };
  const Background = load('components/AppBackground.js', {
    react: hooks.react, 'react-native': { ...native, useWindowDimensions: () => ({ width: 402, height: 874 }),
      Animated: { View: 'AnimatedView', Value: class { setValue() {} interpolate() { return 0; } }, timing: () => animation, sequence: () => animation, loop: () => animation },
      Easing: { inOut: x => x, sin: x => x }, AccessibilityInfo: { isReduceMotionEnabled: async () => false } },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'react-native-svg': { ...esm('Svg'), Defs: 'Defs', RadialGradient: 'RadialGradient', Stop: 'Stop', Circle: 'Circle' },
    '../contexts/ThemeContext': { useTheme: () => ({ theme: { isDarkMode: true, primary: '#3157FF' } }) },
    './GlassSurface': surface('ios', false), '@react-navigation/native': { NavigationContext: { value: navigation } },
  }).default;
  let tree = hooks.render(() => Background({ colors: ['#000000', '#111111'] }));
  assert.equal(starts.length, 0); // a hidden screen does not animate
  for (const glow of treeNodes(tree).filter(node => node.type === 'AnimatedView' && treeNodes(node).some(child => child.type === 'Circle'))) {
    assert.equal(glow.props.renderToHardwareTextureAndroid, true);
    assert.equal(glow.props.shouldRasterizeIOS, true);
  }
  focused = true; listeners.focus();
  hooks.render(() => Background({ colors: ['#000000', '#111111'] }));
  assert.equal(starts.length, 1);
  focused = false; listeners.blur();
  hooks.render(() => Background({ colors: ['#000000', '#111111'] }));
  assert.equal(stops.length, 1); // leaving the screen stops it
  hooks.unmount();
  assert.deepEqual(Object.keys(listeners), []);
});

test('no app code relies on StyleSheet.absoluteFillObject, which React Native 0.88 removed', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const offenders = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.js$/.test(entry.name) && /StyleSheet\.absoluteFillObject/.test(fs.readFileSync(file, 'utf8'))) offenders.push(path.relative(root, file));
    }
  };
  for (const dir of ['components', 'screens', 'navigation', 'contexts', 'theme', 'hooks', 'utils']) walk(path.join(root, dir));
  if (/StyleSheet\.absoluteFillObject/.test(fs.readFileSync(path.join(root, 'App.js'), 'utf8'))) offenders.push('App.js');
  // Spreading the missing constant silently adds nothing, so overlays stop covering the screen.
  assert.deepEqual(offenders, []);
});
