import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DashboardScreen from '../screens/DashboardScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import BudgetScreen from '../screens/BudgetScreen';
import StatsScreen from '../screens/StatsScreen';
import { useTheme } from '../contexts/ThemeContext';

import { View, Text, StyleSheet, Animated, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';

// Enhanced placeholder screens with animations
const AnimatedPlaceholderScreen = ({ iconName, title, subtitle }) => {
  const { theme, isLoading } = useTheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', paddingTop: StatusBar.currentHeight || 0 }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  React.useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const styles = createPlaceholderStyles(theme);

  return (
    <View style={styles.placeholderScreen}>
      <Animated.View
        style={[
          styles.iconContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Icon name={iconName} size={64} color={theme.primary} />
      </Animated.View>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          alignItems: 'center',
        }}
      >
        <Text style={styles.placeholderTitle}>{title}</Text>
        <Text style={styles.placeholderSubtitle}>{subtitle}</Text>
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
      </Animated.View>
    </View>
  );
};

// Remove placeholders - using actual implementations now

const createPlaceholderStyles = (theme) => StyleSheet.create({
  placeholderScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    paddingHorizontal: 20,
    paddingTop: StatusBar.currentHeight || 0, // Add status bar height padding
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${theme.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    elevation: 5,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  placeholderTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  placeholderSubtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  comingSoonBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 3,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  comingSoonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

const Tab = createBottomTabNavigator();

const AnimatedTabIcon = ({ focused, iconName, size }) => {
  const { theme } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(focused ? 1.2 : 1)).current;
  const bounceAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.3,
          tension: 300,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          tension: 300,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: 0,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 8,
        useNativeDriver: true,
      }).start();
      
      Animated.timing(bounceAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [focused]);

  return (
    <Animated.View
      style={{
        transform: [
          { scale: scaleAnim },
          { translateY: bounceAnim }
        ],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon 
        name={iconName} 
        size={focused ? size + 2 : size} 
        color={focused ? theme.primary : theme.textLight} 
      />
      {focused && (
        <Animated.View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.primary,
            marginTop: 2,
            opacity: scaleAnim,
          }}
        />
      )}
    </Animated.View>
  );
};

// Enhanced Tab Icon with press animation
const AnimatedTabButton = ({ focused, iconName, onPress, size = 28 }) => {
  const { theme } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const rippleAnim = React.useRef(new Animated.Value(0)).current;
  const backgroundAnim = React.useRef(new Animated.Value(focused ? 1 : 0)).current;
  const customTabBarStyles = createCustomTabBarStyles(theme);

  React.useEffect(() => {
    // Background animation for focused state
    Animated.timing(backgroundAnim, {
      toValue: focused ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  const handlePress = () => {
    // Press animation sequence
    Animated.sequence([
      // Scale down
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      // Scale back up with bounce
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // Ripple effect
    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start(() => {
      rippleAnim.setValue(0);
    });

    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={customTabBarStyles.tabButton}
      activeOpacity={0.7}
    >
      {/* Ripple effect background */}
      <Animated.View
        style={[
          customTabBarStyles.rippleEffect,
          {
            opacity: rippleAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, 0.3, 0],
            }),
            transform: [{
              scale: rippleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 2],
              }),
            }],
          },
        ]}
      />
      
      {/* Background circle for focused state */}
      <Animated.View
        style={[
          customTabBarStyles.focusedBackground,
          {
            opacity: backgroundAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.15],
            }),
            transform: [{
              scale: backgroundAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            }],
          },
        ]}
      />
      
      {/* Icon with press animation */}
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon 
          name={iconName} 
          size={focused ? size + 3 : size} 
          color={focused ? theme.primary : theme.textLight} 
        />
        {focused && (
          <Animated.View
            style={[
              customTabBarStyles.focusedDot,
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
};

// Animated Add Transaction Button Component
const AnimatedAddButton = ({ isFocused, onPress }) => {
  const { theme } = useTheme();
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const pressScaleAnim = React.useRef(new Animated.Value(1)).current;
  const [backgroundColor, setBackgroundColor] = React.useState(theme.primary);
  const customTabBarStyles = createCustomTabBarStyles(theme);

  React.useEffect(() => {
    if (isFocused) {
      // Animate to close icon
      setBackgroundColor(theme.error);
      Animated.parallel([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate to plus icon
      setBackgroundColor(theme.primary);
      Animated.parallel([
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isFocused]);

  const handlePress = () => {
    // Add press animation
    Animated.sequence([
      Animated.spring(pressScaleAnim, {
        toValue: 0.95,
        tension: 300,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(pressScaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={customTabBarStyles.addButton}
      activeOpacity={0.8}
    >
      <Animated.View 
        style={[
          customTabBarStyles.addButtonInner,
          {
            backgroundColor: backgroundColor,
            transform: [
              { scale: scaleAnim },
              { scale: pressScaleAnim }
            ],
          }
        ]}
      >
        <Animated.View
          style={{
            transform: [{ rotate: rotation }],
          }}
        >
          <Icon 
            name="plus" 
            size={32} 
            color="white" 
          />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Custom Tab Bar with enhanced Add button
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const { theme, isLoading } = useTheme();
  const [previousTab, setPreviousTab] = React.useState('Home');

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return null;
  }

  React.useEffect(() => {
    // Track previous tab when not on AddTransaction
    if (state.routes[state.index].name !== 'AddTransaction') {
      setPreviousTab(state.routes[state.index].name);
    }
  }, [state.index]);

  const customTabBarStyles = createCustomTabBarStyles(theme);

  return (
    <View style={customTabBarStyles.container}>
      <View style={customTabBarStyles.tabContainer}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          let iconName;
          switch (route.name) {
            case 'Home':
              iconName = isFocused ? 'home' : 'home-outline';
              break;
            case 'Transactions':
              iconName = isFocused ? 'swap-vertical' : 'swap-vertical-variant';
              break;
            case 'Budget':
              iconName = isFocused ? 'wallet' : 'wallet-outline';
              break;
            case 'Stats':
              iconName = isFocused ? 'chart-pie' : 'chart-line';
              break;
            case 'AddTransaction':
              iconName = isFocused ? 'plus-circle' : 'plus-circle-outline';
              break;
            default:
              iconName = 'home-outline';
          }

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              if (route.name === 'AddTransaction') {
                navigation.navigate(route.name);
              } else {
                navigation.navigate(route.name);
              }
            } else if (isFocused && route.name === 'AddTransaction') {
              // If AddTransaction is focused and pressed again, go back to previous tab
              navigation.navigate(previousTab);
            }
          };

          // Special styling for Add Transaction button
          if (route.name === 'AddTransaction') {
            return (
              <AnimatedAddButton
                key={route.key}
                isFocused={isFocused}
                onPress={onPress}
              />
            );
          }

          return (
            <AnimatedTabButton
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

const createCustomTabBarStyles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.tabBar,
    borderTopWidth: theme.tabBarBorder === 'transparent' ? 0 : 1,
    borderTopColor: theme.tabBarBorder,
    elevation: 20,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    paddingBottom: 10,
    paddingTop: 15,
    height: 75,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabContainer: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
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
    backgroundColor: theme.primary,
  },
  focusedBackground: {
    position: 'absolute',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: theme.primary,
  },
  focusedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.primary,
    marginTop: 4,
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -15,
  },
  addButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 4,
    borderColor: theme.tabBar,
  },
});

// Enhanced screen wrapper with page transition animations
const AnimatedScreenWrapper = ({ children }) => {
  const { theme } = useTheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;

  React.useEffect(() => {
    // Animate in when screen becomes active
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: theme?.background || '#f8f9fa',
        opacity: fadeAnim,
        transform: [
          { translateY: slideAnim },
          { scale: scaleAnim }
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

// Enhanced screen components with transition animations
const AnimatedDashboardScreen = ({ navigation, route }) => {
  return (
    <AnimatedScreenWrapper>
      <DashboardScreen navigation={navigation} route={route} />
    </AnimatedScreenWrapper>
  );
};

const AnimatedTransactionsScreen = ({ navigation }) => {
  return (
    <AnimatedScreenWrapper>
      <TransactionsScreen navigation={navigation} />
    </AnimatedScreenWrapper>
  );
};

const AnimatedBudgetScreen = ({ navigation }) => {
  return (
    <AnimatedScreenWrapper>
      <BudgetScreen navigation={navigation} />
    </AnimatedScreenWrapper>
  );
};

const AnimatedStatsScreen = ({ navigation }) => {
  return (
    <AnimatedScreenWrapper>
      <StatsScreen navigation={navigation} />
    </AnimatedScreenWrapper>
  );
};

const AnimatedAddTransactionScreen = ({ navigation }) => {
  return (
    <AnimatedScreenWrapper>
      <AddTransactionScreen navigation={navigation} />
    </AnimatedScreenWrapper>
  );
};

export default function TabNavigator() {
  const { theme, isLoading } = useTheme();
  
  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }
  
  // Suppress default configuration warnings
  React.useEffect(() => {
    const originalWarn = console.warn;
    const originalLog = console.log;
    
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string' && 
          (args[0].includes('default configuration') || 
           args[0].includes('configuration warning') ||
           args[0].includes('TabNavigator'))) {
        return;
      }
      originalWarn.apply(console, args);
    };
    
    console.log = (...args) => {
      if (args[0] && typeof args[0] === 'string' && 
          (args[0].includes('default configuration') || 
           args[0].includes('configuration warning'))) {
        return;
      }
      originalLog.apply(console, args);
    };
    
    return () => {
      console.warn = originalWarn;
      console.log = originalLog;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme?.background || '#f8f9fa' }}>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animationEnabled: true,
          lazy: false,
          unmountOnBlur: false,
        }}
      >
      <Tab.Screen 
        name="Home" 
        component={AnimatedDashboardScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Transactions" 
        component={AnimatedTransactionsScreen}
        options={{
          tabBarLabel: 'Transactions',
        }}
      />
      <Tab.Screen 
        name="AddTransaction" 
        component={AnimatedAddTransactionScreen}
        options={{
          tabBarLabel: 'Add',
        }}
      />
      <Tab.Screen 
        name="Budget" 
        component={AnimatedBudgetScreen}
        options={{
          tabBarLabel: 'Budget',
        }}
      />
      <Tab.Screen 
        name="Stats" 
        component={AnimatedStatsScreen}
        options={{
          tabBarLabel: 'Stats',
        }}
      />
    </Tab.Navigator>
    </View>
  );
}