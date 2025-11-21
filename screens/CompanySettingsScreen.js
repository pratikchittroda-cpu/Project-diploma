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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

export default function CompanySettingsScreen({ navigation }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [companySettings, setCompanySettings] = useState({
    autoReports: true,
    employeeNotifications: true,
    budgetAlerts: true,
    expenseApproval: false,
    dataRetention: '12',
    backupFrequency: 'weekly',
    multiCurrency: false,
    auditLogging: true,
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Recent actions tracking
  const trackScreenVisit = async () => {
    try {
      const recentActions = await AsyncStorage.getItem('companyRecentActions');
      let actions = recentActions ? JSON.parse(recentActions) : [];
      
      const screenData = {
        id: 'CompanySettings',
        title: 'Company Settings',
        icon: 'cog',
        timestamp: Date.now(),
      };
      
      actions = actions.filter(action => action.id !== screenData.id);
      actions.unshift(screenData);
      actions = actions.slice(0, 4);
      
      await AsyncStorage.setItem('companyRecentActions', JSON.stringify(actions));
    } catch (error) {
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
    setCompanySettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Company Settings',
      'Are you sure you want to reset all company settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setCompanySettings({
              autoReports: true,
              employeeNotifications: true,
              budgetAlerts: true,
              expenseApproval: false,
              dataRetention: '12',
              backupFrequency: 'weekly',
              multiCurrency: false,
              auditLogging: true,
            });
            Alert.alert('Settings Reset', 'All company settings have been reset to default values.');
          }
        }
      ]
    );
  };

  const handleBackupFrequencyChange = () => {
    Alert.alert(
      'Backup Frequency',
      'How often should company data be backed up?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Daily', onPress: () => handleSettingChange('backupFrequency', 'daily') },
        { text: 'Weekly', onPress: () => handleSettingChange('backupFrequency', 'weekly') },
        { text: 'Monthly', onPress: () => handleSettingChange('backupFrequency', 'monthly') },
      ]
    );
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.headerGradient}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Company Settings</Text>
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
        value={companySettings[setting]}
        onValueChange={(value) => handleSettingChange(setting, value)}
        trackColor={{ false: theme.textLight, true: theme.primary }}
        thumbColor={companySettings[setting] ? '#fff' : '#f4f3f4'}
      />
    </Animated.View>
  );

  const renderActionItem = (title, subtitle, icon, onPress, iconColor, backgroundColor, value = null) => (
    <TouchableOpacity onPress={onPress}>
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
        <View style={styles.settingRight}>
          {value && <Text style={styles.settingValue}>{value}</Text>}
          <Icon name="chevron-right" size={20} color={theme.textLight} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );

  const renderInputItem = (title, subtitle, icon, setting, iconColor, backgroundColor, suffix = '') => (
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
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.inputText}
          value={companySettings[setting]}
          onChangeText={(value) => handleSettingChange(setting, value)}
          keyboardType="numeric"
          maxLength={3}
        />
        <Text style={styles.inputSuffix}>{suffix}</Text>
      </View>
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
        {renderSection('Financial Management', (
          <>
            {renderSettingItem(
              'Automatic Reports',
              'Generate monthly financial reports automatically',
              'file-chart',
              'autoReports',
              theme.info,
              theme.iconBackground.blue
            )}
            {renderSettingItem(
              'Budget Alerts',
              'Notify when budgets exceed thresholds',
              'alert-circle',
              'budgetAlerts',
              theme.warning,
              theme.iconBackground.orange
            )}
            {renderSettingItem(
              'Expense Approval',
              'Require approval for large expenses',
              'check-circle',
              'expenseApproval',
              theme.success,
              theme.iconBackground.green
            )}
            {renderSettingItem(
              'Multi-Currency Support',
              'Enable multiple currency transactions',
              'currency-usd',
              'multiCurrency',
              '#9C27B0',
              theme.iconBackground.purple
            )}
          </>
        ))}

        {renderSection('Team & Notifications', (
          <>
            {renderSettingItem(
              'Employee Notifications',
              'Send notifications to team members',
              'account-group',
              'employeeNotifications',
              theme.success,
              theme.iconBackground.green
            )}
            {renderSettingItem(
              'Audit Logging',
              'Track all financial activities',
              'history',
              'auditLogging',
              theme.textSecondary,
              theme.iconBackground.gray
            )}
          </>
        ))}

        {renderSection('Data Management', (
          <>
            {renderInputItem(
              'Data Retention',
              'Months to keep transaction data',
              'database',
              'dataRetention',
              theme.info,
              theme.iconBackground.blue,
              'months'
            )}
            {renderActionItem(
              'Backup Frequency',
              `Currently set to ${companySettings.backupFrequency}`,
              'backup-restore',
              handleBackupFrequencyChange,
              theme.warning,
              theme.iconBackground.orange,
              companySettings.backupFrequency
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
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    color: theme.textSecondary,
    marginRight: 8,
    textTransform: 'capitalize',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  inputText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  inputSuffix: {
    fontSize: 14,
    color: theme.textSecondary,
    marginLeft: 4,
  },
});