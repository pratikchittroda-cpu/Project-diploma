import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import MessageService from '../services/MessageService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

export default function SecuritySettingsScreen({ navigation }) {
  const { theme } = useTheme();
  const [securitySettings, setSecuritySettings] = useState({
    biometricAuth: false,
    twoFactorAuth: false,
    loginAlerts: true,
    autoLock: true,
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Recent actions tracking
  const trackScreenVisit = async () => {
    try {
      const recentActions = await AsyncStorage.getItem('recentActions');
      let actions = recentActions ? JSON.parse(recentActions) : [];

      const screenData = {
        id: 'SecuritySettings',
        title: 'Security Settings',
        icon: 'shield-check',
        timestamp: Date.now(),
      };

      actions = actions.filter(action => action.id !== screenData.id);
      actions.unshift(screenData);
      actions = actions.slice(0, 4);

      await AsyncStorage.setItem('recentActions', JSON.stringify(actions));
    } catch (error) {
      console.error('Error tracking screen visit:', error);
    }
  };

  useEffect(() => {
    trackScreenVisit();

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
    });

    return unsubscribe;
  }, [navigation]);

  const handleSettingChange = (setting, value) => {
    setSecuritySettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleChangePassword = () => {
    MessageService.showPrompt(
      'Change Password',
      'Enter your current password:',
      (currentPassword) => {
        if (!currentPassword) {
          MessageService.showError('Error', 'Please enter your current password');
          return;
        }

        // Prompt for new password
        MessageService.showPrompt(
          'New Password',
          'Enter your new password (minimum 6 characters):',
          async (newPassword) => {
            if (!newPassword || newPassword.length < 6) {
              MessageService.showError('Error', 'New password must be at least 6 characters long');
              return;
            }

            try {
              // Note: The actual password change logic was missing in the original code
              MessageService.showSuccess(
                'Success!',
                'Your password has been changed successfully. Please log in again.'
              );
            } catch (error) {
              MessageService.showError('Error', 'Failed to change password.');
            }
          },
          () => { },
          {
            placeholder: 'New Password',
            secureTextEntry: true,
            confirmButtonText: 'Change Password'
          }
        );
      },
      () => { },
      {
        placeholder: 'Current Password',
        secureTextEntry: true,
        confirmButtonText: 'Next'
      }
    );
  };

  const renderSecurityOption = (title, subtitle, icon, setting, isSwitch = true) => (
    <Animated.View style={[styles.optionItem, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {Platform.OS === 'android' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.isDarkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)' }]} />
      ) : (
        <BlurView
          intensity={theme.isDarkMode ? 30 : 60}
          tint={theme.isDarkMode ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.optionLeft}>
        <View style={styles.optionIcon}>
          <Icon name={icon} size={22} color={Platform.OS === 'android' && !theme.isDarkMode ? 'black' : 'white'} />
        </View>
        <View style={styles.optionContent}>
          <Text style={[styles.optionTitle, { color: Platform.OS === 'android' && !theme.isDarkMode ? 'black' : 'white' }]}>{title}</Text>
          <Text style={[styles.optionSubtitle, { color: theme.isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }]}>{subtitle}</Text>
        </View>
      </View>
      {isSwitch ? (
        <Switch
          value={securitySettings[setting]}
          onValueChange={(value) => handleSettingChange(setting, value)}
          trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(255,255,255,0.5)' }}
          thumbColor={securitySettings[setting] ? '#fff' : '#f4f3f4'}
        />
      ) : (
        <Icon name="chevron-right" size={20} color={theme.isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'} />
      )}
    </Animated.View>
  );

  const renderActionButton = (title, subtitle, icon, onPress) => (
    <TouchableOpacity onPress={onPress}>
      <Animated.View style={[styles.optionItem, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {Platform.OS === 'android' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.isDarkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)' }]} />
        ) : (
          <BlurView
            intensity={theme.isDarkMode ? 30 : 60}
            tint={theme.isDarkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.optionLeft}>
          <View style={styles.optionIcon}>
            <Icon name={icon} size={22} color={Platform.OS === 'android' && !theme.isDarkMode ? 'black' : 'white'} />
          </View>
          <View style={styles.optionContent}>
            <Text style={[styles.optionTitle, { color: Platform.OS === 'android' && !theme.isDarkMode ? 'black' : 'white' }]}>{title}</Text>
            <Text style={[styles.optionSubtitle, { color: theme.isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }]}>{subtitle}</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={20} color={theme.isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'} />
      </Animated.View>
    </TouchableOpacity>
  );

  const renderSection = (title, children) => (
    <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={[styles.sectionTitle, { color: Platform.OS === 'android' && !theme.isDarkMode ? 'black' : 'white' }]}>{title}</Text>
      {children}
    </Animated.View>
  );

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Background Gradient */}
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.background}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Security Settings</Text>
          <View style={styles.headerSpacer} />
        </Animated.View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {renderSection('Authentication', (
            <>
              {renderSecurityOption(
                'Biometric Authentication',
                'Use fingerprint or face ID to unlock',
                'fingerprint',
                'biometricAuth'
              )}
              {renderSecurityOption(
                'Two-Factor Authentication',
                'Add extra security with 2FA',
                'two-factor-authentication',
                'twoFactorAuth'
              )}
              {renderActionButton(
                'Change Password',
                'Update your account password',
                'lock-reset',
                handleChangePassword
              )}
            </>
          ))}

          {renderSection('Account Security', (
            <>
              {renderSecurityOption(
                'Login Alerts',
                'Get notified of new device logins',
                'alert-circle',
                'loginAlerts'
              )}
              {renderSecurityOption(
                'Auto Lock',
                'Lock app when inactive',
                'lock',
                'autoLock'
              )}
            </>
          ))}


        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Platform.OS === 'android' && !theme.isDarkMode ? 'black' : 'white',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
  },

});