import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

export default function TeamManagementScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const [selectedTab, setSelectedTab] = useState('team');
  const [searchQuery, setSearchQuery] = useState('');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.loadingBackground || '#f8f9fa', paddingTop: StatusBar.currentHeight || 0 }}>
        <ActivityIndicator size="large" color={theme?.loadingIndicator || '#667eea'} />
      </View>
    );
  }

  useEffect(() => {
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

    // Track this screen visit
    trackScreenVisit();

    // Listen for navigation focus to track tab bar navigation
    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
    });

    return unsubscribe;
  }, [navigation]);

  const trackScreenVisit = async () => {
    try {
      const stored = await AsyncStorage.getItem('company_recent_actions');
      let recentActions = stored ? JSON.parse(stored) : [];
      
      const newAction = {
        id: 'team',
        name: 'Team',
        icon: 'account-group',
        color: theme.info,
        timestamp: Date.now()
      };
      
      recentActions = recentActions.filter(action => action.id !== 'team');
      recentActions.unshift(newAction);
      recentActions = recentActions.slice(0, 4);
      
      await AsyncStorage.setItem('company_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      }
  };

  // Sample team data
  const [teamData] = useState({
    members: [
      {
        id: 1,
        name: 'Sarah Johnson',
        email: 'sarah.johnson@techcorp.com',
        role: 'Administrator',
        department: 'Management',
        status: 'active',
        joinDate: '2020-03-15',
        lastActive: '2 hours ago',
        permissions: ['all'],
        avatar: 'account-tie',
        color: theme.success
      },
      {
        id: 2,
        name: 'Mike Chen',
        email: 'mike.chen@techcorp.com',
        role: 'Lead Developer',
        department: 'Engineering',
        status: 'active',
        joinDate: '2021-01-20',
        lastActive: '1 hour ago',
        permissions: ['read', 'write'],
        avatar: 'account-hard-hat',
        color: theme.info
      },
      {
        id: 3,
        name: 'Emily Rodriguez',
        email: 'emily.rodriguez@techcorp.com',
        role: 'Marketing Manager',
        department: 'Marketing',
        status: 'active',
        joinDate: '2021-06-10',
        lastActive: '30 minutes ago',
        permissions: ['read', 'write'],
        avatar: 'account-star',
        color: theme.warning
      },
      {
        id: 4,
        name: 'David Kim',
        email: 'david.kim@techcorp.com',
        role: 'Sales Representative',
        department: 'Sales',
        status: 'inactive',
        joinDate: '2022-02-14',
        lastActive: '2 days ago',
        permissions: ['read'],
        avatar: 'account-cash',
        color: theme.categoryColors.shopping
      },
    ],
    departments: [
      { name: 'Engineering', members: 8, budget: 25000, color: theme.success },
      { name: 'Marketing', members: 4, budget: 15000, color: theme.warning },
      { name: 'Sales', members: 6, budget: 20000, color: theme.info },
      { name: 'Operations', members: 3, budget: 10000, color: theme.categoryColors.shopping },
      { name: 'HR', members: 2, budget: 8000, color: theme.categoryColors.others },
      { name: 'Finance', members: 1, budget: 12000, color: theme.categoryColors.bills },
    ],
    permissions: [
      { id: 'read', name: 'View Only', description: 'Can view company data and reports' },
      { id: 'write', name: 'Edit Access', description: 'Can add and edit transactions' },
      { id: 'admin', name: 'Admin Access', description: 'Full access to all features' },
      { id: 'reports', name: 'Reports Access', description: 'Can generate and export reports' },
    ]
  });

  const tabs = [
    { id: 'team', name: 'Team Members', icon: 'account-group' },
    { id: 'departments', name: 'Departments', icon: 'office-building' },
    { id: 'permissions', name: 'Permissions', icon: 'shield-account' },
  ];

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(0).replace(/\\d(?=(\\d{3})+$)/g, '$&,')}`;
  };

  const handleAddMember = () => {
    Alert.alert('Add Team Member', 'Team member invitation functionality will be implemented here');
  };

  const handleEditMember = (member) => {
    Alert.alert('Edit Member', `Edit ${member.name}'s details and permissions`);
  };

  const handleRemoveMember = (member) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.name} from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive' }
      ]
    );
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-left" size={24} color={theme.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Team Management</Text>
      <TouchableOpacity style={styles.addButton} onPress={handleAddMember}>
        <Icon name="plus" size={20} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderTabSelector = () => (
    <Animated.View style={[styles.tabSelector, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabButton,
              selectedTab === tab.id && styles.tabButtonActive
            ]}
            onPress={() => setSelectedTab(tab.id)}
          >
            <Icon 
              name={tab.icon} 
              size={18} 
              color={selectedTab === tab.id ? 'white' : theme.primary} 
            />
            <Text style={[
              styles.tabButtonText,
              selectedTab === tab.id && styles.tabButtonTextActive
            ]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );

  const renderSearchBar = () => (
    <Animated.View style={[styles.searchContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Icon name="magnify" size={20} color={theme.textLight} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search team members..."
        placeholderTextColor={theme.textLight}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
          <Icon name="close" size={16} color={theme.textLight} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  const renderTeamMembers = () => {
    const filteredMembers = teamData.members.filter(member =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.department.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.sectionTitle}>Team Members ({filteredMembers.length})</Text>
        {filteredMembers.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberHeader}>
              <View style={styles.memberInfo}>
                <View style={[styles.memberAvatar, { backgroundColor: `${member.color}20` }]}>
                  <Icon name={member.avatar} size={24} color={member.color} />
                </View>
                <View style={styles.memberDetails}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: member.status === 'active' ? theme.iconBackground.green : theme.iconBackground.orange }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: member.status === 'active' ? theme.statusColors.active : theme.statusColors.inactive }
                      ]}>
                        {member.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.memberEmail}>{member.email}</Text>
                  <Text style={styles.memberRole}>{member.role} • {member.department}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.memberMenuButton}
                onPress={() => handleEditMember(member)}
              >
                <Icon name="dots-vertical" size={20} color={theme.textLight} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.memberFooter}>
              <View style={styles.memberMetrics}>
                <View style={styles.memberMetric}>
                  <Icon name="calendar" size={14} color={theme.textSecondary} />
                  <Text style={styles.memberMetricText}>Joined {member.joinDate}</Text>
                </View>
                <View style={styles.memberMetric}>
                  <Icon name="clock" size={14} color={theme.textSecondary} />
                  <Text style={styles.memberMetricText}>Active {member.lastActive}</Text>
                </View>
              </View>
              <View style={styles.permissionTags}>
                {member.permissions.map((permission) => (
                  <View key={permission} style={styles.permissionTag}>
                    <Text style={styles.permissionTagText}>{permission}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderDepartments = () => (
    <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>Departments ({teamData.departments.length})</Text>
      {teamData.departments.map((dept, index) => (
        <View key={index} style={styles.departmentCard}>
          <View style={styles.departmentHeader}>
            <View style={styles.departmentInfo}>
              <View style={[styles.departmentIcon, { backgroundColor: `${dept.color}20` }]}>
                <Icon name="office-building" size={20} color={dept.color} />
              </View>
              <Text style={styles.departmentName}>{dept.name}</Text>
            </View>
            <TouchableOpacity style={styles.departmentMenuButton}>
              <Icon name="dots-vertical" size={20} color={theme.textLight} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.departmentMetrics}>
            <View style={styles.departmentMetric}>
              <Icon name="account-group" size={16} color={theme.textSecondary} />
              <Text style={styles.departmentMetricText}>{dept.members} Members</Text>
            </View>
            <View style={styles.departmentMetric}>
              <Icon name="wallet" size={16} color={theme.textSecondary} />
              <Text style={styles.departmentMetricText}>{formatCurrency(dept.budget)} Budget</Text>
            </View>
          </View>
        </View>
      ))}
    </Animated.View>
  );

  const renderPermissions = () => (
    <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>Permission Levels</Text>
      {teamData.permissions.map((permission) => (
        <View key={permission.id} style={styles.permissionCard}>
          <View style={styles.permissionHeader}>
            <View style={styles.permissionIcon}>
              <Icon name="shield-check" size={20} color={theme.primary} />
            </View>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionName}>{permission.name}</Text>
              <Text style={styles.permissionDescription}>{permission.description}</Text>
            </View>
          </View>
        </View>
      ))}
    </Animated.View>
  );

  const renderContent = () => {
    switch (selectedTab) {
      case 'team':
        return renderTeamMembers();
      case 'departments':
        return renderDepartments();
      case 'permissions':
        return renderPermissions();
      default:
        return renderTeamMembers();
    }
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderTabSelector()}
      {selectedTab === 'team' && renderSearchBar()}
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderContent()}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 20,
    backgroundColor: theme.headerBackground || theme.background,
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  // Tab Selector Styles
  tabSelector: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  tabScrollContent: {
    gap: 10,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginLeft: 8,
  },
  tabButtonTextActive: {
    color: 'white',
  },

  // Search Bar Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
    paddingVertical: 12,
  },
  clearButton: {
    padding: 5,
  },

  // Content Styles
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  content: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },

  // Member Card Styles
  memberCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberDetails: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  memberEmail: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: theme.textLight,
  },
  memberMenuButton: {
    padding: 5,
  },
  memberFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberMetrics: {
    gap: 8,
  },
  memberMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberMetricText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  permissionTags: {
    flexDirection: 'row',
    gap: 6,
  },
  permissionTag: {
    backgroundColor: `${theme.primary}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  permissionTagText: {
    fontSize: 10,
    color: theme.primary,
    fontWeight: '600',
  },

  // Department Card Styles
  departmentCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  departmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  departmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  departmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  departmentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  departmentMenuButton: {
    padding: 5,
  },
  departmentMetrics: {
    flexDirection: 'row',
    gap: 20,
  },
  departmentMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  departmentMetricText: {
    fontSize: 14,
    color: theme.textSecondary,
  },

  // Permission Card Styles
  permissionCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});