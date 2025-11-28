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
  Modal,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import UserTypeGuard from '../components/UserTypeGuard';
import teamService from '../services/teamService';

export default function TeamManagementScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('team');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [showEditSalaryModal, setShowEditSalaryModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Form States
  const [newMember, setNewMember] = useState({ name: '', email: '', role: '', salary: '', department: '' });
  const [newTeam, setNewTeam] = useState({ name: '', budget: '' });
  const [salaryEdit, setSalaryEdit] = useState('');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Data State
  const [teamData, setTeamData] = useState({
    members: [],
    departments: []
  });
  const [loadingData, setLoadingData] = useState(true);

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#667eea" />
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

    trackScreenVisit();
    loadData();

    // Reload data when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });

    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    if (!user?.uid) return;

    setLoadingData(true);
    try {
      const membersResult = await teamService.getMembers(user.uid);
      const teamsResult = await teamService.getTeams(user.uid);

      setTeamData({
        members: membersResult.members || [],
        departments: teamsResult.teams || []
      });
    } catch (error) {
      console.error('Error loading team data:', error);
      Alert.alert('Error', 'Failed to load team data');
    } finally {
      setLoadingData(false);
    }
  };

  const trackScreenVisit = async () => {
    try {
      const stored = await AsyncStorage.getItem('company_recent_actions');
      let recentActions = stored ? JSON.parse(stored) : [];

      const newAction = {
        id: 'team',
        name: 'Team',
        icon: 'account-group',
        color: '#2196F3',
        timestamp: Date.now()
      };

      recentActions = recentActions.filter(action => action.id !== 'team');
      recentActions.unshift(newAction);
      recentActions = recentActions.slice(0, 4);

      await AsyncStorage.setItem('company_recent_actions', JSON.stringify(recentActions));
    } catch (error) {
      console.error('Error tracking screen visit:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTotalSalary = () => {
    return teamData.members.reduce((sum, member) => sum + (member.salary || 0), 0);
  };

  const handleCreateMember = async () => {
    if (!newMember.name || !newMember.role || !newMember.salary) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    const newMemberObj = {
      ...newMember,
      salary: parseFloat(newMember.salary),
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0],
      avatar: 'account',
      color: theme.primary
    };

    const result = await teamService.addMember(user.uid, newMemberObj);
    if (result.success) {
      // Automatically create salary expense transaction
      await teamService.createMonthlySalaryExpense(user.uid, {
        ...result.member,
        id: result.member.id
      });

      setTeamData(prev => ({
        ...prev,
        members: [...prev.members, result.member]
      }));
      setShowAddMemberModal(false);
      setNewMember({ name: '', email: '', role: '', salary: '', department: '' });
      Alert.alert('Success', 'Team member added and salary expense recorded!');
    } else {
      Alert.alert('Error', 'Failed to add member');
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeam.name || !newTeam.budget) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    const newTeamObj = {
      name: newTeam.name,
      budget: parseFloat(newTeam.budget),
      color: theme.primary,
      icon: 'office-building'
    };

    const result = await teamService.addTeam(user.uid, newTeamObj);
    if (result.success) {
      setTeamData(prev => ({
        ...prev,
        departments: [...prev.departments, result.team]
      }));
      setShowAddTeamModal(false);
      setNewTeam({ name: '', budget: '' });
    } else {
      Alert.alert('Error', 'Failed to create team');
    }
  };

  const openSalaryEdit = (member) => {
    setSelectedMember(member);
    setSalaryEdit(member.salary.toString());
    setShowEditSalaryModal(true);
  };

  const handleUpdateSalary = async () => {
    if (!selectedMember || !salaryEdit) return;

    const result = await teamService.updateMember(selectedMember.id, {
      salary: parseFloat(salaryEdit)
    });

    if (result.success) {
      const updatedMember = { ...selectedMember, salary: parseFloat(salaryEdit) };
      setTeamData(prev => ({
        ...prev,
        members: prev.members.map(m =>
          m.id === selectedMember.id ? updatedMember : m
        )
      }));
      setShowEditSalaryModal(false);
      setSelectedMember(null);
      setSalaryEdit('');
    } else {
      Alert.alert('Error', 'Failed to update salary');
    }
  };

  const handleGenerateMonthlySalaries = async () => {
    Alert.alert(
      'Generate Monthly Salaries',
      `This will create salary expense transactions for all ${teamData.members.filter(m => m.status === 'active').length} active team members. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setLoadingData(true);
            try {
              const result = await teamService.checkAndCreateMonthlySalaries(user.uid);
              if (result.success) {
                Alert.alert(
                  'Success',
                  `Monthly salary expenses generated for ${result.results.filter(r => r.success).length} team members!`
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to generate salary expenses');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to generate salary expenses');
            } finally {
              setLoadingData(false);
            }
          }
        }
      ]
    );
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-left" size={24} color="white" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Team Management</Text>
      <View style={{ width: 40 }} />
    </Animated.View>
  );

  const renderOverview = () => (
    <Animated.View style={[styles.overviewCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.overviewGradient}
      >
        <View style={styles.overviewRow}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Total Employees</Text>
            <Text style={styles.overviewValue}>{teamData.members.length}</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Total Salary</Text>
            <Text style={styles.overviewValue}>{formatCurrency(calculateTotalSalary())}</Text>
          </View>
        </View>
        <View style={styles.overviewRow}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Active Teams</Text>
            <Text style={styles.overviewValue}>{teamData.departments.length}</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Avg Salary</Text>
            <Text style={styles.overviewValue}>
              {formatCurrency(teamData.members.length ? calculateTotalSalary() / teamData.members.length : 0)}
            </Text>
          </View>
        </View>

        {/* Generate Monthly Salaries Button */}
        <TouchableOpacity
          style={styles.generateSalariesButton}
          onPress={handleGenerateMonthlySalaries}
        >
          <Icon name="cash-multiple" size={20} color="white" />
          <Text style={styles.generateSalariesText}>Generate Monthly Salaries</Text>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );

  const renderTabSelector = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tabButton, selectedTab === 'team' && styles.tabButtonActive]}
        onPress={() => setSelectedTab('team')}
      >
        <Text style={[styles.tabText, selectedTab === 'team' && styles.tabTextActive]}>Members</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabButton, selectedTab === 'departments' && styles.tabButtonActive]}
        onPress={() => setSelectedTab('departments')}
      >
        <Text style={[styles.tabText, selectedTab === 'departments' && styles.tabTextActive]}>Teams</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMembersList = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.actionRow}>
        <Text style={styles.sectionTitle}>All Members</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddMemberModal(true)}>
          <Icon name="plus" size={20} color="white" />
          <Text style={styles.addButtonText}>Add Member</Text>
        </TouchableOpacity>
      </View>

      {teamData.members.map((member) => (
        <View key={member.id} style={styles.memberCard}>
          <View style={styles.memberHeader}>
            <View style={styles.memberInfo}>
              <View style={[styles.avatarContainer, { backgroundColor: `${member.color}20` }]}>
                <Icon name={member.avatar} size={24} color={member.color} />
              </View>
              <View>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRole}>{member.role}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: member.status === 'active' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(158, 158, 158, 0.2)' }]}>
              <Text style={[styles.statusText, { color: member.status === 'active' ? '#4CAF50' : '#9E9E9E' }]}>
                {member.status}
              </Text>
            </View>
          </View>

          <View style={styles.memberDetails}>
            <View style={styles.detailItem}>
              <Icon name="email-outline" size={16} color="rgba(255,255,255,0.6)" />
              <Text style={styles.detailText}>{member.email}</Text>
            </View>
            <View style={styles.detailItem}>
              <Icon name="office-building" size={16} color="rgba(255,255,255,0.6)" />
              <Text style={styles.detailText}>{member.department}</Text>
            </View>
          </View>

          <View style={styles.salaryContainer}>
            <View>
              <Text style={styles.salaryLabel}>Annual Salary</Text>
              <Text style={styles.salaryValue}>{formatCurrency(member.salary)}</Text>
            </View>
            <TouchableOpacity style={styles.editSalaryButton} onPress={() => openSalaryEdit(member)}>
              <Icon name="pencil" size={16} color="white" />
              <Text style={styles.editSalaryText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </Animated.View>
  );

  const renderTeamsList = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.actionRow}>
        <Text style={styles.sectionTitle}>Departments & Teams</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddTeamModal(true)}>
          <Icon name="plus" size={20} color="white" />
          <Text style={styles.addButtonText}>Add Team</Text>
        </TouchableOpacity>
      </View>

      {teamData.departments.map((dept, index) => {
        const memberCount = teamData.members.filter(m => m.department === dept.name).length;
        const totalSalary = teamData.members
          .filter(m => m.department === dept.name)
          .reduce((sum, m) => sum + m.salary, 0);

        return (
          <View key={index} style={styles.teamCard}>
            <View style={styles.teamHeader}>
              <View style={[styles.teamIcon, { backgroundColor: `${dept.color}20` }]}>
                <Icon name={dept.icon} size={24} color={dept.color} />
              </View>
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{dept.name}</Text>
                <Text style={styles.teamMembers}>{memberCount} Members</Text>
              </View>
            </View>

            <View style={styles.teamStats}>
              <View style={styles.teamStatItem}>
                <Text style={styles.teamStatLabel}>Budget</Text>
                <Text style={styles.teamStatValue}>{formatCurrency(dept.budget)}</Text>
              </View>
              <View style={styles.teamStatItem}>
                <Text style={styles.teamStatLabel}>Utilized</Text>
                <Text style={[styles.teamStatValue, { color: totalSalary > dept.budget ? '#F44336' : '#4CAF50' }]}>
                  {formatCurrency(totalSalary)}
                </Text>
              </View>
            </View>

            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, (totalSalary / dept.budget) * 100)}%`,
                    backgroundColor: totalSalary > dept.budget ? '#F44336' : dept.color
                  }
                ]}
              />
            </View>
          </View>
        );
      })}
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
          {renderHeader()}

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {renderOverview()}
            {renderTabSelector()}
            {selectedTab === 'team' ? renderMembersList() : renderTeamsList()}
          </ScrollView>
        </SafeAreaView>

        {/* Add Member Modal */}
        <Modal
          visible={showAddMemberModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddMemberModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Team Member</Text>
                <TouchableOpacity onPress={() => setShowAddMemberModal(false)}>
                  <Icon name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={newMember.name}
                onChangeText={(text) => setNewMember({ ...newMember, name: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={newMember.email}
                onChangeText={(text) => setNewMember({ ...newMember, email: text })}
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="Role / Title"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={newMember.role}
                onChangeText={(text) => setNewMember({ ...newMember, role: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Department"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={newMember.department}
                onChangeText={(text) => setNewMember({ ...newMember, department: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Annual Salary (₹)"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={newMember.salary}
                onChangeText={(text) => setNewMember({ ...newMember, salary: text })}
                keyboardType="numeric"
              />

              <TouchableOpacity style={styles.modalButton} onPress={handleCreateMember}>
                <Text style={styles.modalButtonText}>Add Member</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Add Team Modal */}
        <Modal
          visible={showAddTeamModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddTeamModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Team</Text>
                <TouchableOpacity onPress={() => setShowAddTeamModal(false)}>
                  <Icon name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Team Name"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={newTeam.name}
                onChangeText={(text) => setNewTeam({ ...newTeam, name: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Annual Budget (₹)"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={newTeam.budget}
                onChangeText={(text) => setNewTeam({ ...newTeam, budget: text })}
                keyboardType="numeric"
              />

              <TouchableOpacity style={styles.modalButton} onPress={handleCreateTeam}>
                <Text style={styles.modalButtonText}>Create Team</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Edit Salary Modal */}
        <Modal
          visible={showEditSalaryModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowEditSalaryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Update Salary</Text>
                <TouchableOpacity onPress={() => setShowEditSalaryModal(false)}>
                  <Icon name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Set new salary for {selectedMember?.name}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Annual Salary (₹)"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={salaryEdit}
                onChangeText={setSalaryEdit}
                keyboardType="numeric"
              />

              <TouchableOpacity style={styles.modalButton} onPress={handleUpdateSalary}>
                <Text style={styles.modalButtonText}>Update Salary</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  content: {
    flex: 1,
  },

  // Overview Card
  overviewCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  overviewGradient: {
    padding: 20,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  overviewDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 10,
  },
  overviewLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 4,
  },
  overviewValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  generateSalariesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  generateSalariesText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Tab Selector
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: 'white',
  },
  tabText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  tabTextActive: {
    color: theme.primary,
  },

  // Action Row
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addButtonText: {
    color: 'white',
    marginLeft: 4,
    fontWeight: '600',
  },

  // Member Card
  memberCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberRole: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  memberDetails: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  salaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 12,
  },
  salaryLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginBottom: 2,
  },
  salaryValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editSalaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  editSalaryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },

  // Team Card
  teamCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  teamMembers: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  teamStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  teamStatItem: {
    alignItems: 'flex-start',
  },
  teamStatLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 2,
  },
  teamStatValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#2A2A2A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  modalSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  modalButton: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});