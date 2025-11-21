import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
  StatusBar,
  ProgressBarAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

export default function BackupRestoreScreen({ navigation }) {
  const { theme } = useTheme();
  const [backupInfo, setBackupInfo] = useState({
    lastBackup: '2024-01-15 14:30',
    backupSize: '2.4 MB',
    autoBackup: true,
    cloudProvider: 'Google Drive',
  });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Recent actions tracking
  const trackScreenVisit = async () => {
    try {
      const recentActions = await AsyncStorage.getItem('recentActions');
      let actions = recentActions ? JSON.parse(recentActions) : [];
      
      const screenData = {
        id: 'BackupRestore',
        title: 'Backup & Restore',
        icon: 'backup-restore',
        timestamp: Date.now(),
      };
      
      actions = actions.filter(action => action.id !== screenData.id);
      actions.unshift(screenData);
      actions = actions.slice(0, 4);
      
      await AsyncStorage.setItem('recentActions', JSON.stringify(actions));
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

  const handleBackupNow = () => {
    Alert.alert(
      'Create Backup',
      'This will backup all your financial data to the cloud. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Backup',
          onPress: () => {
            setIsBackingUp(true);
            // Simulate backup process
            setTimeout(() => {
              setIsBackingUp(false);
              setBackupInfo(prev => ({
                ...prev,
                lastBackup: new Date().toLocaleString(),
                backupSize: '2.6 MB',
              }));
              Alert.alert('Success', 'Backup completed successfully!');
            }, 3000);
          }
        }
      ]
    );
  };

  const handleRestoreBackup = () => {
    Alert.alert(
      'Restore from Backup',
      'This will replace all current data with your backup. This action cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            setIsRestoring(true);
            // Simulate restore process
            setTimeout(() => {
              setIsRestoring(false);
              Alert.alert('Success', 'Data restored successfully! Please restart the app.');
            }, 4000);
          }
        }
      ]
    );
  };

  const handleChangeCloudProvider = () => {
    Alert.alert(
      'Cloud Storage Provider',
      'Choose your preferred cloud storage service:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Google Drive', onPress: () => setBackupInfo(prev => ({ ...prev, cloudProvider: 'Google Drive' })) },
        { text: 'iCloud', onPress: () => setBackupInfo(prev => ({ ...prev, cloudProvider: 'iCloud' })) },
        { text: 'Dropbox', onPress: () => setBackupInfo(prev => ({ ...prev, cloudProvider: 'Dropbox' })) },
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
        <Text style={styles.headerTitle}>Backup & Restore</Text>
        <View style={styles.placeholder} />
      </LinearGradient>
    </Animated.View>
  );

  const renderBackupStatus = () => (
    <Animated.View style={[styles.statusCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.statusHeader}>
        <Icon name="cloud-check" size={32} color={theme.success} />
        <Text style={styles.statusTitle}>Backup Status</Text>
      </View>
      
      <View style={styles.statusInfo}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Last Backup:</Text>
          <Text style={styles.statusValue}>{backupInfo.lastBackup}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Backup Size:</Text>
          <Text style={styles.statusValue}>{backupInfo.backupSize}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Cloud Provider:</Text>
          <Text style={styles.statusValue}>{backupInfo.cloudProvider}</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderActionButton = (title, subtitle, icon, onPress, iconColor, backgroundColor, isLoading = false) => (
    <TouchableOpacity onPress={onPress} disabled={isLoading}>
      <Animated.View style={[
        styles.actionButton, 
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        isLoading && styles.disabledButton
      ]}>
        <View style={styles.actionLeft}>
          <View style={[styles.actionIcon, { backgroundColor }]}>
            {isLoading ? (
              <Icon name="loading" size={22} color={iconColor} />
            ) : (
              <Icon name={icon} size={22} color={iconColor} />
            )}
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionSubtitle}>{subtitle}</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={20} color={theme.textLight} />
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
      {renderHeader()}
      
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderBackupStatus()}

        {renderSection('Backup Actions', (
          <>
            {renderActionButton(
              'Backup Now',
              'Create a backup of all your data',
              'backup-restore',
              handleBackupNow,
              theme.info,
              theme.iconBackground.blue,
              isBackingUp
            )}
            {renderActionButton(
              'Restore from Backup',
              'Restore data from your latest backup',
              'restore',
              handleRestoreBackup,
              theme.warning,
              theme.iconBackground.orange,
              isRestoring
            )}
          </>
        ))}

        {renderSection('Settings', (
          <>
            {renderActionButton(
              'Change Cloud Provider',
              `Currently using ${backupInfo.cloudProvider}`,
              'cloud-sync',
              handleChangeCloudProvider,
              theme.success,
              theme.iconBackground.green
            )}
            {renderActionButton(
              'Backup Schedule',
              'Configure automatic backup frequency',
              'calendar-clock',
              () => Alert.alert('Coming Soon', 'Backup scheduling will be available soon!'),
              '#9C27B0',
              theme.iconBackground.purple
            )}
          </>
        ))}

        {(isBackingUp || isRestoring) && (
          <Animated.View style={[styles.progressContainer, { opacity: fadeAnim }]}>
            <Text style={styles.progressText}>
              {isBackingUp ? 'Creating backup...' : 'Restoring data...'}
            </Text>
            {Platform.OS === 'android' && (
              <ProgressBarAndroid
                styleAttr="Horizontal"
                indeterminate={true}
                color={theme.primary}
              />
            )}
          </Animated.View>
        )}
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    elevation: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginLeft: 12,
  },
  statusInfo: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
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
  actionButton: {
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
  disabledButton: {
    opacity: 0.6,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
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
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  progressContainer: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    elevation: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 15,
  },
});