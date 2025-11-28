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
  TextInput,
  RefreshControl,
  SafeAreaView,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import UserTypeGuard from '../components/UserTypeGuard';

export default function CompanyProfileScreen({ navigation }) {
  const { isDarkMode, theme, toggleTheme, isLoading } = useTheme();
  const { user, userData, signOut, updateUserProfile, loading: authLoading } = useAuth();
  const { transactions, refresh: refreshTransactions } = useTransactions();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailReportsEnabled, setEmailReportsEnabled] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [companyStats, setCompanyStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    totalTransactions: 0,
    monthlyRevenue: 0,
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const profileScaleAnim = useRef(new Animated.Value(0.8)).current;

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
      Animated.spring(profileScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Initialize edited data with current user data
    setEditedData({
      companyName: userData?.companyName || '',
      contactPerson: userData?.contactPerson || userData?.fullName || '',
      phone: userData?.phone || '',
      industry: userData?.industry || '',
      employeeCount: userData?.employeeCount || 0,
      activeProjects: userData?.activeProjects || 0,
    });

    // Load settings
    loadSettings();

    // Calculate company stats from transactions
    calculateCompanyStats();

    // Auto-refresh data every 30 seconds
    const autoRefreshInterval = setInterval(() => {
      refreshTransactions();
      calculateCompanyStats();
    }, 30000);

    // Listen for navigation focus to refresh data
    const unsubscribe = navigation.addListener('focus', () => {
      refreshTransactions();
      calculateCompanyStats();
    });

    return () => {
      clearInterval(autoRefreshInterval);
      unsubscribe();
    };
  }, [navigation, transactions, userData]);

  // Don't render until theme and auth are loaded
  if (isLoading || authLoading || !theme || !user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.background || '#f8f9fa' }}>
        <StatusBar backgroundColor={theme?.background || '#f8f9fa'} barStyle={theme?.statusBarStyle || 'dark-content'} />
        <ActivityIndicator size="large" color={theme?.primary || '#667eea'} />
      </View>
    );
  }

  const loadSettings = async () => {
    try {
      const notifications = await AsyncStorage.getItem('company_notifications_enabled');
      const emailReports = await AsyncStorage.getItem('company_email_reports_enabled');

      if (notifications !== null) {
        setNotificationsEnabled(JSON.parse(notifications));
      }
      if (emailReports !== null) {
        setEmailReportsEnabled(JSON.parse(emailReports));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveSettings = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const calculateCompanyStats = () => {
    if (!transactions || transactions.length === 0) {
      return;
    }

    const totalRevenue = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate current month revenue
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlyRevenue = transactions
      .filter(t => {
        const transactionDate = new Date(t.date || t.createdAt);
        return t.type === 'income' &&
          transactionDate >= currentMonthStart &&
          transactionDate <= currentMonthEnd;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    setCompanyStats({
      totalRevenue,
      totalExpenses,
      totalTransactions: transactions.length,
      monthlyRevenue,
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshTransactions();
      calculateCompanyStats();
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const result = await updateUserProfile(editedData);
      if (result.success) {
        setIsEditing(false);
        Alert.alert('Success', 'Company profile updated successfully!');
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              navigation.replace('UserType');
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        }
      ]
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const renderProfileHeader = () => (
    <Animated.View style={[
      styles.profileHeader,
      {
        opacity: fadeAnim,
        transform: [{ scale: profileScaleAnim }]
      }
    ]}>
      <View style={styles.profileGradient}>
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            <Icon name="office-building" size={40} color="white" />
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.companyName}>
              {userData?.companyName || 'Company Name'}
            </Text>
            <Text style={styles.adminName}>
              {userData?.contactPerson || userData?.fullName || 'Admin Name'}
            </Text>
            <Text style={styles.adminEmail}>
              {user?.email || 'admin@company.com'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Icon name={isEditing ? "close" : "pencil"} size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  const renderCompanyStats = () => (
    <Animated.View style={[
      styles.statsSection,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      <Text style={styles.sectionTitle}>Company Statistics</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Icon name="trending-up" size={24} color="#4CAF50" />
          <Text style={styles.statValue}>{formatCurrency(companyStats.totalRevenue)}</Text>
          <Text style={styles.statLabel}>Total Revenue</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="trending-down" size={24} color="#FF5252" />
          <Text style={styles.statValue}>{formatCurrency(companyStats.totalExpenses)}</Text>
          <Text style={styles.statLabel}>Total Expenses</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="swap-vertical" size={24} color="#2196F3" />
          <Text style={styles.statValue}>{companyStats.totalTransactions}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="calendar-month" size={24} color="#FF9800" />
          <Text style={styles.statValue}>{formatCurrency(companyStats.monthlyRevenue)}</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderEditableInfo = () => (
    <Animated.View style={[
      styles.infoSection,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      <Text style={styles.sectionTitle}>Company Information</Text>

      {isEditing ? (
        <View style={styles.editForm}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Company Name</Text>
            <TextInput
              style={styles.textInput}
              value={editedData.companyName}
              onChangeText={(text) => setEditedData({ ...editedData, companyName: text })}
              placeholder="Enter company name"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contact Person</Text>
            <TextInput
              style={styles.textInput}
              value={editedData.contactPerson}
              onChangeText={(text) => setEditedData({ ...editedData, contactPerson: text })}
              placeholder="Enter contact person name"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.textInput}
              value={editedData.phone}
              onChangeText={(text) => setEditedData({ ...editedData, phone: text })}
              placeholder="Enter phone number"
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Industry</Text>
            <TextInput
              style={styles.textInput}
              value={editedData.industry}
              onChangeText={(text) => setEditedData({ ...editedData, industry: text })}
              placeholder="Enter industry"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Employee Count</Text>
            <TextInput
              style={styles.textInput}
              value={editedData.employeeCount?.toString()}
              onChangeText={(text) => setEditedData({ ...editedData, employeeCount: parseInt(text) || 0 })}
              placeholder="Enter employee count"
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Active Projects</Text>
            <TextInput
              style={styles.textInput}
              value={editedData.activeProjects?.toString()}
              onChangeText={(text) => setEditedData({ ...editedData, activeProjects: parseInt(text) || 0 })}
              placeholder="Enter active projects count"
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
            <LinearGradient
              colors={[theme.primary, theme.primaryLight]}
              style={styles.saveGradient}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Icon name="domain" size={20} color={theme.primary} />
            <Text style={styles.infoLabel}>Industry</Text>
            <Text style={styles.infoValue}>{userData?.industry || 'Not specified'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="phone" size={20} color={theme.primary} />
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{userData?.phone || 'Not provided'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="account-group" size={20} color={theme.primary} />
            <Text style={styles.infoLabel}>Employees</Text>
            <Text style={styles.infoValue}>{userData?.employeeCount || 0}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="briefcase" size={20} color={theme.primary} />
            <Text style={styles.infoLabel}>Active Projects</Text>
            <Text style={styles.infoValue}>{userData?.activeProjects || 0}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );

  const renderSettings = () => (
    <Animated.View style={[
      styles.settingsSection,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      <Text style={styles.sectionTitle}>Settings</Text>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(33, 150, 243, 0.2)' }]}>
            <Icon name="bell" size={20} color="#2196F3" />
          </View>
          <Text style={styles.settingLabel}>Push Notifications</Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={(value) => {
            setNotificationsEnabled(value);
            saveSettings('company_notifications_enabled', value);
          }}
          trackColor={{ false: 'rgba(255,255,255,0.2)', true: theme.primary }}
          thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
            <Icon name="email" size={20} color="#4CAF50" />
          </View>
          <Text style={styles.settingLabel}>Email Reports</Text>
        </View>
        <Switch
          value={emailReportsEnabled}
          onValueChange={(value) => {
            setEmailReportsEnabled(value);
            saveSettings('company_email_reports_enabled', value);
          }}
          trackColor={{ false: 'rgba(255,255,255,0.2)', true: theme.primary }}
          thumbColor={emailReportsEnabled ? '#fff' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(158, 158, 158, 0.2)' }]}>
            <Icon name="theme-light-dark" size={20} color="#9E9E9E" />
          </View>
          <Text style={styles.settingLabel}>Dark Mode</Text>
        </View>
        <Switch
          value={isDarkMode}
          onValueChange={toggleTheme}
          trackColor={{ false: 'rgba(255,255,255,0.2)', true: theme.primary }}
          thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
        />
      </View>
    </Animated.View>
  );

  const renderActions = () => (
    <Animated.View style={[
      styles.actionsSection,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('CompanyReportsDetail')}>
        <View style={styles.actionButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(255, 152, 0, 0.2)' }]}>
            <Icon name="chart-line" size={20} color="#FF9800" />
          </View>
          <Text style={styles.actionText}>View Reports</Text>
        </View>
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('TeamManagementDetail')}>
        <View style={styles.actionButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(33, 150, 243, 0.2)' }]}>
            <Icon name="account-group" size={20} color="#2196F3" />
          </View>
          <Text style={styles.actionText}>Manage Team</Text>
        </View>
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('CompanyBudgetDetail')}>
        <View style={styles.actionButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(156, 39, 176, 0.2)' }]}>
            <Icon name="calculator" size={20} color="#9C27B0" />
          </View>
          <Text style={styles.actionText}>Budget Management</Text>
        </View>
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.actionButton, styles.signOutButton]} onPress={handleSignOut}>
        <View style={styles.actionButtonLeft}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(255, 82, 82, 0.2)' }]}>
            <Icon name="logout" size={20} color="#FF5252" />
          </View>
          <Text style={[styles.actionText, { color: '#FF5252' }]}>Sign Out</Text>
        </View>
        <Icon name="chevron-right" size={20} color="#FF5252" />
      </TouchableOpacity>
    </Animated.View>
  );

  const styles = createStyles(theme);

  return (
    <UserTypeGuard requiredUserType="company" navigation={navigation}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
        <LinearGradient
          colors={[theme.primary, theme.primaryLight]}
          style={styles.background}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-left" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Company Profile</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="white"
              />
            }
          >
            {renderProfileHeader()}
            {renderCompanyStats()}
            {renderEditableInfo()}
            {renderSettings()}
            {renderActions()}
          </ScrollView>
        </SafeAreaView>
      </View>
    </UserTypeGuard>
  );
}

const createStyles = (theme) => StyleSheet.create({
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
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 20,
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
    paddingBottom: 40,
  },

  // Profile Header Styles
  profileHeader: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  profileGradient: {
    padding: 10,
    alignItems: 'center',
  },
  profileInfo: {
    alignItems: 'center',
    width: '100%',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
    marginBottom: 15,
  },
  profileDetails: {
    alignItems: 'center',
    marginBottom: 10,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  adminName: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  editButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  // Stats Section Styles
  statsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },

  // Info Section Styles
  infoSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  infoGrid: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  infoLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 12,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },

  // Edit Form Styles
  editForm: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  saveButton: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  saveGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'white', // Fallback
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Settings Section Styles
  settingsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: 'white',
    marginLeft: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Actions Section Styles
  actionsSection: {
    marginHorizontal: 20,
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    color: 'white',
    marginLeft: 12,
    fontWeight: '600',
  },
  signOutButton: {
    marginTop: 10,
    borderColor: 'rgba(255, 82, 82, 0.5)',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
  },
});