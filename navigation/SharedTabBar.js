import React from 'react';
import { Animated, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import SplashScreen from '../screens/personal/SplashScreen';
import { accountGradientColors } from '../components/account/AccountPrimitives';

export const tabScreenOptions = {
  headerShown: false,
  animation: 'fade',
  lazy: true,
  freezeOnBlur: true,
  tabBarHideOnKeyboard: true,
};

export const TabLoadingState = () => <SplashScreen />;

const TabButton = React.memo(({ focused, adding, iconName, color, theme, label, ...props }) => {
  const focus = React.useRef(new Animated.Value(focused ? 1 : 0)).current;
  const scale = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const animation = Animated.spring(focus, {
      toValue: focused ? 1 : 0, tension: 100, friction: 10, useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [focus, focused]);
  const feedback = (pressed) => Animated.spring(scale, {
    toValue: pressed ? 0.92 : 1, tension: 260, friction: 9, useNativeDriver: true,
  }).start();

  return <Pressable {...props} accessible
    onPressIn={() => feedback(true)} onPressOut={() => feedback(false)}
    style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.85 : 1 }]}>
    <Animated.View pointerEvents="none" style={[styles.focusBackground, {
      backgroundColor: theme.primaryContainer || theme.surfaceVariant || theme.surface, opacity: focus,
    }]} />
    <Animated.View pointerEvents="none" style={[styles.tabContent, { transform: [{ scale }] }]}>
      {adding ? <View style={styles.addCircle}>
        <LinearGradient colors={accountGradientColors(theme)}
          style={styles.addGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Animated.View style={{ transform: [{ rotate: focus.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
            <MaterialCommunityIcons accessible={false} name="plus" size={24} color="#fff" />
          </Animated.View>
        </LinearGradient>
      </View> : <View style={styles.iconWrap}>
        <MaterialCommunityIcons accessible={false} name={iconName} size={22} color={color} />
      </View>}
      <Text accessible={false} numberOfLines={1} maxFontSizeMultiplier={1.2}
        style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]}>{label}</Text>
    </Animated.View>
  </Pressable>;
});

const OptimizedTabBar = ({ state, descriptors = {}, navigation, addRouteName, initialRouteName, icons }) => {
  const { theme, isLoading, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const previousTab = React.useRef(initialRouteName);
  const [keyboardVisible, setKeyboardVisible] = React.useState(() => Keyboard.isVisible?.() || false);

  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  React.useEffect(() => {
    const name = state.routes[state.index]?.name;
    if (name && name !== addRouteName) previousTab.current = name;
  }, [state.routes, state.index, addRouteName]);

  if (isLoading || !theme) return null;
  const activeRoute = state.routes[state.index];
  const hideOnKeyboard = descriptors[activeRoute?.key]?.options.tabBarHideOnKeyboard ?? tabScreenOptions.tabBarHideOnKeyboard;
  if (keyboardVisible && hideOnKeyboard) return null;
  const bottomClearance = Math.max(insets.bottom, 12) + 8;
  return (
    <View pointerEvents="box-none" style={[styles.floatingBar, {
      height: 64 + bottomClearance,
      paddingLeft: Math.max(insets.left, 16),
      paddingRight: Math.max(insets.right, 16),
    }]}>
      <View style={[styles.bar, {
        backgroundColor: theme.tabBar || theme.surface,
        borderColor: theme.border,
        shadowColor: theme.shadow || theme.text,
        shadowOpacity: isDarkMode ? 0.18 : 0.08,
      }]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options || {};
          const adding = route.name === addRouteName;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title || route.name);
          const displayLabel = adding ? (focused ? 'Close' : 'Add') : label;
          const actionLabel = adding ? (focused ? 'Close add transaction' : 'Add transaction') : label;
          const color = focused || adding ? (theme.accent || theme.text) : (theme.textSecondary || theme.text);
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (event.defaultPrevented) return;
            if (!focused) {
              if (adding && activeRoute?.name !== addRouteName) previousTab.current = activeRoute?.name || initialRouteName;
              navigation.navigate(route.name, route.params);
            } else if (adding) {
              const previous = state.routes.find((tab) => tab.name === previousTab.current && tab.name !== addRouteName)
                || state.routes.find((tab) => tab.name === initialRouteName && tab.name !== addRouteName)
                || state.routes.find((tab) => tab.name !== addRouteName);
              if (previous) navigation.navigate(previous.name, previous.params);
            }
          };
          return (
            <TabButton key={route.key}
              adding={adding} focused={focused} theme={theme} color={color} label={displayLabel}
              iconName={icons[route.name]?.(focused) || 'home-outline'}
              accessibilityRole={adding ? 'button' : 'tab'}
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel || actionLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
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
  bar: { width: '100%', maxWidth: 420, height: 64, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 5, borderRadius: 32, borderWidth: 1, elevation: 4,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10 },
  tab: { flex: 1, minHeight: 52, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  tabContent: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  iconWrap: { alignItems: 'center', justifyContent: 'center', width: 34, height: 34 },
  label: { fontSize: 11, lineHeight: 14, marginTop: 2, textAlign: 'center' },
  focusBackground: { ...StyleSheet.absoluteFillObject, left: 2, right: 2, borderRadius: 24 },
  addCircle: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
  addGradient: { flex: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
