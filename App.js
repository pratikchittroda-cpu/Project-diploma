import { View, StatusBar } from 'react-native';
import * as NativeSplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import MessageBoxProvider from './components/MessageBoxProvider';

WebBrowser.maybeCompleteAuthSession();

NativeSplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may already be controlled or hidden.
});

const AppContent = () => {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme?.background || '#f8f9fa' }}>
      <StatusBar
        barStyle={theme?.background === '#121212' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />
      <AppNavigator />
    </View>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <MessageBoxProvider>
          <AppContent />
        </MessageBoxProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
