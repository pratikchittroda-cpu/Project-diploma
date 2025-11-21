import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import UserTypeScreen from '../screens/UserTypeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import CompanyLoginScreen from '../screens/CompanyLoginScreen';
import CompanySignUpScreen from '../screens/CompanySignUpScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CompanyProfileScreen from '../screens/CompanyProfileScreen';
import CompanyReportsScreen from '../screens/CompanyReportsScreen';
import TeamManagementScreen from '../screens/TeamManagementScreen';
import CompanyBudgetScreen from '../screens/CompanyBudgetScreen';
import AddCompanyTransactionScreen from '../screens/AddCompanyTransactionScreen';
// Personal Profile Screens
import EditProfileScreen from '../screens/EditProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SecuritySettingsScreen from '../screens/SecuritySettingsScreen';
import BackupRestoreScreen from '../screens/BackupRestoreScreen';
import ThemesScreen from '../screens/ThemesScreen';
// Company Profile Screens
import EditCompanyProfileScreen from '../screens/EditCompanyProfileScreen';
import CompanySettingsScreen from '../screens/CompanySettingsScreen';
import BillingSubscriptionScreen from '../screens/BillingSubscriptionScreen';
import CompanyTabNavigator from './CompanyTabNavigator';
import TabNavigator from './TabNavigator';
import { screenAnimations } from './AnimationConfig';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const Stack = createNativeStackNavigator();

// Main Stack Navigator
export default function AppNavigator() {
  const { theme, isLoading } = useTheme();
  const { user, userData, initializing } = useAuth();

  // Don't render navigation until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  // Always start with SplashScreen - it will handle navigation based on auth state
  const getInitialRouteName = () => {
    return 'Splash';
  };

  // Create theme-aware navigation theme based on React Navigation defaults
  const isDark = theme.background === '#121212';
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      notification: theme.primary,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName={getInitialRouteName()}
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={screenAnimations.splash}
        />
        <Stack.Screen
          name="UserType"
          component={UserTypeScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 400,
          }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={screenAnimations.login}
        />
        <Stack.Screen
          name="Register"
          component={SignUpScreen}
          options={screenAnimations.signup}
        />
        <Stack.Screen
          name="CompanyLogin"
          component={CompanyLoginScreen}
          options={screenAnimations.login}
        />
        <Stack.Screen
          name="CompanyRegister"
          component={CompanySignUpScreen}
          options={screenAnimations.signup}
        />
        <Stack.Screen
          name="Dashboard"
          component={TabNavigator}
          options={{
            animation: 'fade',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="CompanyDashboard"
          component={CompanyTabNavigator}
          options={{
            animation: 'fade',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            animation: 'fade',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="CompanyProfile"
          component={CompanyProfileScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="CompanyReportsDetail"
          component={CompanyReportsScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="TeamManagementDetail"
          component={TeamManagementScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="CompanyBudgetDetail"
          component={CompanyBudgetScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="AddCompanyTransactionDetail"
          component={AddCompanyTransactionScreen}
          options={{
            animation: 'slide_from_bottom',
            animationDuration: 300,
          }}
        />

        {/* Personal Profile Screens */}
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="SecuritySettings"
          component={SecuritySettingsScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="BackupRestore"
          component={BackupRestoreScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="Themes"
          component={ThemesScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />

        {/* Company Profile Screens */}
        <Stack.Screen
          name="EditCompanyProfile"
          component={EditCompanyProfileScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="CompanySettings"
          component={CompanySettingsScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="BillingSubscription"
          component={BillingSubscriptionScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}