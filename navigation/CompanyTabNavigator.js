import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import CompanyDashboardScreen from '../screens/CompanyDashboardScreen';
import CompanyReportsScreen from '../screens/CompanyReportsScreen';
import TeamManagementScreen from '../screens/TeamManagementScreen';
import CompanyBudgetScreen from '../screens/CompanyBudgetScreen';
import AddCompanyTransactionScreen from '../screens/AddCompanyTransactionScreen';
import { useTheme } from '../contexts/ThemeContext';

import { View, Text, StyleSheet, Animated, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';

// Enhanced placeholder screens with animations for company features
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

// Remove placeholder screens - using actual implementations now

const createPlaceholderStyles = (theme) => StyleSheet.create({
  placeholderScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    paddingHorizontal: 20,
    paddingTop: StatusBar.currentHeight || 0,
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

// Enhanced Tab Icon with press animation
const AnimatedTabButton = ({ focused, iconName, onPress, size = 28 }) => {
  const { theme } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const rippleAnim = React.useRef(new Animated.Value(0)).current;
  const backgroundAnim = React.useRef(new Animated.Value(focused ? 1 : 0)).current;
  const customTabBarStyles = createCustomTabBarStyles(theme);

  React.useEffect(() => {
    Animated.timing(backgroundAnim, {
      toValue: focused ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  const handlePress = () => {
    // Press animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
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
          color={focused ? 'white' : 'rgba(255, 255, 255, 0.6)'}
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
  const [previousTab, setPreviousTab] = React.useState('CompanyHome');

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return null;
  }

  React.useEffect(() => {
    if (state.routes[state.index].name !== 'AddCompanyTransaction') {
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
            case 'CompanyHome':
              iconName = isFocused ? 'view-dashboard' : 'view-dashboard-outline';
              break;
            case 'CompanyReports':
              iconName = isFocused ? 'chart-line' : 'chart-line-variant';
              break;
            case 'TeamManagement':
              iconName = isFocused ? 'account-group' : 'account-group-outline';
              break;
            case 'CompanyBudget':
              iconName = isFocused ? 'calculator' : 'calculator-variant';
              break;
            case 'AddCompanyTransaction':
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
              navigation.navigate(route.name);
            } else if (isFocused && route.name === 'AddCompanyTransaction') {
              navigation.navigate(previousTab);
            }
          };

          // Special styling for Add Transaction button
          if (route.name === 'AddCompanyTransaction') {
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 10,
    paddingTop: 15,
    height: 75,
    // Glassmorphism effect
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    // Shadow and elevation
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    // Backdrop blur simulation
    overflow: 'hidden',
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  focusedBackground: {
    position: 'absolute',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});

// Enhanced screen wrapper with page transition animations
const AnimatedScreenWrapper = ({ children }) => {
  const { theme } = useTheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;

  React.useEffect(() => {
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
const AnimatedCompanyDashboardScreen = ({ navigation, route }) => {
  return (
    <AnimatedScreenWrapper>
      <CompanyDashboardScreen navigation={navigation} route={route} />
    </AnimatedScreenWrapper>
  );
};

const AnimatedCompanyReportsScreen = ({ navigation }) => {
  return (
    <AnimatedScreenWrapper>
      <CompanyReportsScreen navigation={navigation} />
    </AnimatedScreenWrapper>
  );
};

const AnimatedTeamManagementScreen = ({ navigation }) => {
  return (
    <AnimatedScreenWrapper>
      <TeamManagementScreen navigation={navigation} />
    </AnimatedScreenWrapper>
  );
};

const AnimatedCompanyBudgetScreen = ({ navigation }) => {
  return (
    <AnimatedScreenWrapper>
      <CompanyBudgetScreen navigation={navigation} />
    </AnimatedScreenWrapper>
  );
};

const AnimatedAddCompanyTransactionScreen = ({ navigation }) => {
  return (
    <AnimatedScreenWrapper>
      <AddCompanyTransactionScreen navigation={navigation} />
    </AnimatedScreenWrapper>
  );
};

export default function CompanyTabNavigator() {
  const { theme, isLoading } = useTheme();

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

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
          name="CompanyHome"
          component={AnimatedCompanyDashboardScreen}
          options={{
            tabBarLabel: 'Dashboard',
          }}
        />
        <Tab.Screen
          name="CompanyReports"
          component={AnimatedCompanyReportsScreen}
          options={{
            tabBarLabel: 'Reports',
          }}
        />
        <Tab.Screen
          name="AddCompanyTransaction"
          component={AnimatedAddCompanyTransactionScreen}
          options={{
            tabBarLabel: 'Add',
          }}
        />
        <Tab.Screen
          name="TeamManagement"
          component={AnimatedTeamManagementScreen}
          options={{
            tabBarLabel: 'Team',
          }}
        />
        <Tab.Screen
          name="CompanyBudget"
          component={AnimatedCompanyBudgetScreen}
          options={{
            tabBarLabel: 'Budget',
          }}
        />
      </Tab.Navigator>
    </View>
  );
}