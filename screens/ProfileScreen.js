import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
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

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', paddingTop: StatusBar.currentHeight || 0 }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const profileScaleAnim = useRef(new Animated.Value(0.8)).current;

  // Real user data from Firebase
  const userInfo = {
    name: userData?.fullName || 'User',
    email: user?.email || 'No email',
    phone: userData?.phone || 'Not provided',
    joinDate: userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    }) : 'Recently',
    totalTransactions: userData?.totalTransactions || 0,
    totalSavings: userData?.totalSavings || 0,
    userType: userData?.userType || 'personal',
  };

  // Recent actions tracking
  const trackScreenVisit = async () => {
    try {
      const recentActions = await AsyncStorage.getItem('recentActions');
      let actions = recentActions ? JSON.parse(recentActions) : [];
      
      const screenData = {
        id: 'Profile',
        title: 'Profile',
        icon: 'account',
        timestamp: Date.now(),
      };
      
      // Remove existing entry if present
      actions = actions.filter(action => action.id !== screenData.id);
      
      // Add to beginning
      actions.unshift(screenData);
      
      // Keep only last 4 actions
      actions = actions.slice(0, 4);
      
      await AsyncStorage.setItem('recentActions', JSON.stringify(actions));
    } catch (error) {
      }
  };

  const trackButtonAction = async (actionData) => {
    try {
      const recentActions = await AsyncStorage.getItem('recentActions');
      let actions = recentActions ? JSON.parse(recentActions) : [];
      
      const buttonData = {
        ...actionData,
        timestamp: Date.now(),
      };
      
      // Remove existing entry if present
      actions = actions.filter(action => action.id !== buttonData.id);
      
      // Add to beginning
      actions.unshift(buttonData);
      
      // Keep only last 4 actions
      actions = actions.slice(0, 4);
      
      await AsyncStorage.setItem('recentActions', JSON.stringify(actions));
    } catch (error) {
      }
  };

  useEffect(() => {
    // Hide tab bar when ProfileScreen is active
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: { display: 'none' }
      });
    }

    // Track screen visit
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
      Animated.spring(profileScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Listen for navigation focus to track visits
    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
    });

    // Cleanup function to restore tab bar when leaving
    return () => {
      unsubscribe();
      if (parent) {
        // Use a more robust tab bar restoration that doesn't depend on theme context
        parent.setOptions({
          tabBarStyle: {
            backgroundColor: isDarkMode ? '#1e1e1e' : 'white',
            borderTopWidth: 0,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            paddingBottom: 10,
            paddingTop: 15,
            height: 75,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
          }
        });
      }
    };
  }, [navigation, isDarkMode]);

  const handleEditProfile = async () => {
    await trackButtonAction({
      id: 'EditProfile',
      title: 'Edit Profile',
      icon: 'account-edit',
    });
    
    // Navigate to edit profile screen
    navigation.navigate('EditProfile');
  };

  const handleSettings = async () => {
    await trackButtonAction({
      id: 'Settings',
      title: 'Settings',
      icon: 'cog',
    });
    
    // Navigate to settings screen
    navigation.navigate('Settings');
  };

  const handleThemes = async () => {
    await trackButtonAction({
      id: 'Themes',
      title: 'Themes',
      icon: 'palette',
    });
    
    // Navigate to themes screen
    navigation.navigate('Themes');
  };

  const handleSecuritySettings = async () => {
    await trackButtonAction({
      id: 'SecuritySettings',
      title: 'Security Settings',
      icon: 'shield-check',
    });
    
    // Navigate to security settings screen
    navigation.navigate('SecuritySettings');
  };

  const handleBackupRestore = async () => {
    await trackButtonAction({
      id: 'BackupRestore',
      title: 'Backup & Restore',
      icon: 'backup-restore',
    });
    
    // Navigate to backup & restore screen
    navigation.navigate('BackupRestore');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
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
          }
        }
      ]
    );
  };

  const handleGoBack = () => {
    if (onClose) {
      onClose();
    } else {
      // Restore tab bar immediately before navigation
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
            shadowRadius: 12,
            paddingBottom: 10,
            paddingTop: 15,
            height: 75,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
          }
        });
      }
      
      // Add exit animation before navigation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 30,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigation.goBack();
      });
    }
  };

  const renderProfileHeader = () => (
    <Animated.View style={[styles.profileHeader, { opacity: fadeAnim, transform: [{ scale: profileScaleAnim }] }]}>
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.profileGradient}
      >
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
      </LinearGradient>
    </Animated.View>
  );

  const renderAccountInfo = () => (
    <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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
    </Animated.View>
  );

  const renderMenuButtons = () => (
    <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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
    </Animated.View>
  );

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {renderProfileHeader()}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderAccountInfo()}
        {renderMenuButtons()}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },

  // Profile Header Styles
  profileHeader: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  profileGradient: {
    paddingTop: (StatusBar.currentHeight || 0) + 20, // Add status bar height + original padding
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 0) + 20, // Add status bar height + original padding
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
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  profileEmail: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Content Styles
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },

  // Account Info Styles
  infoCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  infoContent: {
    marginLeft: 15,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },

  // Menu Button Styles
  menuButton: {
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
  menuButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  menuButtonText: {
    fontSize: 17,
    color: theme.text,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  logoutButton: {
    marginTop: 15,
    backgroundColor: theme.isDarkMode ? '#2d1b1b' : '#fef2f2',
    borderColor: theme.isDarkMode ? '#4b2626' : '#fecaca',
  },
  logoutText: {
    color: theme.error,
    fontWeight: '600',
  },
});