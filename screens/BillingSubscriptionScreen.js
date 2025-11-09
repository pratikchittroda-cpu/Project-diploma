import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

export default function BillingSubscriptionScreen({ navigation }) {
  const { theme } = useTheme();
  const [subscriptionInfo, setSubscriptionInfo] = useState({
    currentPlan: 'Business Pro',
    planPrice: 49.99,
    billingCycle: 'monthly',
    nextBilling: '2024-02-15',
    paymentMethod: '**** **** **** 4532',
    status: 'active',
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Plan options
  const planOptions = [
    {
      id: 'starter',
      name: 'Starter',
      price: 19.99,
      features: ['Up to 5 users', 'Basic reporting', 'Email support', '1GB storage'],
      color: theme.iconBackground.blue,
      iconColor: theme.info,
    },
    {
      id: 'business',
      name: 'Business Pro',
      price: 49.99,
      features: ['Up to 25 users', 'Advanced reporting', 'Priority support', '10GB storage', 'API access'],
      color: theme.iconBackground.green,
      iconColor: theme.success,
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 99.99,
      features: ['Unlimited users', 'Custom reporting', '24/7 support', '100GB storage', 'White-label', 'SSO'],
      color: theme.iconBackground.purple,
      iconColor: '#9C27B0',
    },
  ];

  // Recent actions tracking
  const trackScreenVisit = async () => {
    try {
      const recentActions = await AsyncStorage.getItem('companyRecentActions');
      let actions = recentActions ? JSON.parse(recentActions) : [];
      
      const screenData = {
        id: 'BillingSubscription',
        title: 'Billing & Subscription',
        icon: 'credit-card',
        timestamp: Date.now(),
      };
      
      actions = actions.filter(action => action.id !== screenData.id);
      actions.unshift(screenData);
      actions = actions.slice(0, 4);
      
      await AsyncStorage.setItem('companyRecentActions', JSON.stringify(actions));
    } catch (error) {
      }
  };

  useEffect(() => {
    trackScreenVisit();
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const unsubscribe = navigation.addListener('focus', () => {
      trackScreenVisit();
    });

    return unsubscribe;
  }, [navigation]);

  const handleUpgradePlan = (plan) => {
    Alert.alert(
      'Upgrade Plan',
      `Upgrade to ${plan.name} for ₹${plan.price}/month?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upgrade',
          onPress: () => {
            Alert.alert('Success', `Successfully upgraded to ${plan.name}!`);
            setSubscriptionInfo(prev => ({
              ...prev,
              currentPlan: plan.name,
              planPrice: plan.price,
            }));
          }
        }
      ]
    );
  };

  const handleUpdatePayment = () => {
    Alert.alert(
      'Update Payment Method',
      'You will be redirected to update your payment information securely.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Update', onPress: () => Alert.alert('Success', 'Payment method updated!') }
      ]
    );
  };

  const handleViewInvoices = () => {
    Alert.alert(
      'Billing History',
      'View and download your past invoices and receipts.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View History', onPress: () => Alert.alert('Coming Soon', 'Invoice history will be available soon!') }
      ]
    );
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => Alert.alert('Subscription Cancelled', 'Your subscription will end at the next billing cycle.')
        }
      ]
    );
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.headerGradient}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Billing & Subscription</Text>
        <View style={styles.placeholder} />
      </LinearGradient>
    </Animated.View>
  );

  const renderCurrentPlan = () => (
    <Animated.View style={[styles.currentPlanCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.planHeader}>
        <View style={styles.planInfo}>
          <Text style={styles.planName}>{subscriptionInfo.currentPlan}</Text>
          <Text style={styles.planPrice}>${subscriptionInfo.planPrice}/month</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: theme.iconBackground.green }]}>
          <Text style={[styles.statusText, { color: theme.success }]}>Active</Text>
        </View>
      </View>
      
      <View style={styles.billingInfo}>
        <View style={styles.billingRow}>
          <Text style={styles.billingLabel}>Next billing:</Text>
          <Text style={styles.billingValue}>{subscriptionInfo.nextBilling}</Text>
        </View>
        <View style={styles.billingRow}>
          <Text style={styles.billingLabel}>Payment method:</Text>
          <Text style={styles.billingValue}>{subscriptionInfo.paymentMethod}</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderPlanCard = (plan) => {
    const isCurrentPlan = plan.name === subscriptionInfo.currentPlan;
    
    return (
      <Animated.View
        key={plan.id}
        style={[
          styles.planCard,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          isCurrentPlan && styles.currentPlanHighlight
        ]}
      >
        {plan.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>Most Popular</Text>
          </View>
        )}
        
        <View style={styles.planCardHeader}>
          <View style={[styles.planIcon, { backgroundColor: plan.color }]}>
            <Icon name="crown" size={24} color={plan.iconColor} />
          </View>
          <View style={styles.planDetails}>
            <Text style={styles.planCardName}>{plan.name}</Text>
            <Text style={styles.planCardPrice}>${plan.price}/month</Text>
          </View>
        </View>
        
        <View style={styles.featuresContainer}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Icon name="check" size={16} color={theme.success} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
        
        <TouchableOpacity
          style={[
            styles.planButton,
            isCurrentPlan ? styles.currentPlanButton : styles.upgradePlanButton
          ]}
          onPress={() => !isCurrentPlan && handleUpgradePlan(plan)}
          disabled={isCurrentPlan}
        >
          <Text style={[
            styles.planButtonText,
            isCurrentPlan ? styles.currentPlanButtonText : styles.upgradePlanButtonText
          ]}>
            {isCurrentPlan ? 'Current Plan' : 'Upgrade'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderActionButton = (title, subtitle, icon, onPress, iconColor, backgroundColor) => (
    <TouchableOpacity onPress={onPress}>
      <Animated.View style={[styles.actionButton, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.actionLeft}>
          <View style={[styles.actionIcon, { backgroundColor }]}>
            <Icon name={icon} size={22} color={iconColor} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionSubtitle}>{subtitle}</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={20} color={theme.textLight} />
      </Animated.View>
    </TouchableOpacity>
  );

  const renderSection = (title, children) => (
    <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Animated.View>
  );

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderSection('Current Subscription', renderCurrentPlan())}

        {renderSection('Available Plans', (
          <View style={styles.plansContainer}>
            {planOptions.map(plan => renderPlanCard(plan))}
          </View>
        ))}

        {renderSection('Billing Management', (
          <>
            {renderActionButton(
              'Update Payment Method',
              'Change your credit card or payment details',
              'credit-card-edit',
              handleUpdatePayment,
              theme.info,
              theme.iconBackground.blue
            )}
            {renderActionButton(
              'View Invoices',
              'Download receipts and billing history',
              'file-document',
              handleViewInvoices,
              theme.success,
              theme.iconBackground.green
            )}
            {renderActionButton(
              'Cancel Subscription',
              'End your subscription at next billing cycle',
              'cancel',
              handleCancelSubscription,
              theme.error,
              theme.iconBackground.red
            )}
          </>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerGradient: {
    paddingTop: (StatusBar.currentHeight || 0) + 15,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },
  currentPlanCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  billingInfo: {
    gap: 8,
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billingLabel: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  billingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  plansContainer: {
    gap: 16,
  },
  planCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: theme.divider,
    position: 'relative',
  },
  currentPlanHighlight: {
    borderColor: theme.success,
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 20,
    backgroundColor: theme.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  popularText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  planDetails: {
    flex: 1,
  },
  planCardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 2,
  },
  planCardPrice: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  featuresContainer: {
    marginBottom: 20,
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: theme.text,
    marginLeft: 8,
  },
  planButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  currentPlanButton: {
    backgroundColor: theme.iconBackground.gray,
  },
  upgradePlanButton: {
    backgroundColor: theme.primary,
  },
  planButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  currentPlanButtonText: {
    color: theme.textSecondary,
  },
  upgradePlanButtonText: {
    color: 'white',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    elevation: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});