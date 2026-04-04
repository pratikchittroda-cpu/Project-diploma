import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import MessageService from '../services/MessageService';
import * as Google from 'expo-auth-session/providers/google';
import { getGoogleAuthSetup, hasValidGoogleClientId } from '../utils/googleAuth';


const { width, height } = Dimensions.get('window');

export default function SignUpScreen({ navigation, route }) {
  const { theme, isLoading: themeLoading } = useTheme();
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const googleAuthSetup = getGoogleAuthSetup();
  const hasGoogleClientId = googleAuthSetup.isConfigured;
  const testData = route?.params?.testData;

  const [fullName, setFullName] = useState(testData?.fullName || '');
  const [email, setEmail] = useState(testData?.email || '');
  const [password, setPassword] = useState(testData?.password || '');
  const [confirmPassword, setConfirmPassword] = useState(testData?.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithGoogle, loading: authLoading } = useAuth();

  // Google Auth Request
  const [request, response, promptAsync] = Google.useAuthRequest(googleAuthSetup.requestConfig);
  const isGoogleRequestReady = hasValidGoogleClientId(request);

  useEffect(() => {
    if (request) {
      console.log('[GoogleAuth][Personal SignUp] Request URL', request.url);
    }
  }, [request]);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token || response.authentication?.idToken;
      if (idToken) {
        handleGoogleLogin(idToken);
      } else {
        MessageService.showError('Google Error', 'Google sign-in did not return an ID token.');
      }
    } else if (response?.type === 'error') {
      MessageService.showError('Google Error', response.error?.message || 'Failed to sign in with Google');
    }
  }, [response]);

  const handleGoogleLogin = async (idToken) => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle(idToken, 'personal');
      if (result.success) {
        navigation.replace(result.userData?.userType === 'company' ? 'CompanyDashboard' : 'Dashboard');
      } else {
        MessageService.showError('Login Failed', result.error || 'Failed to sign in with Google');
      }
    } catch (error) {
      MessageService.showError('Login Error', 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render until theme is loaded
  if (themeLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Seamless dissolve entrance animation
    const animateEntrance = () => {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      logoScale.setValue(0.95);

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

    // Listen for screen focus to re-animate when returning
    const unsubscribe = navigation.addListener('focus', () => {
      // Small delay to let navigation fade complete
      const timer = setTimeout(animateEntrance, 100);
      return () => clearTimeout(timer);
    });

    // Initial animation with small delay for navigation fade
    const initialTimer = setTimeout(animateEntrance, 150);

    return () => {
      unsubscribe();
      clearTimeout(initialTimer);
    };
  }, [navigation]);

  const handleSignUp = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      MessageService.showError('Missing Fields', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      MessageService.showError('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      MessageService.showError('Error', 'Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp(email, password, {
        fullName,
        userType: 'personal',
        profileComplete: false
      });

      if (result.success) {
        MessageService.showSuccess('Success!', 'Account created successfully!', {
          onDismiss: () => navigation.replace('Dashboard')
        });
      } else {
        MessageService.showError('Sign Up Failed', result.error || 'Please try again.');
      }
    } catch (error) {
      MessageService.showError('Sign Up Error', 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = () => {
    navigation.goBack();
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar backgroundColor={theme.primary} barStyle="light-content" translucent={true} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.screenContent}>
          <LinearGradient
            colors={[theme.primary, theme.primaryLight]}
            style={styles.background}
          >
              {/* Header */}
              <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
                  <Icon name="finance" size={42} color="white" />
                </Animated.View>
                <Text style={styles.appName}>Expenzo</Text>
                <Text style={styles.tagline}>Track. Save. Succeed.</Text>
              </Animated.View>

              {/* Sign Up Form */}
              <Animated.View
                style={[
                  styles.formContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <View style={styles.formContent}>
                  <Text style={styles.welcomeText}>Create Account</Text>
                  <Text style={styles.subtitle}>Sign up to get started</Text>

                  {/* Full Name Input */}
                  <View style={styles.inputContainer}>
                    <Icon name="account-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      placeholderTextColor={theme.placeholderText}
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>

                  {/* Email Input */}
                  <View style={styles.inputContainer}>
                    <Icon name="email-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor={theme.placeholderText}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
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

                  {/* Confirm Password Input */}
                  <View style={styles.inputContainer}>
                    <Icon name="lock-check-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor={theme.placeholderText}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeIcon}
                    >
                      <Icon
                        name={showConfirmPassword ? "eye-off" : "eye"}
                        size={20}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Sign Up Button */}
                  <TouchableOpacity
                    style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
                    onPress={handleSignUp}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={[theme.primary, theme.primaryLight]}
                      style={styles.gradientButton}
                    >
                      {isLoading ? (
                        <Animated.View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                          <Text style={styles.signUpButtonText}>Creating Account...</Text>
                        </Animated.View>
                      ) : (
                        <Text style={styles.signUpButtonText}>Sign Up</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Divider */}
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* Google Login Button */}
                  <TouchableOpacity
                    style={[styles.socialButton, (isLoading || authLoading) && styles.socialButtonDisabled]}
                    onPress={() => {
                      if (!hasGoogleClientId || !isGoogleRequestReady) {
                        const reason = googleAuthSetup.reason
                          ? ` ${googleAuthSetup.reason}.`
                          : '';
                        MessageService.showError('Google Config Error', `Google sign-in is not ready.${reason}`);
                        return;
                      }
                      promptAsync(googleAuthSetup.promptOptions);
                    }}
                    disabled={isLoading || authLoading}
                  >
                    <View style={styles.socialButtonContent}>
                      <Icon name="google" size={20} color={theme.text} style={styles.socialIcon} />
                      <Text style={styles.socialButtonText}>Continue with Google</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Sign In */}
                  <View style={styles.signInContainer}>
                    <Text style={styles.signInText}>Already have an account? </Text>
                    <TouchableOpacity onPress={handleSignIn}>
                      <Text style={styles.signInLink}>Sign In</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
      <View style={[styles.bottomInsetFill, { height: insets.bottom }]} />
    </SafeAreaView>
  );
}

const createStyles = (theme) => {
  const compact = height <= 850;

  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.primary,
  },
  screenContent: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: compact ? 18 : 34,
    paddingBottom: compact ? 8 : 14,
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: compact ? 60 : Math.min(80, width * 0.2),
    height: compact ? 60 : Math.min(80, width * 0.2),
    borderRadius: compact ? 30 : Math.min(40, width * 0.1),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: compact ? 8 : 12,
  },
  appName: {
    fontSize: compact ? 17 : Math.min(24, width * 0.06),
    fontWeight: 'bold',
    color: 'white',
    marginBottom: compact ? 2 : 5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: compact ? 11 : Math.min(14, width * 0.035),
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
    backgroundColor: theme.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: Math.max(20, width * 0.05),
    paddingTop: compact ? 14 : 25,
    paddingBottom: compact ? 12 : 24,
  },
  formContent: {
    paddingBottom: compact ? 6 : 20,
  },
  welcomeText: {
    fontSize: compact ? 16 : Math.min(24, width * 0.06),
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: compact ? 2 : 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: compact ? 14 : Math.min(16, width * 0.04),
    color: theme.textSecondary,
    marginBottom: compact ? 8 : 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    marginBottom: compact ? 8 : 12,
    paddingHorizontal: 15,
    height: compact ? 46 : Math.max(50, height * 0.065),
    borderWidth: 0,
    minHeight: compact ? 46 : 55,
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
  signUpButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: compact ? 6 : 10,
    marginBottom: compact ? 8 : 20,
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  gradientButton: {
    paddingVertical: compact ? 10 : 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpButtonText: {
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
    marginVertical: compact ? 8 : 20,
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
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: compact ? 6 : 10,
    marginBottom: compact ? 8 : 24,
  },
  signInText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  signInLink: {
    color: theme.linkColor,
    fontSize: 14,
    fontWeight: 'bold',
  },
  socialButton: {
    marginTop: compact ? 6 : 10,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.divider,
    height: compact ? 46 : 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: compact ? 6 : 20,
  },
  socialButtonDisabled: {
    opacity: 0.7,
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialIcon: {
    marginRight: 10,
  },
  socialButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomInsetFill: {
    backgroundColor: theme.surface,
  },
  });
};
