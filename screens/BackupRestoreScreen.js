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
  ActivityIndicator,
  Platform,
  SafeAreaView,
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

  const renderBackupStatus = () => (
    <Animated.View style={[styles.statusCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.statusHeader}>
        <Icon name="cloud-check" size={32} color="white" />
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

  const renderActionButton = (title, subtitle, icon, onPress, isLoading = false) => (
    <TouchableOpacity onPress={onPress} disabled={isLoading}>
      <Animated.View style={[
        styles.actionButton,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        isLoading && styles.disabledButton
      ]}>
        <View style={styles.actionLeft}>
          <View style={styles.actionIcon}>
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Icon name={icon} size={22} color="white" />
            )}
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionSubtitle}>{subtitle}</Text>
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
          <Text style={styles.headerTitle}>Backup & Restore</Text>
          <View style={styles.headerSpacer} />
        </Animated.View>

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
                isBackingUp
              )}
              {renderActionButton(
                'Restore from Backup',
                'Restore data from your latest backup',
                'restore',
                handleRestoreBackup,
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
                handleChangeCloudProvider
              )}
              {renderActionButton(
                'Backup Schedule',
                'Configure automatic backup frequency',
                'calendar-clock',
                () => Alert.alert('Coming Soon', 'Backup scheduling will be available soon!')
              )}
            </>
          ))}

          {(isBackingUp || isRestoring) && (
            <Animated.View style={[styles.progressContainer, { opacity: fadeAnim }]}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.progressText}>
                {isBackingUp ? 'Creating backup...' : 'Restoring data...'}
              </Text>
            </Animated.View>
          )}
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
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
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
    color: 'rgba(255,255,255,0.7)',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
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
  actionButton: {
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  progressContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 30,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginTop: 15,
  },
});