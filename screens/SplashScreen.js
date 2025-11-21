import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  Easing,
  Dimensions,
  TouchableWithoutFeedback,
  SafeAreaView,
  Image,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');
const DURATION = 3500;

const currencyIcons = [
  'currency-usd', 'currency-eur', 'currency-btc', 'currency-gbp', 'currency-inr', 'currency-jpy', 'currency-cny', 'currency-eth'
];

export default function SplashScreen({ navigation }) {
  const { theme, isLoading: themeLoading } = useTheme();
  const { user, userData, initializing } = useAuth();
  
  // Animation values
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.9)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const bgRotate = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const globalAnim = useRef(new Animated.Value(0)).current;

  // Don't render until theme is loaded
  if (themeLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4A6CF7', paddingTop: StatusBar.currentHeight || 0 }}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  // Animation sequence
  useEffect(() => {
    // Background rotation
    Animated.loop(
      Animated.timing(bgRotate, {
        toValue: 1,
        duration: DURATION * 4,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();

    // Wave animation
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: DURATION,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();

    // Global animation driver
    Animated.loop(
      Animated.timing(globalAnim, {
        toValue: 1,
        duration: DURATION,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();

    // Logo animation
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 60,
        delay: 300,
        useNativeDriver: true
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true
      })
    ]).start();

    // Title animation
    Animated.parallel([
      Animated.spring(titleScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        delay: 600,
        useNativeDriver: true
      }),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 1000,
        delay: 600,
        useNativeDriver: true
      })
    ]).start();

    // Auto navigation after animation completes
    const timer = setTimeout(() => {
      handleNavigation();
    }, DURATION);

    return () => clearTimeout(timer);
  }, [user, userData, initializing]);

  // Handle authentication state changes during splash screen
  useEffect(() => {
    // If authentication state changes and we have complete data, navigate immediately
    if (!initializing && user && userData) {
      const quickTimer = setTimeout(() => {
        if (userData.userType === 'company') {
          navigation.replace('CompanyDashboard');
        } else {
          navigation.replace('Dashboard');
        }
      }, 1000); // Small delay to ensure smooth transition

      return () => clearTimeout(quickTimer);
    }
  }, [user, userData, initializing, navigation]);

  // Handle navigation based on authentication state
  const handleNavigation = () => {
    // If still initializing, wait a bit more
    if (initializing) {
      setTimeout(() => handleNavigation(), 500);
      return;
    }

    // If user is authenticated and userData is available
    if (user && userData) {
      if (userData.userType === 'company') {
        navigation.replace('CompanyDashboard');
      } else {
        navigation.replace('Dashboard');
      }
      return;
    }

    // If user is authenticated but userData is not yet loaded
    if (user && !userData) {
      // Wait a bit more for userData to load
      setTimeout(() => {
        if (userData) {
          if (userData.userType === 'company') {
            navigation.replace('CompanyDashboard');
          } else {
            navigation.replace('Dashboard');
          }
        } else {
          // If userData still not available, go to user type selection
          navigation.replace('UserType');
        }
      }, 1000);
      return;
    }

    // If no user is authenticated, go to user type selection
    navigation.replace('UserType');
  };

  // Background rotation interpolation
  const bgInterpolate = bgRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // Wave animation interpolation
  const waveInterpolate = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -width]
  });

  // Create floating currency icons with beautiful animations
  const floatingCurrencies = (() => {
    const positions = [];
    const minSpacing = 100; // Further increased spacing for maximum spread
    
    return currencyIcons.map((icon, index) => {
      let x, y, attempts = 0;
      const randomSize = Math.random() * 16 + 28; // Size between 28-44, slightly larger
      
      // Create grid distribution with bottom row for extra currencies
      let gridCols, gridRows, col, row;
      
      if (index < 6) {
        // First 6 currencies in 2x3 grid
        gridCols = 2;
        gridRows = 3;
        col = index % gridCols;
        row = Math.floor(index / gridCols);
        
        const cellWidth = (width - 80) / gridCols;
        const cellHeight = (height - 450) / gridRows; // Leave more space for bottom currencies
        
        x = col * cellWidth + Math.random() * (cellWidth - 40) + 40;
        y = row * cellHeight + Math.random() * (cellHeight - 40) + 100;
      } else {
        // Last 2 currencies at the bottom
        const bottomIndex = index - 6;
        const bottomCols = 2;
        const bottomCellWidth = (width - 120) / bottomCols; // More spacing for bottom row
        
        col = bottomIndex % bottomCols;
        x = col * bottomCellWidth + Math.random() * (bottomCellWidth - 60) + 60;
        y = height - 200 + Math.random() * 80; // Bottom area with some randomness
      }
      
      // No spacing check needed with grid positioning
      
      positions.push({ x, y, size: randomSize });
    
    // Create unique animations for each icon
    const floatAnim = globalAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, -15, 0]
    });
    
    const rotateAnim = globalAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', `${index % 2 === 0 ? '360deg' : '-360deg'}`]
    });
    
    const scaleAnim = globalAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 1.2, 1]
    });
    
    const opacityAnim = globalAnim.interpolate({
      inputRange: [0, 0.3, 0.7, 1],
      outputRange: [0.7, 1, 0.8, 0.7]
    });

    return (
      <Animated.View
        key={icon}
        style={[
          styles.floatingCurrency,
          {
            left: x - randomSize/2,
            top: y - randomSize/2,
            width: randomSize + 12,
            height: randomSize + 12,
            transform: [
              { translateY: floatAnim },
              { rotate: rotateAnim },
              { scale: scaleAnim }
            ],
            opacity: opacityAnim
          }
        ]}
      >
        <Icon 
          name={icon} 
          size={randomSize} 
          color="#fff" 
          style={styles.currencyIcon}
        />
      </Animated.View>
    );
  });
  })();

  // Wave path data
  const wavePath = `M0,60 Q${width/4},30 ${width/2},60 T${width},60 V120 H0 Z`;

  return (
    <TouchableWithoutFeedback onPress={() => {
      if (!initializing) {
        handleNavigation();
      }
    }}>
      <View style={styles.container}>
        {/* Animated Gradient Background */}
        <Animated.View style={[
          styles.background, 
          { 
            transform: [
              { rotate: bgInterpolate },
              { scale: 1.2 }
            ]
          }
        ]}>
          <LinearGradient
            colors={[theme.primary, theme.primaryLight, theme.primary]}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Animated Wave */}
        <Animated.View style={[
          styles.waveContainer,
          { transform: [{ translateX: waveInterpolate }] }
        ]}>
          <Svg width={width*2} height={120} style={styles.wave}>
            <Path 
              d={wavePath} 
              fill="rgba(255,255,255,0.15)" 
            />
          </Svg>
        </Animated.View>
        <Animated.View style={[
          styles.waveContainer,
          { 
            transform: [{ translateX: Animated.add(width, waveInterpolate) }],
            opacity: 0.8
          }
        ]}>
          <Svg width={width*2} height={120} style={styles.wave}>
            <Path 
              d={wavePath} 
              fill="rgba(255,255,255,0.1)" 
            />
          </Svg>
        </Animated.View>

        {/* Floating Currency Icons */}
        {floatingCurrencies}

        {/* Main Content */}
        <View style={styles.content}>
          <Animated.View style={[
            styles.logoContainer,
            { 
              transform: [{ scale: logoScale }],
              opacity: logoOpacity
            }
          ]}>
            <Icon name="wallet" size={80} color="#FFFFFF" />
          </Animated.View>

          <Animated.View style={[
            styles.titleContainer,
            {
              transform: [{ scale: titleScale }],
              opacity: titleOpacity
            }
          ]}>
            <Text style={styles.title}>Expenzo</Text>
            <Text style={styles.subtitle}>Smart Finance Management</Text>
          </Animated.View>
        </View>

        {/* Animated Loader */}
        <Animated.View style={[styles.footer, { opacity: titleOpacity }]}>
          <View style={styles.loader}>
            {[0, 1, 2].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.loaderDot,
                  {
                    transform: [{
                      translateY: globalAnim.interpolate({
                        inputRange: [0, 0.3, 0.6, 1],
                        outputRange: [0, -12, 0, 0],
                        extrapolate: 'clamp'
                      })
                    }],
                    backgroundColor: globalAnim.interpolate({
                      inputRange: [0, 0.3, 0.6, 1],
                      outputRange: ['#FFFFFF', '#FFD700', '#FFFFFF', '#FFFFFF'],
                      extrapolate: 'clamp'
                    })
                  }
                ]}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  background: {
    position: 'absolute',
    width: '150%',
    height: '150%',
    top: '-25%',
    left: '-25%'
  },
  gradient: {
    flex: 1
  },
  waveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0
  },
  wave: {
    position: 'absolute',
    bottom: 0
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 100,
    zIndex: 2
  },
  logoContainer: {
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10
  },
  logoImage: {
    width: 150,
    height: 150,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  titleContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 1.5,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1.5,
    fontWeight: '500'
  },
  floatingCurrency: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1
  },
  currencyIcon: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
    zIndex: 2
  },
  loader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loaderDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'white',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3
  }
});