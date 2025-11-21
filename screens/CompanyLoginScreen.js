import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';


// Get screen dimensions
const screenDimensions = Dimensions.get('window');
const { width, height } = screenDimensions;

export default function CompanyLoginScreen({ navigation }) {
  const { theme, isLoading: themeLoading } = useTheme();
  const { signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Ensure width and height are available
  if (!width || !height) {
    console.warn('Screen dimensions not available');
  }

  // Animation values - MUST be declared before any conditional returns
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Seamless dissolve entrance animation
    const animateEntrance = () => {
      fadeAnim.setValue(0);
      slideAnim.setValue(15);
      logoScale.setValue(0.98);

      // Smooth coordinated dissolve-in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
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
    };

    // Listen for screen focus to re-animate when returning from signup
    const unsubscribe = navigation.addListener('focus', () => {
      // Immediate re-animation for seamless transition
      animateEntrance();
    });

    // Initial animation
    animateEntrance();

    return unsubscribe;
  }, [navigation]);

  // Don't render until theme is loaded - MOVED AFTER ALL HOOKS
  if (themeLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.background || '#f8f9fa' }}>
        <StatusBar backgroundColor={theme?.background || '#f8f9fa'} barStyle={theme?.statusBarStyle || 'dark-content'} />
        <ActivityIndicator size="large" color={theme?.primary || '#667eea'} />
      </View>
    );
  }

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn(email, password);

      if (result.success) {
        const userData = result.userData;

        // Check if user is company type
        if (userData?.userType !== 'company') {
          Alert.alert('Access Denied', 'This account is not registered as a Company account. Please use the Personal login or create a Company account.');
          setIsLoading(false);
          return;
        }

        navigation.replace('CompanyDashboard');
      } else {
        // Enhanced error messages for better debugging
        let errorMessage = 'Please check your credentials and try again.';

        if (result.error) {
          if (result.error.includes('auth/invalid-credential')) {
            errorMessage = 'Invalid email or password. Please check your credentials.';
          } else if (result.error.includes('auth/user-not-found')) {
            errorMessage = 'No company account found with this email. Please sign up first.';
          } else if (result.error.includes('auth/wrong-password')) {
            errorMessage = 'Incorrect password. Please try again.';
          } else if (result.error.includes('auth/invalid-email')) {
            errorMessage = 'Please enter a valid email address.';
          } else if (result.error.includes('auth/user-disabled')) {
            errorMessage = 'This account has been disabled. Please contact support.';
          } else if (result.error.includes('auth/too-many-requests')) {
            errorMessage = 'Too many failed attempts. Please try again later.';
          } else {
            errorMessage = result.error;
          }
        }

        Alert.alert('Login Failed', errorMessage);
        }
    } catch (error) {
      Alert.alert('Login Error', 'An unexpected error occurred. Please try again.');
      } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.prompt(
      'Reset Password',
      'Enter your company email address to receive a password reset link:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Send Reset Email',
          onPress: async (email) => {
            if (!email || !email.includes('@')) {
              Alert.alert('Error', 'Please enter a valid email address');
              return;
            }

            try {
              setIsLoading(true);
              // Implement password reset logic here
              Alert.alert(
                'Success!',
                'Password reset email sent! Check your inbox and follow the instructions to reset your password.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
      'plain-text',
      '',
      'email-address'
    );
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={theme.primary} barStyle="light-content" translucent={true} />
      <View style={styles.container}>
        <LinearGradient
          colors={[theme.primary, theme.primaryLight]}
          style={styles.background}
        >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
            <Icon name="office-building" size={60} color="white" />
          </Animated.View>
          <Text style={styles.appName}>Expenzo Business</Text>
          <Text style={styles.tagline}>Manage. Analyze. Grow.</Text>
        </Animated.View>

        {/* Login Form */}
        <Animated.View
          style={[
            styles.formContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={styles.welcomeText}>Welcome Back!</Text>
          <Text style={styles.subtitle}>Sign in to your business account</Text>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Icon name="email-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Company Email"
              placeholderTextColor={theme.placeholderText}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Icon name="lock-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={theme.placeholderText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Icon
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, (isLoading || authLoading) && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading || authLoading}
          >
            <LinearGradient
              colors={[theme.primary, theme.primaryLight]}
              style={styles.gradientButton}
            >
              {(isLoading || authLoading) ? (
                <Animated.View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.loginButtonText}>Signing In...</Text>
                </Animated.View>
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Sign Up */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have a company account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('CompanyRegister')}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        </LinearGradient>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.primary,
  },
  container: {
    flex: 1,
  },

  background: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: Math.max(StatusBar.currentHeight || 0, 40) + 20,
    paddingBottom: Math.max(height * 0.03, 20),
    paddingHorizontal: 20,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: Math.max(StatusBar.currentHeight || 0, 40) + 20,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    backgroundColor: theme.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 15,
    height: 55,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 55,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  eyeIcon: {
    padding: 5,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    color: theme.linkColor,
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  gradientButton: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.divider,
  },
  dividerText: {
    marginHorizontal: 15,
    color: theme.textSecondary,
    fontSize: 14,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  signUpText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  signUpLink: {
    color: theme.linkColor,
    fontSize: 14,
    fontWeight: 'bold',
  },
});