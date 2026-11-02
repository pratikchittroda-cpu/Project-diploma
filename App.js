import { useEffect } from 'react';
import { View, Text, StatusBar } from 'react-native';
import * as NativeSplashScreen from 'expo-splash-screen';
import { enableFreeze, enableScreens } from 'react-native-screens';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import MessageBoxProvider from './components/MessageBoxProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { firebaseConfigured } from './config/firebase';
import { SERVER_FEATURES_ENABLED } from './config/releaseFeatures';
import { registerBackendAppCheck } from './utils/appCheck';

if (SERVER_FEATURES_ENABLED) registerBackendAppCheck();

enableScreens(true);
enableFreeze(true);

NativeSplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may already be controlled or hidden.
});

const AppContent = () => {
  const { theme, isDarkMode } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme?.background || '#f8f9fa' }}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />
      <AppNavigator />
    </View>
  );
};

export default function App() {
  useEffect(() => {
    if (!firebaseConfigured) NativeSplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        {firebaseConfigured ? (
          <ThemeProvider>
            <AuthProvider>
              <MessageBoxProvider>
                <AppContent />
              </MessageBoxProvider>
            </AuthProvider>
          </ThemeProvider>
        ) : (
          <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
            <Text accessibilityRole="header" style={{ fontSize: 24, color: '#111', marginBottom: 12 }}>Setup required</Text>
            <Text style={{ color: '#333' }}>This build is missing its public Firebase configuration. Configure the build environment and rebuild Expenzo.</Text>
          </SafeAreaView>
        )}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
