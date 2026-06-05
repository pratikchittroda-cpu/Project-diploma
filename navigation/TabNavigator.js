import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/personal/DashboardScreen';
import AddTransactionScreen from '../screens/personal/AddTransactionScreen';
import TransactionsScreen from '../screens/personal/TransactionsScreen';
import BudgetScreen from '../screens/personal/BudgetScreen';
import StatsScreen from '../screens/personal/StatsScreen';
import { useTheme } from '../contexts/ThemeContext';
import OptimizedTabBar, { TabLoadingState, tabScreenOptions } from './SharedTabBar';

const Tab = createBottomTabNavigator();

const tabIcons = {
  Home: (focused) => (focused ? 'home' : 'home-outline'),
  Transactions: (focused) => (focused ? 'swap-vertical' : 'swap-vertical-variant'),
  AddTransaction: (focused) => (focused ? 'plus-circle' : 'plus-circle-outline'),
  Budget: (focused) => (focused ? 'wallet' : 'wallet-outline'),
  Stats: (focused) => (focused ? 'chart-pie' : 'chart-line'),
};

export default function TabNavigator() {
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
            addRouteName="AddTransaction"
            initialRouteName="Home"
            icons={tabIcons}
          />
        )}
        screenOptions={tabScreenOptions}
      >
        <Tab.Screen name="Home" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
        <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ tabBarLabel: 'Transactions' }} />
        <Tab.Screen name="AddTransaction" component={AddTransactionScreen} options={{ tabBarLabel: 'Add' }} />
        <Tab.Screen name="Budget" component={BudgetScreen} options={{ tabBarLabel: 'Budget' }} />
        <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: 'Stats' }} />
      </Tab.Navigator>
    </View>
  );
}
