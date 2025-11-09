import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';

const { width, height } = Dimensions.get('window');
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

// Dimensions removed as not used

export default function UserTypeScreen({ navigation }) {
  const { theme, isLoading } = useTheme();
  const [selectedType, setSelectedType] = useState(null);
  
  // Simplified animation values for better performance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const personalCardAnim = useRef(new Animated.Value(0.95)).current;
  const companyCardAnim = useRef(new Animated.Value(0.95)).current;

  // Don't render until theme is loaded
  if (isLoading || !theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.loadingBackground || '#f8f9fa', paddingTop: StatusBar.currentHeight || 0 }}>
        <ActivityIndicator size="large" color={theme?.loadingIndicator || '#667eea'} />
      </View>
    );
  }

  useEffect(() => {
    // Clean entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.stagger(150, [
        Animated.spring(personalCardAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(companyCardAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleCardPress = (type) => {
    setSelectedType(type);
    
    const cardAnim = type === 'personal' ? personalCardAnim : companyCardAnim;
    
    // Subtle press feedback
    Animated.sequence([
      Animated.timing(cardAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim, {
        toValue: 1.02,
        tension: 300,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate after animation
      setTimeout(() => {
        navigation.navigate(type === 'personal' ? 'Login' : 'CompanyLogin');
      }, 200);
    });
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />
      
      {/* Modern Background */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.backgroundGradient}
      />
      
      {/* Content Container */}
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* Modern Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Icon name="finance" size={48} color="white" />
          </View>
          <Text style={styles.appTitle}>Expenzo</Text>
          <Text style={styles.welcomeText}>Welcome! Let's get started</Text>
          <Text style={styles.subtitle}>
            Choose your account type to continue
          </Text>
        </View>

        {/* Card Options */}
        <View style={styles.cardsContainer}>
          {/* Personal Card */}
          <Animated.View
            style={[
              styles.cardWrapper,
              { transform: [{ scale: personalCardAnim }] }
            ]}
          >
            <TouchableOpacity
              style={[styles.card, styles.personalCard]}
              onPress={() => handleCardPress('personal')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#4facfe', '#00f2fe']}
                style={styles.cardGradient}
              >
                <View style={styles.cardContent}>
                  <View style={styles.cardIcon}>
                    <Icon name="account-circle" size={40} color="white" />
                  </View>
                  <Text style={styles.cardTitle}>Personal</Text>
                  <Text style={styles.cardSubtitle}>Individual Finance</Text>
                  <View style={styles.cardFeatures}>
                    <View style={styles.featureRow}>
                      <Icon name="check-circle" size={16} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.featureText}>Personal budgeting</Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Icon name="check-circle" size={16} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.featureText}>Expense tracking</Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Icon name="check-circle" size={16} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.featureText}>Financial goals</Text>
                    </View>
                  </View>
                  <View style={styles.cardArrow}>
                    <Icon name="arrow-right" size={20} color="white" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Company Card */}
          <Animated.View
            style={[
              styles.cardWrapper,
              { transform: [{ scale: companyCardAnim }] }
            ]}
          >
            <TouchableOpacity
              style={[styles.card, styles.companyCard]}
              onPress={() => handleCardPress('company')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#a18cd1', '#fbc2eb']}
                style={styles.cardGradient}
              >
                <View style={styles.cardContent}>
                  <View style={styles.cardIcon}>
                    <Icon name="office-building" size={40} color="white" />
                  </View>
                  <Text style={styles.cardTitle}>Business</Text>
                  <Text style={styles.cardSubtitle}>Company Finance</Text>
                  <View style={styles.cardFeatures}>
                    <View style={styles.featureRow}>
                      <Icon name="check-circle" size={16} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.featureText}>Business analytics</Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Icon name="check-circle" size={16} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.featureText}>Team management</Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Icon name="check-circle" size={16} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.featureText}>Company reports</Text>
                    </View>
                  </View>
                  <View style={styles.cardArrow}>
                    <Icon name="arrow-right" size={20} color="white" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Don't worry, you can always change this later in settings
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    paddingTop: Math.max(StatusBar.currentHeight || 0, 40) + 20,
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
  },
  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
    letterSpacing: 1,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  cardsContainer: {
    flex: 0,
    paddingVertical: 20,
  },
  cardWrapper: {
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    marginBottom: 16,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardGradient: {
    borderRadius: 20,
  },
  cardContent: {
    padding: 20,
    minHeight: 160,
    position: 'relative',
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: Math.min(24, width * 0.06),
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: Math.min(14, width * 0.035),
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
    fontWeight: '500',
  },
  cardFeatures: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: Math.min(14, width * 0.035),
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    flex: 1,
  },
  cardArrow: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    paddingHorizontal: 30,
    paddingBottom: 20,
    minHeight: 60,
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
    flexWrap: 'wrap',
    maxWidth: width - 60,
  },
});