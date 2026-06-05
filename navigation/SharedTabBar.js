import React from 'react';
import { ActivityIndicator, Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

export const tabScreenOptions = {
  headerShown: false,
  animationEnabled: true,
  lazy: true,
  unmountOnBlur: true,
  freezeOnBlur: true,
};

export const TabLoadingState = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#667eea" />
  </View>
);

const TabButton = React.memo(({ focused, iconName, onPress, size = 28 }) => {
  const { theme } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const rippleAnim = React.useRef(new Animated.Value(0)).current;
  const backgroundAnim = React.useRef(new Animated.Value(focused ? 1 : 0)).current;
  const tabBarStyles = React.useMemo(() => createTabBarStyles(theme), [theme]);

  React.useEffect(() => {
    Animated.timing(backgroundAnim, {
      toValue: focused ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [backgroundAnim, focused]);

  const handlePress = React.useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 280,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start(() => {
      rippleAnim.setValue(0);
    });

    onPress();
  }, [onPress, rippleAnim, scaleAnim]);

  return (
    <TouchableOpacity onPress={handlePress} style={tabBarStyles.tabButton} activeOpacity={0.7}>
      <Animated.View
        style={[
          tabBarStyles.rippleEffect,
          {
            opacity: rippleAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, 0.25, 0],
            }),
            transform: [{
              scale: rippleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1.7],
              }),
            }],
          },
        ]}
      />

      <Animated.View
        style={[
          tabBarStyles.focusedBackground,
          {
            opacity: backgroundAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.1],
            }),
            transform: [{
              scale: backgroundAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.85, 1],
              }),
            }],
          },
        ]}
      />

      <Animated.View style={[tabBarStyles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
        <Icon
          name={iconName}
          size={focused ? size + 3 : size}
          color={focused ? theme.primary : theme.textSecondary}
        />
        {focused && (
          <Animated.View
            style={[
              tabBarStyles.focusedDot,
              {
                opacity: backgroundAnim,
                transform: [{
                  scale: backgroundAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                }],
              },
            ]}
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

const AddButton = React.memo(({ isFocused, onPress }) => {
  const { theme } = useTheme();
  const rotateAnim = React.useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const pressScaleAnim = React.useRef(new Animated.Value(1)).current;
  const tabBarStyles = React.useMemo(() => createTabBarStyles(theme), [theme]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: isFocused ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: isFocused ? 1.08 : 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFocused, rotateAnim, scaleAnim]);

  const handlePress = React.useCallback(() => {
    Animated.sequence([
      Animated.spring(pressScaleAnim, {
        toValue: 0.95,
        tension: 280,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(pressScaleAnim, {
        toValue: 1,
        tension: 280,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  }, [onPress, pressScaleAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <TouchableOpacity onPress={handlePress} style={tabBarStyles.addButton} activeOpacity={0.8}>
      <Animated.View
        style={[
          tabBarStyles.addButtonInner,
          {
            backgroundColor: isFocused ? theme.error : theme.primary,
            transform: [{ scale: scaleAnim }, { scale: pressScaleAnim }],
          },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Icon name="plus" size={32} color="white" />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
});

const OptimizedTabBar = ({ state, navigation, addRouteName, initialRouteName, icons }) => {
  const { theme, isLoading } = useTheme();
  const [previousTab, setPreviousTab] = React.useState(initialRouteName);
  const tabBarStyles = React.useMemo(() => createTabBarStyles(theme), [theme]);

  React.useEffect(() => {
    const currentRoute = state.routes[state.index]?.name;
    if (currentRoute && currentRoute !== addRouteName) {
      setPreviousTab(currentRoute);
    }
  }, [addRouteName, state.index, state.routes]);

  if (isLoading || !theme) {
    return null;
  }

  return (
    <View style={tabBarStyles.container}>
      <View
        style={[
          StyleSheet.absoluteFill,
          tabBarStyles.background,
          {
            backgroundColor: theme.isDarkMode ? '#1a1a1a' : '#ffffff',
            borderColor: theme.isDarkMode ? '#333333' : '#e0e0e0',
          },
        ]}
      />

      <View style={tabBarStyles.tabContainer}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const iconName = icons[route.name]?.(isFocused) || 'home-outline';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            } else if (isFocused && route.name === addRouteName) {
              navigation.navigate(previousTab);
            }
          };

          if (route.name === addRouteName) {
            return <AddButton key={route.key} isFocused={isFocused} onPress={onPress} />;
          }

          return (
            <TabButton
              key={route.key}
              focused={isFocused}
              iconName={iconName}
              onPress={onPress}
              size={28}
            />
          );
        })}
      </View>
    </View>
  );
};

export default React.memo(OptimizedTabBar);

const createTabBarStyles = (theme) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 25,
    height: 70,
    borderRadius: 40,
    backgroundColor: 'transparent',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    overflow: 'visible',
  },
  background: {
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 40,
    overflow: 'visible',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  rippleEffect: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme?.primaryContainer || '#667eea20',
  },
  focusedBackground: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme?.primaryContainer || '#667eea20',
  },
  focusedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme?.primary || '#667eea',
    marginTop: 4,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -35,
    zIndex: 10,
  },
  addButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: theme?.primary || '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 6,
    borderColor: theme?.isDarkMode ? '#1a1a1a' : '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
});

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
});
