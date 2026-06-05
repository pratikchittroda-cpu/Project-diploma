import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CompanyDashboardScreen from '../screens/company/CompanyDashboardScreen';
import CompanyReportsScreen from '../screens/company/CompanyReportsScreen';
import TeamManagementScreen from '../screens/company/TeamManagementScreen';
import CompanyBudgetScreen from '../screens/company/CompanyBudgetScreen';
import AddCompanyTransactionScreen from '../screens/company/AddCompanyTransactionScreen';
import { useTheme } from '../contexts/ThemeContext';
import OptimizedTabBar, { TabLoadingState, tabScreenOptions } from './SharedTabBar';

const Tab = createBottomTabNavigator();

const tabIcons = {
  CompanyHome: (focused) => (focused ? 'view-dashboard' : 'view-dashboard-outline'),
  CompanyReports: (focused) => (focused ? 'chart-line' : 'chart-line-variant'),
  AddCompanyTransaction: (focused) => (focused ? 'plus-circle' : 'plus-circle-outline'),
  TeamManagement: (focused) => (focused ? 'account-group' : 'account-group-outline'),
  CompanyBudget: (focused) => (focused ? 'calculator' : 'calculator-variant'),
};

export default function CompanyTabNavigator() {
  const { theme, isLoading } = useTheme();

  if (isLoading || !theme) {
    return <TabLoadingState />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Tab.Navigator
        tabBar={(props) => (
          <OptimizedTabBar
            {...props}
            addRouteName="AddCompanyTransaction"
            initialRouteName="CompanyHome"
            icons={tabIcons}
          />
        )}
        screenOptions={tabScreenOptions}
      >
        <Tab.Screen name="CompanyHome" component={CompanyDashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
        <Tab.Screen name="CompanyReports" component={CompanyReportsScreen} options={{ tabBarLabel: 'Reports' }} />
        <Tab.Screen name="AddCompanyTransaction" component={AddCompanyTransactionScreen} options={{ tabBarLabel: 'Add' }} />
        <Tab.Screen name="TeamManagement" component={TeamManagementScreen} options={{ tabBarLabel: 'Team' }} />
        <Tab.Screen name="CompanyBudget" component={CompanyBudgetScreen} options={{ tabBarLabel: 'Budget' }} />
      </Tab.Navigator>
    </View>
  );
}
