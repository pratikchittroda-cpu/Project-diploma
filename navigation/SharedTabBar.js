import React from 'react';
import { AccessibilityInfo, Animated, Easing, Keyboard, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import SplashScreen from '../screens/personal/SplashScreen';
import { luminance, visibleAccent } from '../components/AppBackground';
import { brandFontsReady } from '../theme/fonts';

export const tabScreenOptions = {
  headerShown: false,
  animation: 'fade',
  lazy: true,
  freezeOnBlur: true,
  tabBarHideOnKeyboard: true,
};

export const TabLoadingState = () => <SplashScreen />;

// "Liquid dock" tab bar: a dark floating capsule of five equal slots. A glowing accent blob sits
// behind the active icon; switching tabs slides it across like a drop of liquid (stretching and
// squashing mid-flight, springing back round) and a ring ripples out where it lands.
//
// Every moving part animates only transforms and opacity on the native UI thread, so motion stays
// at 60fps however busy JavaScript is. Layout never animates: each slot is a normal flex child, and
// only the blob and ripple float above them, positioned by translateX.
const BAR_COLOR = '#141414';
const IDLE_COLOR = '#A8A29E';
const BAR_HEIGHT = 68;
const BAR_PADDING = 6;
const BLOB = 40;
const MAX_BAR_WIDTH = 420;
const GLIDE = { stiffness: 300, damping: 24, mass: 0.9 };

// Centre of each equal slot, measured from the bar's inner left edge.
export const slotCentre = (index, innerWidth, count) => (innerWidth / count) * (index + 0.5);

function useAnimatedValues(keys, initial) {
  const store = React.useRef(new Map());
  keys.forEach((key, index) => {
    if (!store.current.has(key)) store.current.set(key, new Animated.Value(initial(index)));
  });
  return keys.map(key => store.current.get(key));
}

const OptimizedTabBar = ({ state, descriptors = {}, navigation, addRouteName, initialRouteName, icons }) => {
  const { theme, isLoading, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const previousTab = React.useRef(initialRouteName);
  const [keyboardVisible, setKeyboardVisible] = React.useState(() => Keyboard.isVisible?.() || false);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  const routes = state.routes;
  const count = routes.length;
  const activeIndex = state.index;
  const sidePadding = { left: Math.max(insets.left, 16), right: Math.max(insets.right, 16) };
  // Inner width estimated from the window first, then measured exactly when the bar lays out.
  const [innerWidth, setInnerWidth] = React.useState(() =>
    Math.min(window.width - sidePadding.left - sidePadding.right, MAX_BAR_WIDTH) - 2 * BAR_PADDING - 2);
  const blobX = target => slotCentre(target, innerWidth, count) - BLOB / 2;

  const keys = routes.map(route => route.key);
  const focus = useAnimatedValues(keys, index => (index === activeIndex ? 1 : 0));
  const press = useAnimatedValues(keys, () => 0);
  const position = React.useRef(new Animated.Value(blobX(activeIndex))).current;
  const stretch = React.useRef(new Animated.Value(0)).current;
  const ripple = React.useRef(new Animated.Value(1)).current;
  const first = React.useRef(true);

  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  React.useEffect(() => {
    let active = true;
    AccessibilityInfo?.isReduceMotionEnabled?.().then(enabled => { if (active) setReduceMotion(!!enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    const name = routes[activeIndex]?.name;
    if (name && name !== addRouteName) previousTab.current = name;
  }, [routes, activeIndex, addRouteName]);

  React.useEffect(() => {
    const target = blobX(activeIndex);
    if (first.current || reduceMotion) {
      first.current = false;
      position.setValue(target);
      focus.forEach((value, index) => value.setValue(index === activeIndex ? 1 : 0));
      return undefined;
    }
    const native = { useNativeDriver: true, isInteraction: false };
    ripple.setValue(0);
    const motion = Animated.parallel([
      // The blob glides over with one soft overshoot…
      Animated.spring(position, { toValue: target, ...GLIDE, ...native }),
      // …stretching and squashing mid-flight, then wobbling back round…
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), ...native }),
        Animated.spring(stretch, { toValue: 0, stiffness: 240, damping: 10, mass: 0.7, ...native }),
      ]),
      // …and a ring ripples out where it lands.
      Animated.sequence([
        Animated.delay(140),
        Animated.timing(ripple, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), ...native }),
      ]),
      ...focus.map((value, index) => Animated.timing(value, {
        toValue: index === activeIndex ? 1 : 0, duration: 260, easing: Easing.out(Easing.cubic), ...native,
      })),
    ]);
    motion.start();
    return () => motion.stop();
  }, [activeIndex, innerWidth, count, reduceMotion]);

  if (isLoading || !theme) return null;
  const activeRoute = routes[activeIndex];
  const hideOnKeyboard = descriptors[activeRoute?.key]?.options.tabBarHideOnKeyboard ?? tabScreenOptions.tabBarHideOnKeyboard;
  if (keyboardVisible && hideOnKeyboard) return null;
  const bottomClearance = Math.max(insets.bottom, 12) + 8;
  // The blob uses the theme's accent, lifted so it glows on the dark bar; the active icon uses
  // whichever of dark or white contrasts more with it.
  const accent = visibleAccent(theme);
  const level = luminance(accent);
  const onAccent = (level + 0.05) / (luminance('#111111') + 0.05) >= 1.05 / (level + 0.05) ? '#111111' : '#FFFFFF';
  const squish = (value, pressed) => Animated.spring(value, {
    toValue: pressed ? 1 : 0, stiffness: 520, damping: 22, mass: 0.6, useNativeDriver: true,
  }).start();
  const fade = (value, from, to) => value.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  // Animated.Text bypasses the brand-font wrapper, so name the face directly once fonts are loaded.
  const labelFont = brandFontsReady() ? { fontFamily: 'Manrope_700Bold', fontWeight: 'normal' } : null;

  return (
    <View pointerEvents="box-none" style={[styles.floatingBar, {
      height: BAR_HEIGHT + bottomClearance,
      paddingLeft: sidePadding.left,
      paddingRight: sidePadding.right,
    }]}>
      <View style={[styles.bar, {
        backgroundColor: BAR_COLOR,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000000',
        shadowOpacity: isDarkMode ? 0.35 : 0.22,
      }]} onLayout={event => {
        const measured = event.nativeEvent.layout.width - 2 * BAR_PADDING - 2;
        if (measured > 0 && Math.abs(measured - innerWidth) > 0.5) setInnerWidth(measured);
      }}>
        {/* The liquid blob and its landing ripple, floating behind the icons. */}
        <View pointerEvents="none" style={styles.blobLayer}>
          <Animated.View style={[styles.ripple, { borderColor: accent,
            opacity: fade(ripple, 0.55, 0),
            transform: [{ translateX: position }, { scale: fade(ripple, 1, 1.75) }] }]} />
          <Animated.View style={[styles.blob, { backgroundColor: accent, shadowColor: accent,
            transform: [
              { translateX: position },
              { scaleX: fade(stretch, 1, 1.45) },
              { scaleY: fade(stretch, 1, 0.82) },
            ] }]} />
        </View>

        {routes.map((route, index) => {
          const focused = activeIndex === index;
          const options = descriptors[route.key]?.options || {};
          const adding = route.name === addRouteName;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title || route.name);
          const displayLabel = adding ? (focused ? 'Close' : 'Add') : label;
          const actionLabel = adding ? (focused ? 'Close add transaction' : 'Add transaction') : label;
          const on = focus[index];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (event.defaultPrevented) return;
            if (!focused) {
              if (adding && activeRoute?.name !== addRouteName) previousTab.current = activeRoute?.name || initialRouteName;
              navigation.navigate(route.name, route.params);
            } else if (adding) {
              const previous = routes.find((tab) => tab.name === previousTab.current && tab.name !== addRouteName)
                || routes.find((tab) => tab.name === initialRouteName && tab.name !== addRouteName)
                || routes.find((tab) => tab.name !== addRouteName);
              if (previous) navigation.navigate(previous.name, previous.params);
            }
          };
          const iconIdle = icons[route.name]?.(false) || 'home-outline';
          const iconActive = icons[route.name]?.(true) || 'home';
          return (
            <Pressable key={route.key} accessible
              accessibilityRole={adding ? 'button' : 'tab'}
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel || actionLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onPressIn={() => squish(press[index], true)}
              onPressOut={() => squish(press[index], false)}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.tab}>
              <Animated.View style={[styles.iconWrap, { transform: [
                { translateY: fade(on, 0, -1) },
                // The new tab's icon pops as it lands, and squishes while pressed.
                { scale: Animated.multiply(fade(press[index], 1, 0.86), on.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1.14, 1] })) },
              ] }]}>
                {adding ? <View style={styles.addButton}>
                  <Animated.View style={{ transform: [{ rotate: fade(on, '0deg', '45deg') }] }}>
                    <MaterialCommunityIcons accessible={false} name="plus" size={22} color="#111111" />
                  </Animated.View>
                </View> : <>
                  <Animated.View style={[styles.iconLayer, { opacity: fade(on, 1, 0) }]}>
                    <MaterialCommunityIcons accessible={false} name={iconIdle} size={23} color={IDLE_COLOR} />
                  </Animated.View>
                  <Animated.View style={[styles.iconLayer, { opacity: on }]}>
                    <MaterialCommunityIcons accessible={false} name={iconActive} size={23} color={onAccent} />
                  </Animated.View>
                </>}
              </Animated.View>
              {/* The name brightens to white on the active tab and fades back to grey elsewhere. */}
              <View style={styles.labelStack}>
                <Animated.Text accessible={false} numberOfLines={1} maxFontSizeMultiplier={1.2}
                  style={[styles.label, labelFont, { color: IDLE_COLOR, opacity: fade(on, 1, 0) }]}>{displayLabel}</Animated.Text>
                <Animated.Text accessible={false} numberOfLines={1} maxFontSizeMultiplier={1.2}
                  style={[styles.label, labelFont, styles.labelActive, { opacity: on }]}>{displayLabel}</Animated.Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default React.memo(OptimizedTabBar);

const styles = StyleSheet.create({
  floatingBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    width: '100%', alignItems: 'center',
  },
  bar: { width: '100%', maxWidth: MAX_BAR_WIDTH, height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'stretch',
    paddingHorizontal: BAR_PADDING, paddingVertical: BAR_PADDING, borderRadius: 34, borderWidth: 1, elevation: 8,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 16 },
  blobLayer: { position: 'absolute', left: BAR_PADDING, right: BAR_PADDING, top: BAR_PADDING, height: BLOB + 2 },
  blob: { position: 'absolute', left: 0, top: 1, width: BLOB, height: BLOB, borderRadius: BLOB / 2,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 6 },
  ripple: { position: 'absolute', left: 0, top: 1, width: BLOB, height: BLOB, borderRadius: BLOB / 2, borderWidth: 2 },
  tab: { flex: 1, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'flex-start' },
  iconWrap: { width: BLOB, height: BLOB + 2, alignItems: 'center', justifyContent: 'center' },
  iconLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  addButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  labelStack: { height: 13, alignSelf: 'stretch', alignItems: 'center' },
  label: { position: 'absolute', fontSize: 10, lineHeight: 13, fontWeight: '700', textAlign: 'center' },
  labelActive: { color: '#FFFFFF' },
});
