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
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

export default function ThemesScreen({ navigation }) {
  const { theme, isDarkMode, currentThemeId, themeConfigs, toggleTheme, changeTheme } = useTheme();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Convert themeConfigs to array and group by category
  const themeOptions = Object.values(themeConfigs);

  // Group themes by category
  const themesByCategory = themeOptions.reduce((acc, theme) => {
    const category = theme.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(theme);
    return acc;
  }, {});

  // Define category order and icons
  const categoryInfo = {
    'Classic': { icon: 'star', description: 'Timeless and elegant' },
    'Nature': { icon: 'leaf', description: 'Inspired by natural beauty' },
    'Bold': { icon: 'flash', description: 'Vibrant and energetic' },
    'Elegant': { icon: 'diamond-stone', description: 'Sophisticated luxury' },
    'Pastel': { icon: 'flower', description: 'Soft and gentle tones' },
    'Cosmic': { icon: 'rocket', description: 'Space and galaxy themes' },
    'Professional': { icon: 'briefcase', description: 'Business-ready colors' },
    'Vibrant': { icon: 'palette', description: 'Bright and colorful' },
  };

  // Recent actions tracking
  const trackScreenVisit = async () => {
    try {
      const recentActions = await AsyncStorage.getItem('recentActions');
      let actions = recentActions ? JSON.parse(recentActions) : [];

      const screenData = {
        id: 'Themes',
        title: 'Themes',
        icon: 'palette',
        timestamp: Date.now(),
      };

      actions = actions.filter(action => action.id !== screenData.id);
      actions.unshift(screenData);
      actions = actions.slice(0, 4);

      await AsyncStorage.setItem('recentActions', JSON.stringify(actions));
    } catch (error) {
      console.error('Error tracking screen visit:', error);
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

  const handleThemeSelect = (themeId) => {
    const selectedThemeConfig = themeOptions.find(t => t.id === themeId);

    Alert.alert(
      'Apply Theme',
      `Apply the ${selectedThemeConfig?.name} theme? This will change the app's color scheme.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            // Apply the new theme
            await changeTheme(themeId);

            // Show success message with restart recommendation
            Alert.alert(
              'Theme Applied Successfully!',
              `${selectedThemeConfig?.name} theme has been applied. For the best experience and to ensure all colors are properly updated, please restart the app.\\n\\nSome screens may still show old colors until the app is restarted.`,
              [
                { text: 'Later', onPress: () => navigation.goBack() },
                {
                  text: 'Restart Now',
                  onPress: () => {
                    // In a real app, you would use a library like react-native-restart
                    // For now, we'll just show a message
                    Alert.alert(
                      'Restart Required',
                      'Please close and reopen the app to see all theme changes.',
                      [{ text: 'OK', onPress: () => navigation.goBack() }]
                    );
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const renderThemeCard = (themeOption, index) => {
    const isCurrentTheme = currentThemeId === themeOption.id;

    return (
      <TouchableOpacity
        key={themeOption.id}
        onPress={() => handleThemeSelect(themeOption.id)}
        style={styles.themeCardContainer}
      >
        <Animated.View style={[
          styles.themeCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          },
          isCurrentTheme && styles.selectedThemeCard
        ]}>
          <LinearGradient
            colors={themeOption.colors}
            style={styles.themePreview}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.previewContent}>
              <Icon name="palette" size={20} color="white" />
              <Text style={styles.previewText}>{themeOption.name}</Text>
              {isCurrentTheme && (
                <View style={styles.currentThemeBadge}>
                  <Icon name="check" size={14} color="white" />
                </View>
              )}
            </View>
          </LinearGradient>

          <View style={styles.themeInfo}>
            <View style={styles.themeHeader}>
              <Text style={styles.themeName}>{themeOption.name}</Text>
              {isCurrentTheme && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeText}>Active</Text>
                </View>
              )}
            </View>
            <Text style={styles.themeDescription}>{themeOption.description}</Text>

            <View style={styles.colorPalette}>
              {themeOption.colors.map((color, colorIndex) => (
                <View
                  key={colorIndex}
                  style={[styles.colorSwatch, { backgroundColor: color }]}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderCategorySection = (categoryName, themes) => {
    const categoryData = categoryInfo[categoryName] || { icon: 'palette', description: 'Beautiful themes' };

    return (
      <Animated.View
        key={categoryName}
        style={[styles.categorySection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.categoryHeader}>
          <View style={styles.categoryTitleContainer}>
            <View style={styles.categoryIcon}>
              <Icon name={categoryData.icon} size={20} color="white" />
            </View>
            <View>
              <Text style={styles.categoryTitle}>{categoryName}</Text>
              <Text style={styles.categoryDescription}>{categoryData.description}</Text>
            </View>
          </View>
          <Text style={styles.categoryCount}>{themes.length}</Text>
        </View>

        <View style={styles.themesGrid}>
          {themes.map((themeOption, index) => renderThemeCard(themeOption, index))}
        </View>
      </Animated.View>
    );
  };

  const renderDarkModeToggle = () => (
    <Animated.View style={[styles.darkModeCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.darkModeContent}>
        <View style={styles.darkModeLeft}>
          <View style={styles.darkModeIcon}>
            <Icon name="theme-light-dark" size={24} color="white" />
          </View>
          <View>
            <Text style={styles.darkModeTitle}>Dark Mode</Text>
            <Text style={styles.darkModeSubtitle}>
              {isDarkMode ? 'Dark theme active' : 'Light theme active'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.darkModeToggle, isDarkMode && styles.darkModeToggleActive]}
          onPress={toggleTheme}
        >
          <Animated.View style={[
            styles.darkModeThumb,
            { transform: [{ translateX: isDarkMode ? 24 : 0 }] }
          ]}>
            <Icon
              name={isDarkMode ? 'weather-night' : 'weather-sunny'}
              size={16}
              color={isDarkMode ? '#667eea' : '#FFA500'}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Background Gradient */}
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        style={styles.background}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Themes & Appearance</Text>
          <View style={styles.headerSpacer} />
        </Animated.View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            {renderDarkModeToggle()}
          </Animated.View>

          <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.sectionTitle}>Color Themes</Text>
            <Text style={styles.sectionSubtitle}>
              Choose from {themeOptions.length} beautiful themes across {Object.keys(themesByCategory).length} categories
            </Text>

            {Object.entries(themesByCategory).map(([categoryName, themes]) =>
              renderCategorySection(categoryName, themes)
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 15,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSpacer: {
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
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
  },
  darkModeCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  darkModeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  darkModeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  darkModeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  darkModeTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  darkModeSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  darkModeToggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 4,
    justifyContent: 'center',
  },
  darkModeToggleActive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  darkModeThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categorySection: {
    marginBottom: 25,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingHorizontal: 4,
  },
  categoryTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    textAlign: 'center',
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  themeCardContainer: {
    width: (width - 64) / 2, // Two columns with padding and gap
  },
  themeCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  selectedThemeCard: {
    borderColor: 'rgba(76, 175, 80, 0.8)',
    borderWidth: 2,
  },
  themePreview: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    alignItems: 'center',
    position: 'relative',
  },
  previewText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  currentThemeBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeInfo: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  themeName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  activeBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  themeDescription: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    lineHeight: 14,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 8,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});