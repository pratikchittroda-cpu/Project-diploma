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
  SafeAreaView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

export default function SettingsScreen({ navigation }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [settings, setSettings] = useState({
    notifications: true,
    emailReports: true,
    biometricAuth: false,
    autoBackup: true,
    soundEffects: true,
    hapticFeedback: true,
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
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
  }, []);

  const handleSettingChange = (setting, value) => {
    setSettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setSettings({
              notifications: true,
              emailReports: true,
              biometricAuth: false,
              autoBackup: true,
              soundEffects: true,
              hapticFeedback: true,
            });
            Alert.alert('Settings Reset', 'All settings have been reset to default values.');
          }
        }
      ]
    );
  };

  const renderSettingItem = (title, subtitle, icon, setting) => (
    <Animated.View style={[styles.settingItem, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Icon name={icon} size={22} color="white" />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={settings[setting]}
        onValueChange={(value) => handleSettingChange(setting, value)}
        trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(255,255,255,0.5)' }}
        thumbColor={settings[setting] ? '#fff' : '#f4f3f4'}
      />
    </Animated.View>
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
          <Text style={styles.headerTitle}>Settings</Text>
          <TouchableOpacity style={styles.resetButton} onPress={handleResetSettings}>
            <Icon name="refresh" size={24} color="white" />
          </TouchableOpacity>
        </Animated.View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {renderSection('Notifications', (
            <>
              {renderSettingItem(
                'Push Notifications',
                'Receive alerts for transactions and updates',
                'bell',
                'notifications'
              )}
              {renderSettingItem(
                'Email Reports',
                'Get weekly and monthly financial reports',
                'email-newsletter',
                'emailReports'
              )}
            </>
          ))}

          {renderSection('Security', (
            <>
              {renderSettingItem(
                'Biometric Authentication',
                'Use fingerprint or face ID to unlock',
                'fingerprint',
                'biometricAuth'
              )}
              {renderSettingItem(
                'Auto Backup',
                'Automatically backup data to cloud',
                'backup-restore',
                'autoBackup'
              )}
            </>
          ))}

          {renderSection('Experience', (
            <>
              {renderSettingItem(
                'Sound Effects',
                'Play sounds for app interactions',
                'volume-high',
                'soundEffects'
              )}
              {renderSettingItem(
                'Haptic Feedback',
                'Vibrate on button presses and gestures',
                'vibrate',
                'hapticFeedback'
              )}
            </>
          ))}

          {renderSection('Appearance', (
            <Animated.View style={[styles.settingItem, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Icon name="theme-light-dark" size={22} color="white" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Dark Mode</Text>
                  <Text style={styles.settingSubtitle}>Switch between light and dark themes</Text>
                </View>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(255,255,255,0.5)' }}
                thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
              />
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
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
  settingItem: {
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
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
});