// ProfileScreen.js - redesigned with glassmorphism
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileScreen({ navigation, onClose }) {
  const { isDarkMode, theme, toggleTheme, isLoading } = useTheme();
  const { user, userData } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Loading guard
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', paddingTop: StatusBar.currentHeight || 0 }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  // User info
  const userInfo = {
    name: userData?.fullName || 'User',
    email: user?.email || 'No email',
    phone: userData?.phone || 'Not provided',
    joinDate: userData?.createdAt
      ? new Date(userData.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      : 'Recently',
    userType: userData?.userType || 'personal',
  };

  // Track screen visit for recent actions
  const trackScreenVisit = async () => {
    try {
      const recent = await AsyncStorage.getItem('recentActions');
      let actions = recent ? JSON.parse(recent) : [];
      const screen = { id: 'Profile', title: 'Profile', icon: 'account', timestamp: Date.now() };
      actions = actions.filter(a => a.id !== screen.id);
      actions.unshift(screen);
      actions = actions.slice(0, 4);
      await AsyncStorage.setItem('recentActions', JSON.stringify(actions));
    } catch (_) { }
  };

  const trackButtonAction = async (data) => {
    try {
      const recent = await AsyncStorage.getItem('recentActions');
      let actions = recent ? JSON.parse(recent) : [];
      const item = { ...data, timestamp: Date.now() };
      actions = actions.filter(a => a.id !== item.id);
      actions.unshift(item);
      actions = actions.slice(0, 4);
      await AsyncStorage.setItem('recentActions', JSON.stringify(actions));
    } catch (_) { }
  };

  // Navigation helpers
  const handleGoBack = () => {
    if (onClose) {
      onClose();
    } else {
      const parent = navigation.getParent();
      if (parent) {
        parent.setOptions({
          tabBarStyle: {
            backgroundColor: isDarkMode ? '#1e1e1e' : 'white',
            borderTopWidth: 0,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            paddingBottom: 10,
            paddingTop: 15,
            height: 75,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
          },
        });
      }
    }
    navigation.goBack();
  };

  const handleEditProfile = async () => {
    await trackButtonAction({ id: 'EditProfile', title: 'Edit Profile', icon: 'account-edit' });
    navigation.navigate('EditProfile');
  };
  const handleSettings = async () => {
    await trackButtonAction({ id: 'Settings', title: 'Settings', icon: 'cog' });
    navigation.navigate('Settings');
  };
  const handleThemes = async () => {
    await trackButtonAction({ id: 'Themes', title: 'Themes', icon: 'palette' });
    navigation.navigate('Themes');
  };
  const handleSecuritySettings = async () => {
    await trackButtonAction({ id: 'SecuritySettings', title: 'Security Settings', icon: 'shield-check' });
    navigation.navigate('SecuritySettings');
  };
  const handleBackupRestore = async () => {
    await trackButtonAction({ id: 'BackupRestore', title: 'Backup & Restore', icon: 'backup-restore' });
    navigation.navigate('BackupRestore');
  };
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          if (onClose) {
            onClose();
            setTimeout(() => navigation.navigate('UserType'), 500);
          } else {
            navigation.navigate('UserType');
          }
        },
      },
    ]);
  };

  // Effects
  useEffect(() => {
    const parent = navigation.getParent();
    if (parent) parent.setOptions({ tabBarStyle: { display: 'none' } });
    trackScreenVisit();
    const unsubscribe = navigation.addListener('focus', trackScreenVisit);
    return () => {
      unsubscribe();
      if (parent) {
        parent.setOptions({
          tabBarStyle: {
            backgroundColor: isDarkMode ? '#1e1e1e' : 'white',
            borderTopWidth: 0,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            paddingBottom: 10,
            paddingTop: 15,
            height: 75,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
          },
        });
      }
    };
  }, [navigation, isDarkMode]);

  // Render helpers
  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.profileGradient}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Icon name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.profileImageContainer}>
          <View style={styles.profileImage}>
            <Icon name="account" size={60} color="white" />
          </View>
          <TouchableOpacity style={styles.editImageButton}>
            <Icon name="camera" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.profileName}>{userInfo.name}</Text>
        <Text style={styles.profileEmail}>{userInfo.email}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{userInfo.userType === 'personal' ? 'Personal' : 'Business'}</Text>
            <Text style={styles.statLabel}>Account Type</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>Active</Text>
            <Text style={styles.statLabel}>Status</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderAccountInfo = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Account Information</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoItem}>
          <Icon name="account-outline" size={20} color={theme.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{userInfo.name}</Text>
          </View>
        </View>
        <View style={styles.infoItem}>
          <Icon name="email-outline" size={20} color={theme.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{userInfo.email}</Text>
          </View>
        </View>
        <View style={styles.infoItem}>
          <Icon name="phone-outline" size={20} color={theme.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{userInfo.phone}</Text>
          </View>
        </View>
        <View style={styles.infoItem}>
          <Icon name="calendar-outline" size={20} color={theme.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>{userInfo.joinDate}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderMenuButtons = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Account Management</Text>
      <TouchableOpacity style={styles.menuButton} onPress={handleEditProfile}>
        <View style={styles.menuButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: theme.iconBackground.blue }]}>
            <Icon name="account-edit" size={22} color={theme.info} />
          </View>
          <Text style={styles.menuButtonText}>Edit Profile</Text>
        </View>
        <Icon name="chevron-right" size={20} color={theme.textLight} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuButton} onPress={handleSecuritySettings}>
        <View style={styles.menuButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: theme.iconBackground.green }]}>
            <Icon name="shield-check" size={22} color={theme.success} />
          </View>
          <Text style={styles.menuButtonText}>Security Settings</Text>
        </View>
        <Icon name="chevron-right" size={20} color={theme.textLight} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuButton} onPress={handleBackupRestore}>
        <View style={styles.menuButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: theme.iconBackground.purple }]}>
            <Icon name="backup-restore" size={22} color="#9C27B0" />
          </View>
          <Text style={styles.menuButtonText}>Backup & Restore</Text>
        </View>
        <Icon name="chevron-right" size={20} color={theme.textLight} />
      </TouchableOpacity>
      <Text style={[styles.sectionTitle, { marginTop: 25 }]}>Preferences</Text>
      <TouchableOpacity style={styles.menuButton} onPress={handleSettings}>
        <View style={styles.menuButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: theme.iconBackground.gray }]}>
            <Icon name="cog" size={22} color={theme.textSecondary} />
          </View>
          <Text style={styles.menuButtonText}>App Settings</Text>
        </View>
        <Icon name="chevron-right" size={20} color={theme.textLight} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuButton} onPress={handleThemes}>
        <View style={styles.menuButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: theme.iconBackground.orange }]}>
            <Icon name="palette" size={22} color={theme.warning} />
          </View>
          <Text style={styles.menuButtonText}>Themes & Appearance</Text>
        </View>
        <Icon name="chevron-right" size={20} color={theme.textLight} />
      </TouchableOpacity>
      <View style={styles.menuButton}>
        <View style={styles.menuButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: theme.iconBackground.blue }]}>
            <Icon name="bell" size={22} color={theme.info} />
          </View>
          <Text style={styles.menuButtonText}>Push Notifications</Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
          trackColor={{ false: theme.textLight, true: theme.primary }}
          thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
        />
      </View>
      <View style={styles.menuButton}>
        <View style={styles.menuButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: theme.iconBackground.gray }]}>
            <Icon name="theme-light-dark" size={22} color={theme.textSecondary} />
          </View>
          <Text style={styles.menuButtonText}>Dark Mode</Text>
        </View>
        <Switch
          value={isDarkMode}
          onValueChange={toggleTheme}
          trackColor={{ false: theme.textLight, true: theme.primary }}
          thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
        />
      </View>
      <TouchableOpacity style={[styles.menuButton, styles.logoutButton]} onPress={handleLogout}>
        <View style={styles.menuButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: theme.iconBackground.red }]}>
            <Icon name="logout" size={22} color={theme.error} />
          </View>
          <Text style={[styles.menuButtonText, styles.logoutText]}>Logout</Text>
        </View>
        <Icon name="chevron-right" size={20} color={theme.error} />
      </TouchableOpacity>
    </View>
  );

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.background}
      />
      {renderProfileHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {renderAccountInfo()}
        {renderMenuButtons()}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.primary,
    },
    background: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    // Profile Header
    profileHeader: {
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      overflow: 'hidden',
      // Transparent to let gradient show through
    },
    profileGradient: {
      paddingTop: (StatusBar.currentHeight || 0) + 20,
      paddingBottom: 30,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    backButton: {
      position: 'absolute',
      top: (StatusBar.currentHeight || 0) + 20,
      left: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileImageContainer: {
      position: 'relative',
      marginTop: 20,
      marginBottom: 15,
    },
    profileImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 4,
      borderColor: 'white',
    },
    editImageButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    profileName: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 5 },
    profileEmail: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginBottom: 20 },
    statsRow: { flexDirection: 'row', alignItems: 'center' },
    statItem: { alignItems: 'center', paddingHorizontal: 20 },
    statNumber: { fontSize: 20, fontWeight: 'bold', color: 'white' },
    statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.3)' },
    // Content
    content: { flex: 1 },
    scrollContent: { paddingBottom: 30 },
    section: { marginTop: 20, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: 'white', borderBottomColor: 'rgba(255,255,255,0.2)' },
    infoCard: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 15,
      padding: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    infoContent: { marginLeft: 15, flex: 1 },
    infoLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
    infoValue: { fontSize: 16, color: 'white', fontWeight: '500' },
    // Menu Buttons
    menuButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    menuButtonLeft: { flexDirection: 'row', alignItems: 'center' },
    menuIcon: {
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
    menuButtonText: { fontSize: 17, color: 'white', fontWeight: '600', letterSpacing: 0.3 },
    logoutButton: { marginTop: 15, backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.2)' },
    logoutText: { color: 'white', fontWeight: '600' },
  });