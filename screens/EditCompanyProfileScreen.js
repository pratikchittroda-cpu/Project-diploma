import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

export default function EditCompanyProfileScreen({ navigation }) {
  const { theme } = useTheme();
  const [companyInfo, setCompanyInfo] = useState({
    companyName: 'TechCorp Solutions',
    adminName: 'Sarah Johnson',
    adminEmail: 'sarah.johnson@techcorp.com',
    companyPhone: '+1 (555) 987-6543',
    companyAddress: '123 Business Ave, Tech City, TC 12345',
    industry: 'Technology',
    website: 'https://techcorp.com',
    description: 'Leading technology solutions provider specializing in innovative software development and digital transformation.',
    taxId: 'TC-2024-001',
    establishedDate: '2020-03-15',
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
        id: 'EditCompanyProfile',
        title: 'Edit Company Profile',
        icon: 'office-building-cog',
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

  const handleSave = () => {
    Alert.alert(
      'Company Profile Updated',
      'Your company information has been saved successfully!',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  const handleInputChange = (field, value) => {
    setCompanyInfo(prev => ({ ...prev, [field]: value }));
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
        <Text style={styles.headerTitle}>Edit Company Profile</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Icon name="check" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );

  const renderFormField = (label, field, icon, placeholder, multiline = false, keyboardType = 'default') => (
    <Animated.View style={[styles.fieldContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputContainer}>
        <Icon name={icon} size={20} color={theme.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={[styles.textInput, multiline && styles.multilineInput]}
          value={companyInfo[field]}
          onChangeText={(value) => handleInputChange(field, value)}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          keyboardType={keyboardType}
        />
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
        {renderSection('Company Information', (
          <>
            {renderFormField('Company Name', 'companyName', 'office-building', 'Enter company name')}
            {renderFormField('Industry', 'industry', 'domain', 'Enter industry type')}
            {renderFormField('Website', 'website', 'web', 'Enter company website', false, 'url')}
            {renderFormField('Tax ID', 'taxId', 'identifier', 'Enter tax identification number')}
            {renderFormField('Established Date', 'establishedDate', 'calendar', 'YYYY-MM-DD', false, 'numeric')}
            {renderFormField('Description', 'description', 'text', 'Describe your company', true)}
          </>
        ))}

        {renderSection('Contact Information', (
          <>
            {renderFormField('Company Phone', 'companyPhone', 'phone', 'Enter company phone', false, 'phone-pad')}
            {renderFormField('Company Address', 'companyAddress', 'map-marker', 'Enter company address', true)}
          </>
        ))}

        {renderSection('Administrator Details', (
          <>
            {renderFormField('Administrator Name', 'adminName', 'account-tie', 'Enter admin name')}
            {renderFormField('Administrator Email', 'adminEmail', 'email', 'Enter admin email', false, 'email-address')}
          </>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    flex: 1,
  },
  saveButton: {
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
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingHorizontal: 15,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
    paddingVertical: 0,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
});