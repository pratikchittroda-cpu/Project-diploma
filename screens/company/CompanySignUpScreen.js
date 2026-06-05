import { useState, useRef, useEffect, useMemo } from 'react';
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
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import MessageService from '../../services/MessageService';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import * as Google from 'expo-auth-session/providers/google';
import { getGoogleAuthSetup, hasValidGoogleClientId } from '../../utils/googleAuth';

const { width, height } = Dimensions.get('window');

export default function CompanySignUpScreen({ navigation }) {
  const { theme, isLoading: themeLoading } = useTheme();
  const { signUp, signInWithGoogle, loading: authLoading } = useAuth();
  const googleAuthSetup = getGoogleAuthSetup();
  const hasGoogleClientId = googleAuthSetup.isConfigured;
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
    contactPerson: '',
    phone: '',
    industry: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Google Auth Request
  const [request, response, promptAsync] = Google.useAuthRequest(googleAuthSetup.requestConfig);
  const isGoogleRequestReady = hasValidGoogleClientId(request);

  useEffect(() => {
    if (request) {
      console.log('[GoogleAuth][Company SignUp] Request URL', request.url);
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
      const result = await signInWithGoogle(idToken, 'company');
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

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const animateEntrance = () => {
      fadeAnim.setValue(0);
      slideAnim.setValue(15);
      logoScale.setValue(0.98);

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

    const unsubscribe = navigation.addListener('focus', () => {
      animateEntrance();
    });

    animateEntrance();
    return unsubscribe;
  }, [navigation]);

  if (themeLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <StatusBar backgroundColor="#f8f9fa" barStyle="dark-content" />
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { companyName, email, password, confirmPassword, contactPerson, phone } = formData;
    if (!companyName || !email || !password || !confirmPassword || !contactPerson || !phone) {
      MessageService.showError('Missing Fields', 'Please fill in all required fields');
      return false;
    }
    if (password !== confirmPassword) {
      MessageService.showError('Error', 'Passwords do not match');
      return false;
    }
    if (password.length < 6) {
      MessageService.showError('Error', 'Password must be at least 6 characters long');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      MessageService.showError('Error', 'Please enter a valid email address');
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      const additionalData = {
        userType: 'company',
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        phone: formData.phone,
        industry: formData.industry || 'Other',
        fullName: formData.contactPerson,
      };
      const result = await signUp(formData.email, formData.password, additionalData);
      if (result.success) {
        MessageService.showSuccess('Success!', 'Company account created successfully!', {
          onDismiss: () => navigation.replace('CompanyDashboard')
        });
      } else {
        MessageService.showError('Registration Failed', result.error || 'Failed to create account');
      }
    } catch (error) {
      MessageService.showError('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={theme.primary} barStyle="light-content" translucent={true} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
                <Text style={styles.tagline}>Join thousands of businesses</Text>
              </Animated.View>

              {/* Registration Form */}
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
                  <Text style={styles.subtitle}>Start managing your business finances</Text>

                  {/* Company Name Input */}
                  <View style={styles.inputContainer}>
                    <Icon name="office-building-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Company Name *"
                      placeholderTextColor={theme.placeholderText}
                      value={formData.companyName}
                      onChangeText={(value) => updateFormData('companyName', value)}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>

                  {/* Email Input */}
                  <View style={styles.inputContainer}>
                    <Icon name="email-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Company Email *"
                      placeholderTextColor={theme.placeholderText}
                      value={formData.email}
                      onChangeText={(value) => updateFormData('email', value)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>

                  {/* Contact Person Input */}
                  <View style={styles.inputContainer}>
                    <Icon name="account-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Contact Person *"
                      placeholderTextColor={theme.placeholderText}
                      value={formData.contactPerson}
                      onChangeText={(value) => updateFormData('contactPerson', value)}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>

                  {/* Phone Input */}
                  <View style={styles.inputContainer}>
                    <Icon name="phone-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Phone Number *"
                      placeholderTextColor={theme.placeholderText}
                      value={formData.phone}
                      onChangeText={(value) => updateFormData('phone', value)}
                      keyboardType="phone-pad"
                      returnKeyType="next"
                    />
                  </View>

                  {/* Industry Input */}
                  <View style={styles.inputContainer}>
                    <Icon name="domain" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Industry (Optional)"
                      placeholderTextColor={theme.placeholderText}
                      value={formData.industry}
                      onChangeText={(value) => updateFormData('industry', value)}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>

                  {/* Password Input */}
                  <View style={styles.inputContainer}>
                    <Icon name="lock-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Password *"
                      placeholderTextColor={theme.placeholderText}
                      value={formData.password}
                      onChangeText={(value) => updateFormData('password', value)}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
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
                      placeholder="Confirm Password *"
                      placeholderTextColor={theme.placeholderText}
                      value={formData.confirmPassword}
                      onChangeText={(value) => updateFormData('confirmPassword', value)}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSignUp}
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
                    style={[styles.signupButton, (isLoading || authLoading) && styles.signupButtonDisabled]}
                    onPress={handleSignUp}
                    disabled={isLoading || authLoading}
                  >
                    <LinearGradient
                      colors={[theme.primary, theme.primaryLight]}
                      style={styles.gradientButton}
                    >
                      {(isLoading || authLoading) ? (
                        <Animated.View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                          <Text style={styles.signupButtonText}>Creating Account...</Text>
                        </Animated.View>
                      ) : (
                        <Text style={styles.signupButtonText}>Create Account</Text>
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

                  {/* Login Link */}
                  <View style={styles.loginContainer}>
                    <Text style={styles.loginText}>Already have a company account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('CompanyLogin')}>
                      <Text style={styles.loginLink}>Sign In</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </LinearGradient>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 30,
    paddingTop: 40,
    paddingBottom: 40,
    minHeight: height * 0.7,
  },
  formContent: {
    paddingBottom: 200,
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
    borderWidth: 0,
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
  signupButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    marginTop: 10,
  },
  signupButtonDisabled: {
    opacity: 0.7,
  },
  gradientButton: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupButtonText: {
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
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  loginLink: {
    color: theme.linkColor,
    fontSize: 14,
    fontWeight: 'bold',
  },
  socialButton: {
    marginTop: 10,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.divider,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
});
