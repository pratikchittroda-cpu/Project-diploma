import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const UserTypeGuard = ({ children, requiredUserType, navigation }) => {
  const { userData } = useAuth();
  const { theme } = useTheme();

  // TEMPORARILY DISABLED: Allow all users to access all features
  // If we want to re-enable, uncomment the logic below
  /*
  // If user type doesn't match required type, show access denied
  if (userData && userData.userType !== requiredUserType) {
    const isPersonalTryingCompany = userData.userType === 'personal' && requiredUserType === 'company';
    const isCompanyTryingPersonal = userData.userType === 'company' && requiredUserType === 'personal';

    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
          <Icon 
            name={isPersonalTryingCompany ? "office-building" : "account"} 
            size={64} 
            color={theme.error} 
          />
          <Text style={[styles.title, { color: theme.text }]}>
            Access Restricted
          </Text>
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {isPersonalTryingCompany 
              ? "This is a Company feature. Your account is registered as Personal."
              : "This is a Personal feature. Your account is registered as Company."
            }
          </Text>
          <Text style={[styles.submessage, { color: theme.textLight }]}>
            {isPersonalTryingCompany
              ? "To access Company features, please create a Company account."
              : "To access Personal features, please create a Personal account."
            }
          </Text>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => {
              // Navigate back to appropriate dashboard
              if (userData.userType === 'company') {
                navigation.replace('CompanyDashboard');
              } else {
                navigation.replace('Dashboard');
              }
            }}
          >
            <Icon name="arrow-left" size={20} color="white" />
            <Text style={styles.buttonText}>
              Go to {userData.userType === 'company' ? 'Company' : 'Personal'} Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  */

  // If user type matches or no restriction needed, render children
  return children;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxWidth: 350,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 15,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 10,
  },
  submessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UserTypeGuard;