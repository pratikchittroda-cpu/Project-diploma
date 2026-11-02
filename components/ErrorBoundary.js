import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

export default class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch() {
    // No financial data, raw exceptions or component props are sent to a third party.
    SplashScreen.hideAsync().catch(() => {});
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <SafeAreaView style={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>Expenzo could not display this screen. Try reopening it. If the problem continues, restart the app.</Text>
        <Pressable accessibilityRole="button" onPress={() => this.setState({ failed: false })} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12, color: '#111' },
  body: { color: '#333', fontSize: 16, lineHeight: 24 },
  button: { marginTop: 24, minHeight: 48, padding: 14, backgroundColor: '#334ac0', borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
