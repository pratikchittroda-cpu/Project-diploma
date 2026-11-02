import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as NativeSplashScreen from 'expo-splash-screen';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import SplashScreen from '../screens/personal/SplashScreen';
import UserTypeScreen from '../screens/personal/UserTypeScreen';
import LoginScreen from '../screens/personal/LoginScreen';
import SignUpScreen from '../screens/personal/SignUpScreen';
import CompanyLoginScreen from '../screens/company/CompanyLoginScreen';
import CompanySignUpScreen from '../screens/company/CompanySignUpScreen';
import ProfileScreen from '../screens/personal/ProfileScreen';
import CompanyProfileScreen from '../screens/company/CompanyProfileScreen';
import EditProfileScreen from '../screens/personal/EditProfileScreen';
import AIChatScreen from '../screens/personal/AIChatScreen';
import EditCompanyProfileScreen from '../screens/company/EditCompanyProfileScreen';
import SettingsScreen from '../screens/personal/SettingsScreen';
import CompanySettingsScreen from '../screens/company/CompanySettingsScreen';
import SecuritySettingsScreen from '../screens/personal/SecuritySettingsScreen';
import BackupRestoreScreen from '../screens/personal/BackupRestoreScreen';
import BillingSubscriptionScreen from '../screens/company/BillingSubscriptionScreen';
import ThemesScreen from '../screens/personal/ThemesScreen';
import PrivacyScreen from '../screens/personal/PrivacyScreen';
import AccountRecovery from '../components/account/AccountRecovery';
import CompanyReportsScreen from '../screens/company/CompanyReportsScreen';
import TeamManagementScreen from '../screens/company/TeamManagementScreen';
import CompanyBudgetScreen from '../screens/company/CompanyBudgetScreen';
import CompanyTransactionsScreen from '../screens/company/CompanyTransactionsScreen';
import AddCompanyTransactionScreen from '../screens/company/AddCompanyTransactionScreen';
import CompanyTabNavigator from './CompanyTabNavigator';
import TabNavigator from './TabNavigator';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { theme, isDarkMode, isLoading } = useTheme();
  const { user, userData, profileStatus, initializing } = useAuth();
  if (isLoading || !theme || initializing || profileStatus === 'loading') return <SplashScreen />;
  const profileComplete = userData?.profileComplete;
  const ready = !!user && profileStatus === 'ready' && ['personal', 'company'].includes(userData?.userType)
    && (profileComplete === undefined || profileComplete === true);
  const company = ready && userData.userType === 'company';
  const sessionKey = user ? `${user.uid}:${ready ? userData.userType : 'recovery'}` : 'signed-out';
  const base = isDarkMode ? DarkTheme : DefaultTheme;
  const navigationTheme = { ...base, colors: { ...base.colors, primary: theme.primary, background: theme.background,
    card: theme.surface || theme.background, text: theme.text, border: theme.border, notification: theme.primary } };

  // Recreate the entire navigation tree across UID/type/logout. Protected routes simply do not exist when signed out.
  return <NavigationContainer key={sessionKey} theme={navigationTheme} onReady={() => NativeSplashScreen.hideAsync().catch(() => {})}>
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right',
      contentStyle: { backgroundColor: theme.background } }}>
      {!user ? <>
        <Stack.Screen name="UserType" component={UserTypeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={SignUpScreen} />
        <Stack.Screen name="CompanyLogin" component={CompanyLoginScreen} />
        <Stack.Screen name="CompanyRegister" component={CompanySignUpScreen} />
      </> : !ready ? <Stack.Screen name="AccountRecovery" component={AccountRecovery} /> : company ? <>
        <Stack.Screen name="CompanyDashboard" component={CompanyTabNavigator} options={{ animation: 'fade' }} />
        <Stack.Screen name="CompanyProfile" component={CompanyProfileScreen} />
        <Stack.Screen name="EditCompanyProfile" component={EditCompanyProfileScreen} />
        <Stack.Screen name="CompanySettings" component={CompanySettingsScreen} />
        <Stack.Screen name="BillingSubscription" component={BillingSubscriptionScreen} />
        <Stack.Screen name="CompanyReportsDetail" component={CompanyReportsScreen} />
        <Stack.Screen name="TeamManagementDetail" component={TeamManagementScreen} />
        <Stack.Screen name="CompanyBudgetDetail" component={CompanyBudgetScreen} />
        <Stack.Screen name="CompanyTransactions" component={CompanyTransactionsScreen} />
        <Stack.Screen name="AddCompanyTransactionDetail" component={AddCompanyTransactionScreen} options={{ animation: 'slide_from_bottom' }} />
      </> : <>
        <Stack.Screen name="Dashboard" component={TabNavigator} options={{ animation: 'fade' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} />
      </>}
      {ready && <>
        <Stack.Screen name="AIChat" component={AIChatScreen} />
        <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
        <Stack.Screen name="Themes" component={ThemesScreen} />
      </>}
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
    </Stack.Navigator>
  </NavigationContainer>;
}
