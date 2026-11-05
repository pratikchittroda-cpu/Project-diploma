import { useEffect, useRef, useState } from 'react';
import { View, Text, StatusBar, Animated, StyleSheet } from 'react-native';
import * as NativeSplashScreen from 'expo-splash-screen';
import { enableFreeze, enableScreens } from 'react-native-screens';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import SplashScreen from './screens/personal/SplashScreen';
import MessageBoxProvider from './components/MessageBoxProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { firebaseConfigured } from './config/firebase';
import { SERVER_FEATURES_ENABLED } from './config/releaseFeatures';
import { registerBackendAppCheck } from './utils/appCheck';
import { useAppFonts } from './theme/fonts';

if (SERVER_FEATURES_ENABLED) registerBackendAppCheck();

enableScreens(true);
enableFreeze(true);

NativeSplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may already be controlled or hidden.
});

// On launch the branded splash stays on top until its intro has played, even when auth
// resolves sooner; the navigator mounts underneath so the hand-off is instant.
const LaunchSplash = () => {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  if (!visible) return null;
  const finish = () => Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true })
    .start(() => setVisible(false));
  return <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
    <SplashScreen onFinish={finish} />
  </Animated.View>;
};

const AppContent = () => {
  const { theme, isDarkMode } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme?.background || '#f8f9fa' }}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />
      <AppNavigator />
      <LaunchSplash />
    </View>
  );
};

export default function App() {
  const fontsReady = useAppFonts();
  useEffect(() => {
    if (!firebaseConfigured) NativeSplashScreen.hideAsync().catch(() => {});
  }, []);

  // The native launch screen stays up while the brand fonts register (a moment, bundled files).
  if (!fontsReady) return null;

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
