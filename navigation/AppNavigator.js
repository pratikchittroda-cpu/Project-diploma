import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/personal/SplashScreen';
import UserTypeScreen from '../screens/personal/UserTypeScreen';
import LoginScreen from '../screens/personal/LoginScreen';
import SignUpScreen from '../screens/personal/SignUpScreen';
import CompanyLoginScreen from '../screens/company/CompanyLoginScreen';
import CompanySignUpScreen from '../screens/company/CompanySignUpScreen';
import ProfileScreen from '../screens/personal/ProfileScreen';
import CompanyProfileScreen from '../screens/company/CompanyProfileScreen';
import CompanyReportsScreen from '../screens/company/CompanyReportsScreen';
import TeamManagementScreen from '../screens/company/TeamManagementScreen';
import CompanyBudgetScreen from '../screens/company/CompanyBudgetScreen';
import CompanyTransactionsScreen from '../screens/company/CompanyTransactionsScreen';
import AddCompanyTransactionScreen from '../screens/company/AddCompanyTransactionScreen';
import AIChatScreen from '../screens/personal/AIChatScreen';
// Personal Profile Screens
import EditProfileScreen from '../screens/personal/EditProfileScreen';
import SettingsScreen from '../screens/personal/SettingsScreen';
import SecuritySettingsScreen from '../screens/personal/SecuritySettingsScreen';
import BackupRestoreScreen from '../screens/personal/BackupRestoreScreen';
import ThemesScreen from '../screens/personal/ThemesScreen';
// Company Profile Screens
import EditCompanyProfileScreen from '../screens/company/EditCompanyProfileScreen';
import CompanySettingsScreen from '../screens/company/CompanySettingsScreen';
import BillingSubscriptionScreen from '../screens/company/BillingSubscriptionScreen';
import CompanyTabNavigator from './CompanyTabNavigator';
import TabNavigator from './TabNavigator';
import { screenAnimations } from './AnimationConfig';
import { useTheme } from '../contexts/ThemeContext';

const Stack = createNativeStackNavigator();

// Main Stack Navigator
export default function AppNavigator() {
  const { theme } = useTheme();

  // Always start with JS splash; it decides next route.
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
          contentStyle: {
            backgroundColor: theme.background,
          },
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
          name="CompanyTransactions"
          component={CompanyTransactionsScreen}
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
        <Stack.Screen
          name="AIChat"
          component={AIChatScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
            contentStyle: {
              backgroundColor: theme.background,
            },
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
