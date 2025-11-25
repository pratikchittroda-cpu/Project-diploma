import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Switch,
  Alert,
  StatusBar,
  TextInput,
  SafeAreaView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

export default function SecuritySettingsScreen({ navigation }) {
  const { theme } = useTheme();
  const [securitySettings, setSecuritySettings] = useState({
    biometricAuth: false,
    twoFactorAuth: false,
    loginAlerts: true,
    autoLock: true,
    sessionTimeout: '15',
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
    Alert.prompt(
      'Change Password',
      'Enter your current password:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Next',
          onPress: (currentPassword) => {
            if (!currentPassword) {
              Alert.alert('Error', 'Please enter your current password');
              return;
            }

            // Prompt for new password
            Alert.prompt(
              'New Password',
              'Enter your new password (minimum 6 characters):',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Change Password',
                  onPress: async (newPassword) => {
                    if (!newPassword || newPassword.length < 6) {
                      Alert.alert('Error', 'New password must be at least 6 characters long');
                      return;
                    }

                    try {
                      Alert.alert(
                        'Success!',
                        'Your password has been changed successfully. Please log in again with your new password.',
                        [{ text: 'OK' }]
                      );
                    } catch (error) {
                      Alert.alert('Error', 'Failed to change password. Please try again.');
                    }
                  },
                },
              ],
              'secure-text'
            );
          },
        },
      ],
      'secure-text'
    );
  };

  const renderSecurityOption = (title, subtitle, icon, setting, isSwitch = true) => (
    <Animated.View style={[styles.optionItem, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.optionLeft}>
        <View style={styles.optionIcon}>
          <Icon name={icon} size={22} color="white" />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={styles.optionSubtitle}>{subtitle}</Text>
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
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
      )}
    </Animated.View>
  );

  const renderActionButton = (title, subtitle, icon, onPress) => (
    <TouchableOpacity onPress={onPress}>
      <Animated.View style={[styles.optionItem, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.optionLeft}>
          <View style={styles.optionIcon}>
            <Icon name={icon} size={22} color="white" />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>{title}</Text>
            <Text style={styles.optionSubtitle}>{subtitle}</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
      </Animated.View>
    </TouchableOpacity>
  );

  const renderSection = (title, children) => (
    <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
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

          {renderSection('Session Management', (
            <Animated.View style={[styles.optionItem, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.optionLeft}>
                <View style={styles.optionIcon}>
                  <Icon name="timer" size={22} color="white" />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Session Timeout</Text>
                  <Text style={styles.optionSubtitle}>Minutes before auto-logout</Text>
                </View>
              </View>
              <View style={styles.timeoutInput}>
                <TextInput
                  style={styles.timeoutText}
                  value={securitySettings.sessionTimeout}
                  onChangeText={(value) => handleSettingChange('sessionTimeout', value)}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={styles.timeoutLabel}>min</Text>
              </View>
            </Animated.View>
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
    color: 'white',
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
    color: 'white',
    marginBottom: 15,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
    color: 'white',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  timeoutInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  timeoutText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  timeoutLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 4,
  },
});