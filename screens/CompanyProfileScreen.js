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

  // Animation values - MUST be declared before any conditional returns
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

  // Don't render until theme and auth are loaded - MOVED AFTER ALL HOOKS
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
      }
  };

  const saveSettings = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
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
    return `₹${amount.toFixed(2).replace(/\\d(?=(\\d{3})+\\.)/g, '$&,')}`;
  };

  const renderProfileHeader = () => (
    <Animated.View style={[
      styles.profileHeader,
      { 
        opacity: fadeAnim,
        transform: [{ scale: profileScaleAnim }]
      }
    ]}>
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.profileGradient}
      >
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
            <Icon name={isEditing ? "close" : "pencil"} size={20} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
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
              onChangeText={(text) => setEditedData({...editedData, companyName: text})}
              placeholder="Enter company name"
              placeholderTextColor={theme.textLight}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contact Person</Text>
            <TextInput
              style={styles.textInput}
              value={editedData.contactPerson}
              onChangeText={(text) => setEditedData({...editedData, contactPerson: text})}
              placeholder="Enter contact person name"
              placeholderTextColor={theme.textLight}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.textInput}
              value={editedData.phone}
              onChangeText={(text) => setEditedData({...editedData, phone: text})}
              placeholder="Enter phone number"
              placeholderTextColor={theme.textLight}
              keyboardType="phone-pad"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Industry</Text>
            <TextInput
              style={styles.textInput}
              value={editedData.industry}
              onChangeText={(text) => setEditedData({...editedData, industry: text})}
              placeholder="Enter industry"
              placeholderTextColor={theme.textLight}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Employee Count</Text>
            <TextInput
              style={styles.textInput}
              value={editedData.employeeCount?.toString()}
              onChangeText={(text) => setEditedData({...editedData, employeeCount: parseInt(text) || 0})}
              placeholder="Enter employee count"
              placeholderTextColor={theme.textLight}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Active Projects</Text>
            <TextInput
              style={styles.textInput}
              value={editedData.activeProjects?.toString()}
              onChangeText={(text) => setEditedData({...editedData, activeProjects: parseInt(text) || 0})}
              placeholder="Enter active projects count"
              placeholderTextColor={theme.textLight}
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
          <Icon name="bell" size={20} color={theme.primary} />
          <Text style={styles.settingLabel}>Push Notifications</Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={(value) => {
            setNotificationsEnabled(value);
            saveSettings('company_notifications_enabled', value);
          }}
          trackColor={{ false: theme.border, true: theme.primaryLight }}
          thumbColor={notificationsEnabled ? theme.primary : theme.textLight}
        />
      </View>
      
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Icon name="email" size={20} color={theme.primary} />
          <Text style={styles.settingLabel}>Email Reports</Text>
        </View>
        <Switch
          value={emailReportsEnabled}
          onValueChange={(value) => {
            setEmailReportsEnabled(value);
            saveSettings('company_email_reports_enabled', value);
          }}
          trackColor={{ false: theme.border, true: theme.primaryLight }}
          thumbColor={emailReportsEnabled ? theme.primary : theme.textLight}
        />
      </View>
      
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Icon name="theme-light-dark" size={20} color={theme.primary} />
          <Text style={styles.settingLabel}>Dark Mode</Text>
        </View>
        <Switch
          value={isDarkMode}
          onValueChange={toggleTheme}
          trackColor={{ false: theme.border, true: theme.primaryLight }}
          thumbColor={isDarkMode ? theme.primary : theme.textLight}
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
        <Icon name="chart-line" size={20} color={theme.primary} />
        <Text style={styles.actionText}>View Reports</Text>
        <Icon name="chevron-right" size={20} color={theme.textLight} />
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('TeamManagementDetail')}>
        <Icon name="account-group" size={20} color={theme.primary} />
        <Text style={styles.actionText}>Manage Team</Text>
        <Icon name="chevron-right" size={20} color={theme.textLight} />
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('CompanyBudgetDetail')}>
        <Icon name="calculator" size={20} color={theme.primary} />
        <Text style={styles.actionText}>Budget Management</Text>
        <Icon name="chevron-right" size={20} color={theme.textLight} />
      </TouchableOpacity>
      
      <TouchableOpacity style={[styles.actionButton, styles.signOutButton]} onPress={handleSignOut}>
        <Icon name="logout" size={20} color="#FF5252" />
        <Text style={[styles.actionText, { color: '#FF5252' }]}>Sign Out</Text>
        <Icon name="chevron-right" size={20} color={theme.textLight} />
      </TouchableOpacity>
    </Animated.View>
  );

  const styles = createStyles(theme);

  return (
    <UserTypeGuard requiredUserType="company" navigation={navigation}>
      <StatusBar backgroundColor={theme.background} barStyle={theme.statusBarStyle} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Company Profile</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          {renderProfileHeader()}
          {renderCompanyStats()}
          {renderEditableInfo()}
          {renderSettings()}
          {renderActions()}
        </ScrollView>
      </View>
    </UserTypeGuard>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 20,
    backgroundColor: theme.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  
  // Profile Header Styles
  profileHeader: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileGradient: {
    padding: 20,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profileDetails: {
    flex: 1,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Stats Section Styles
  statsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  
  // Info Section Styles
  infoSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  infoGrid: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
  },
  
  // Edit Form Styles
  editForm: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  saveButton: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  saveGradient: {
    paddingVertical: 12,
    alignItems: 'center',
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
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.text,
    marginLeft: 12,
  },
  
  // Actions Section Styles
  actionsSection: {
    marginHorizontal: 20,
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionText: {
    fontSize: 16,
    color: theme.text,
    marginLeft: 12,
    flex: 1,
  },
  signOutButton: {
    marginTop: 10,
  },
});