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

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.headerGradient}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity style={styles.resetButton} onPress={handleResetSettings}>
          <Icon name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );

  const renderSettingItem = (title, subtitle, icon, setting, iconColor, backgroundColor) => (
    <Animated.View style={[styles.settingItem, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor }]}>
          <Icon name={icon} size={22} color={iconColor} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={settings[setting]}
        onValueChange={(value) => handleSettingChange(setting, value)}
        trackColor={{ false: theme.textLight, true: theme.primary }}
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
      {renderHeader()}
      
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
              'notifications',
              theme.info,
              theme.iconBackground.blue
            )}
            {renderSettingItem(
              'Email Reports',
              'Get weekly and monthly financial reports',
              'email-newsletter',
              'emailReports',
              theme.success,
              theme.iconBackground.green
            )}
          </>
        ))}

        {renderSection('Security', (
          <>
            {renderSettingItem(
              'Biometric Authentication',
              'Use fingerprint or face ID to unlock',
              'fingerprint',
              'biometricAuth',
              '#9C27B0',
              theme.iconBackground.purple
            )}
            {renderSettingItem(
              'Auto Backup',
              'Automatically backup data to cloud',
              'backup-restore',
              'autoBackup',
              theme.warning,
              theme.iconBackground.orange
            )}
          </>
        ))}

        {renderSection('Experience', (
          <>
            {renderSettingItem(
              'Sound Effects',
              'Play sounds for app interactions',
              'volume-high',
              'soundEffects',
              theme.info,
              theme.iconBackground.blue
            )}
            {renderSettingItem(
              'Haptic Feedback',
              'Vibrate on button presses and gestures',
              'vibrate',
              'hapticFeedback',
              theme.success,
              theme.iconBackground.green
            )}
          </>
        ))}

        {renderSection('Appearance', (
          <Animated.View style={[styles.settingItem, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: theme.iconBackground.gray }]}>
                <Icon name="theme-light-dark" size={22} color={theme.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Dark Mode</Text>
                <Text style={styles.settingSubtitle}>Switch between light and dark themes</Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.textLight, true: theme.primary }}
              thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
            />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerGradient: {
    paddingTop: (StatusBar.currentHeight || 0) + 15,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    color: theme.text,
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    elevation: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: theme.divider,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});