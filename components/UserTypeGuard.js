import React from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function UserTypeGuard({ children, requiredUserType }) {
  const { user, userData, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  if (!isAuthenticated || !user || userData?.userType !== requiredUserType) {
    return <View style={{ flex: 1, padding: 24, backgroundColor: theme.background }}>
      <Text style={{ color: theme.text }}>This screen is unavailable for this account.</Text>
    </View>;
  }
  return children;
}
