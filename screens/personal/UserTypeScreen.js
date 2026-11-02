import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import BrandLogo from '../../components/BrandLogo';
import { accountGradientColors } from '../../components/account/AccountPrimitives';
import SplashScreen from './SplashScreen';

const accountTypes = [
  { id: 'personal', title: 'Personal', subtitle: 'Individual Finance', icon: 'account-circle', route: 'Login',
    features: ['Personal budgeting', 'Expense tracking', 'Spending insights'] },
  { id: 'company', title: 'Business', subtitle: 'Company Finance', icon: 'office-building', route: 'CompanyLogin',
    features: ['Company expense tracking', 'Employee records', 'Financial reports'] },
];

export default function UserTypeScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isLoading) return;
    const animation = Animated.timing(entrance, { toValue: 1, duration: 600, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [entrance, isLoading]);
  if (isLoading || !theme) return <SplashScreen />;
  const gradient = accountGradientColors(theme);

  return <View style={[styles.page, { backgroundColor: theme.primary }]}>
    <StatusBar barStyle="light-content" />
    <LinearGradient colors={gradient} style={StyleSheet.absoluteFill}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    <SafeAreaView style={styles.page}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
          <View style={styles.header}>
            <View style={styles.logo}><BrandLogo size={44} /></View>
            <Text accessibilityRole="header" style={styles.appTitle}>Expenzo</Text>
            <Text style={styles.welcome}>Welcome! Let's get started</Text>
            <Text style={styles.subtitle}>Choose your account type to continue</Text>
          </View>
          <View style={styles.cards}>
            {accountTypes.map((account) => <TouchableOpacity key={account.id} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel={account.id === 'company' ? 'Company account' : 'Personal account'}
              accessibilityHint={`Sign in or create a ${account.id} account`}
              onPress={() => navigation.navigate(account.route)} style={styles.card}>
              <LinearGradient colors={account.id === 'personal' ? gradient : [...gradient].reverse()}
                style={styles.cardContent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.cardIcon}><MaterialCommunityIcons name={account.icon} size={36} color="#fff" /></View>
                <Text style={styles.cardTitle}>{account.title}</Text>
                <Text style={styles.cardSubtitle}>{account.subtitle}</Text>
                <View style={styles.features}>
                  {account.features.map((feature) => <View key={feature} style={styles.feature}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>)}
                </View>
                <View style={styles.arrow}><MaterialCommunityIcons name="arrow-right" size={22} color="#fff" /></View>
              </LinearGradient>
            </TouchableOpacity>)}
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Choose the type you registered with, or create a new account.</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Privacy')} style={styles.privacyLink}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color="#fff" />
              <Text style={styles.privacyText}>Privacy & data</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#f3f5ff', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  appTitle: { fontSize: 30, fontWeight: '800', letterSpacing: 1, color: '#fff', marginBottom: 8 },
  welcome: { fontSize: 17, fontWeight: '600', color: '#fff', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  cards: { gap: 16 },
  card: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  cardContent: { padding: 22, minHeight: 240 },
  cardIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 3 },
  cardSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 18 },
  features: { gap: 8 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { color: 'rgba(255,255,255,0.95)', fontSize: 14, flex: 1 },
  arrow: { position: 'absolute', top: 24, right: 22, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', marginTop: 26, paddingHorizontal: 12 },
  footerText: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: 14, lineHeight: 21 },
  privacyLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, marginTop: 8, paddingHorizontal: 12 },
  privacyText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
