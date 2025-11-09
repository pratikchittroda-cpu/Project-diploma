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
  SafeAreaView,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';


const { width, height } = Dimensions.get('window');

export default function SignUpScreen({ navigation, route }) {
  const { theme, isLoading: themeLoading } = useTheme();
  const { signUp } = useAuth();
  const testData = route?.params?.testData;
  
  const [fullName, setFullName] = useState(testData?.fullName || '');
  const [email, setEmail] = useState(testData?.email || '');
  const [password, setPassword] = useState(testData?.password || '');
  const [confirmPassword, setConfirmPassword] = useState(testData?.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    console.log('SignUp button pressed');
    
    if (!fullName || !email || !password || !confirmPassword) {
      console.log('Missing fields');
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      console.log('Passwords do not match');
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      console.log('Password too short');
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    console.log('Starting signup process...');
    setIsLoading(true);
    
    try {
      const result = await signUp(email, password, {
        fullName,
        userType: 'personal',
        profileComplete: false
      });
      
      console.log('Signup result:', result);
      
      if (result.success) {
        Alert.alert('Success!', 'Account created successfully. You are now signed in!', [
          { text: 'OK', onPress: () => navigation.replace('Dashboard') }
        ]);
      } else {
        Alert.alert('Sign Up Failed', result.error || 'Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Sign Up Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = () => {
    navigation.goBack();
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
          <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
            <Icon name="finance" size={60} color="white" />
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
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.primary,
  },
  scrollView: {
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
    paddingTop: Math.max(StatusBar.currentHeight || 0, 40) + 20,
    paddingBottom: Math.max(height * 0.02, 15),
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: Math.min(80, width * 0.2),
    height: Math.min(80, width * 0.2),
    borderRadius: Math.min(40, width * 0.1),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: Math.min(24, width * 0.06),
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: Math.min(14, width * 0.035),
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
    paddingTop: 25,
    paddingBottom: 30,
    minHeight: height * 0.7,
  },
  formContent: {
    paddingBottom: 80,
  },
  welcomeText: {
    fontSize: Math.min(24, width * 0.06),
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Math.min(16, width * 0.04),
    color: theme.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 15,
    height: Math.max(50, height * 0.065),
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
  signUpButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 20,
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  gradientButton: {
    paddingVertical: 15,
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
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
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
});