import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import * as NativeSplashScreen from 'expo-splash-screen';

const DURATION = 1800;

export default function SplashScreen({ navigation }) {
  const { theme } = useTheme();
  const { user, userData, initializing } = useAuth();

  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(10)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.75)).current;
  const ringOpacity = useRef(new Animated.Value(0.55)).current;
  const orbDrift = useRef(new Animated.Value(0)).current;
  const didHideNativeSplash = useRef(false);

  const primary = theme?.primary || '#18b5be';
  const primaryLight = theme?.primaryLight || '#6dd5da';

  const navigateForUser = (authUserData) => {
    if (authUserData?.userType === 'company') {
      navigation.replace('CompanyDashboard');
    } else {
      navigation.replace('Dashboard');
    }
  };

  const handleNavigation = () => {
    if (initializing) {
      setTimeout(handleNavigation, 500);
      return;
    }

    if (user && userData) {
      navigateForUser(userData);
      return;
    }

    if (user && !userData) {
      setTimeout(() => {
        if (userData) {
          navigateForUser(userData);
        } else {
          navigation.replace('UserType');
        }
      }, 900);
      return;
    }

    navigation.replace('UserType');
  };

  useEffect(() => {
    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.2,
            duration: 1500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.08,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 0.75,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.55,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    const orbLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbDrift, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbDrift, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    ringLoop.start();
    orbLoop.start();

    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        delay: 180,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity, {
        toValue: 1,
        delay: 420,
        duration: 550,
        useNativeDriver: true,
      }),
      Animated.spring(titleY, {
        toValue: 0,
        delay: 420,
        friction: 8,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(handleNavigation, DURATION);

    return () => {
      clearTimeout(timer);
      ringLoop.stop();
      orbLoop.stop();
    };
  }, [user, userData, initializing]);

  useEffect(() => {
    if (!initializing && user && userData) {
      const quickTimer = setTimeout(() => navigateForUser(userData), 750);
      return () => clearTimeout(quickTimer);
    }
  }, [user, userData, initializing, navigation]);

  const orbTranslateY = orbDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -16],
  });

  const orbTranslateX = orbDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        if (!initializing) {
          handleNavigation();
        }
      }}
    >
      <View
        style={styles.container}
        onLayout={() => {
          if (didHideNativeSplash.current) return;
          didHideNativeSplash.current = true;
          NativeSplashScreen.hideAsync().catch(() => {
            // Ignore hide races in reloads.
          });
        }}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

        <LinearGradient
          colors={[primaryLight, primary, '#1f2937']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.background}
        />

        <Animated.View
          style={[
            styles.orbTop,
            {
              transform: [{ translateY: orbTranslateY }, { translateX: orbTranslateX }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.orbBottom,
            {
              transform: [{ translateY: Animated.multiply(orbTranslateY, -1) }],
            },
          ]}
        />

        <View style={styles.centerWrap}>
          <View style={styles.logoWrap}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  opacity: ringOpacity,
                  transform: [{ scale: ringScale }],
                },
              ]}
            />

            <Animated.View
              style={[
                styles.logoBadge,
                {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <Image
                source={require('../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleY }],
              alignItems: 'center',
            }}
          >
            <Text style={styles.title}>Expenzo</Text>
            <Text style={styles.subtitle}>Smart Finance Management</Text>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.95)" />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4A6CF7',
    paddingTop: StatusBar.currentHeight || 0,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  orbTop: {
    position: 'absolute',
    top: -90,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  orbBottom: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  pulseRing: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  logoBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  logoImage: {
    width: 74,
    height: 74,
  },
  title: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  subtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    letterSpacing: 1.1,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
