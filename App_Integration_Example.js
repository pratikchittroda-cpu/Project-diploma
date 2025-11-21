// Example of how to integrate the MessageBoxProvider into your main App component

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

// Import your existing providers
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Import the new MessageBoxProvider
import MessageBoxProvider from './components/MessageBoxProvider';

// Import your screens
import SplashScreen from './screens/SplashScreen';
import UserTypeScreen from './screens/UserTypeScreen';
import LoginScreen from './screens/LoginScreen';
import CompanyBudgetScreen from './screens/CompanyBudgetScreen';
// ... other screens

const Stack = createStackNavigator();

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MessageBoxProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <Stack.Navigator
              initialRouteName="Splash"
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                cardStyleInterpolator: ({ current, layouts }) => {
                  return {
                    cardStyle: {
                      transform: [
                        {
                          translateX: current.progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [layouts.screen.width, 0],
                          }),
                        },
                      ],
                    },
                  };
                },
              }}
            >
              <Stack.Screen name="Splash" component={SplashScreen} />
              <Stack.Screen name="UserType" component={UserTypeScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="CompanyBudget" component={CompanyBudgetScreen} />
              {/* Add all your other screens here */}
            </Stack.Navigator>
          </NavigationContainer>
        </MessageBoxProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Alternative: Using the global MessageService (no need to add hook to each screen)
// You can use this approach if you prefer not to add the hook to every screen

// In any screen, you can now use:
// import { showSuccess, showError, showConfirm } from '../services/MessageService';
// 
// showSuccess('Success!', 'Operation completed successfully');
// showError('Error', 'Something went wrong');
// showConfirm('Confirm', 'Are you sure?', () => {
//   // Handle confirm
// }, () => {
//   // Handle cancel
// });