import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Enhanced typography system
const typography = {
  // Font families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    light: 'System',
  },
  
  // Font sizes with responsive scaling
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 36,
    '6xl': 48,
  },
  
  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
  },
  
  // Font weights
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
};

// Enhanced spacing system
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
  '4xl': 96,
};

// Enhanced border radius system
const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
};

// Base theme structure generator
const createTheme = (primaryColor, primaryLight, isDark = false) => {
  const baseColors = {
    // Enhanced status colors with better contrast
    success: '#10B981', // Emerald-500
    error: '#EF4444',   // Red-500
    warning: '#F59E0B', // Amber-500
    info: '#3B82F6',    // Blue-500
    
    // Additional semantic colors
    successLight: '#D1FAE5', // Emerald-100
    errorLight: '#FEE2E2',   // Red-100
    warningLight: '#FEF3C7',  // Amber-100
    infoLight: '#DBEAFE',     // Blue-100
  };

  if (isDark) {
    return {
      // Enhanced background colors with better hierarchy
      background: '#0F0F0F',        // Pure black for OLED screens
      surface: '#1A1A1A',          // Elevated surfaces
      surfaceVariant: '#2A2A2A',   // Secondary surfaces
      card: '#1E1E1E',             // Card backgrounds
      cardElevated: '#2A2A2A',      // Elevated cards

      // Enhanced text colors with better contrast
      text: '#FFFFFF',             // Primary text
      textSecondary: '#B3B3B3',    // Secondary text
      textTertiary: '#808080',     // Tertiary text
      textLight: '#666666',        // Light text
      textDisabled: '#4D4D4D',     // Disabled text

      // Primary colors with better gradients
      primary: primaryColor,
      primaryLight: primaryLight,
      primaryDark: primaryColor,
      primaryContainer: `${primaryColor}20`, // 20% opacity

      // Status colors
      ...baseColors,

      // Enhanced border and divider colors
      border: '#2A2A2A',
      borderLight: '#1A1A1A',
      divider: '#2A2A2A',
      dividerLight: '#1A1A1A',

      // Enhanced shadow colors with better depth
      shadow: '#000000',
      shadowLight: '#00000040', // 25% opacity
      shadowMedium: '#00000060', // 37.5% opacity
      shadowHeavy: '#00000080',  // 50% opacity

      // Enhanced tab bar
      tabBar: '#1A1A1A',
      tabBarBorder: 'transparent',
      tabBarElevated: '#2A2A2A',

      // Enhanced component colors
      headerBackground: '#1A1A1A',
      cardBackground: '#1E1E1E',
      cardBackgroundElevated: '#2A2A2A',
      inputBackground: '#2A2A2A',
      inputBackgroundFocused: '#333333',
      placeholderText: '#808080',
      linkColor: primaryColor,
      buttonText: '#FFFFFF',
      buttonTextSecondary: '#B3B3B3',

      // Enhanced loading colors
      loadingBackground: '#1A1A1A',
      loadingIndicator: primaryColor,
      loadingOverlay: '#00000080', // 50% opacity

      // Icon backgrounds
      iconBackground: {
        blue: '#1a237e',
        purple: '#4a148c',
        orange: '#e65100',
        green: '#1b5e20',
        gray: '#424242',
        red: '#b71c1c',
      },

      // Category colors for charts and data visualization
      categoryColors: {
        food: '#FF9800',
        bills: '#607D8B',
        shopping: '#9C27B0',
        transport: '#2196F3',
        entertainment: '#FF5722',
        healthcare: '#4CAF50',
        others: '#795548',
        income: '#4CAF50',
        expense: '#FF5252',
        net: '#FFD700',
      },

      // Status colors for different states
      statusColors: {
        active: '#4CAF50',
        inactive: '#FF9800',
        pending: '#FFC107',
        completed: '#4CAF50',
        cancelled: '#F44336',
      },

      // Design tokens
      typography,
      spacing,
      borderRadius,

      // Theme metadata
      isDarkMode: true,
    };
  } else {
    return {
      // Enhanced background colors with better hierarchy
      background: '#FAFAFA',        // Clean white background
      surface: '#FFFFFF',          // Elevated surfaces
      surfaceVariant: '#F5F5F5',   // Secondary surfaces
      card: '#FFFFFF',             // Card backgrounds
      cardElevated: '#FFFFFF',      // Elevated cards

      // Enhanced text colors with better contrast
      text: '#1A1A1A',             // Primary text
      textSecondary: '#4A4A4A',    // Secondary text
      textTertiary: '#6B6B6B',     // Tertiary text
      textLight: '#9CA3AF',        // Light text
      textDisabled: '#D1D5DB',     // Disabled text

      // Primary colors with better gradients
      primary: primaryColor,
      primaryLight: primaryLight,
      primaryDark: primaryColor,
      primaryContainer: `${primaryColor}15`, // 15% opacity

      // Status colors
      ...baseColors,

      // Enhanced border and divider colors
      border: '#E5E7EB',
      borderLight: '#F3F4F6',
      divider: '#E5E7EB',
      dividerLight: '#F3F4F6',

      // Enhanced shadow colors with better depth
      shadow: '#000000',
      shadowLight: '#00000010', // 6.25% opacity
      shadowMedium: '#00000020', // 12.5% opacity
      shadowHeavy: '#00000030',  // 18.75% opacity

      // Enhanced tab bar
      tabBar: '#FFFFFF',
      tabBarBorder: 'transparent',
      tabBarElevated: '#FFFFFF',

      // Enhanced component colors
      headerBackground: '#FFFFFF',
      cardBackground: '#FFFFFF',
      cardBackgroundElevated: '#FFFFFF',
      inputBackground: '#F9FAFB',
      inputBackgroundFocused: '#FFFFFF',
      placeholderText: '#9CA3AF',
      linkColor: primaryColor,
      buttonText: '#FFFFFF',
      buttonTextSecondary: '#4A4A4A',

      // Enhanced loading colors
      loadingBackground: '#FAFAFA',
      loadingIndicator: primaryColor,
      loadingOverlay: '#FFFFFF80', // 50% opacity

      // Icon backgrounds
      iconBackground: {
        blue: '#E3F2FD',
        purple: '#F3E5F5',
        orange: '#FFF3E0',
        green: '#E8F5E8',
        gray: '#F5F5F5',
        red: '#FFEBEE',
      },

      // Category colors for charts and data visualization
      categoryColors: {
        food: '#FF9800',
        bills: '#607D8B',
        shopping: '#9C27B0',
        transport: '#2196F3',
        entertainment: '#FF5722',
        healthcare: '#4CAF50',
        others: '#795548',
        income: '#4CAF50',
        expense: '#FF5252',
        net: '#FFD700',
      },

      // Status colors for different states
      statusColors: {
        active: '#4CAF50',
        inactive: '#FF9800',
        pending: '#FFC107',
        completed: '#4CAF50',
        cancelled: '#F44336',
      },

      // Design tokens
      typography,
      spacing,
      borderRadius,

      // Theme metadata
      isDarkMode: false,
    };
  }
};

// Available theme configurations
export const themeConfigs = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'Classic blue and purple gradient',
    colors: ['#667eea', '#764ba2'],
    primary: '#667eea',
    primaryLight: '#764ba2',
    category: 'Classic',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    description: 'Calming blue and teal tones',
    colors: ['#2196F3', '#00BCD4'],
    primary: '#2196F3',
    primaryLight: '#00BCD4',
    category: 'Nature',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm orange and pink hues',
    colors: ['#FF9800', '#E91E63'],
    primary: '#FF9800',
    primaryLight: '#E91E63',
    category: 'Nature',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    description: 'Natural green and emerald',
    colors: ['#4CAF50', '#009688'],
    primary: '#4CAF50',
    primaryLight: '#009688',
    category: 'Nature',
  },
  royal: {
    id: 'royal',
    name: 'Royal',
    description: 'Deep purple and indigo',
    colors: ['#9C27B0', '#3F51B5'],
    primary: '#9C27B0',
    primaryLight: '#3F51B5',
    category: 'Elegant',
  },
  fire: {
    id: 'fire',
    name: 'Fire',
    description: 'Bold red and orange flames',
    colors: ['#F44336', '#FF5722'],
    primary: '#F44336',
    primaryLight: '#FF5722',
    category: 'Bold',
  },
  // New Nature Themes
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    description: 'Mystical northern lights',
    colors: ['#00C9FF', '#92FE9D'],
    primary: '#00C9FF',
    primaryLight: '#92FE9D',
    category: 'Nature',
  },
  lavender: {
    id: 'lavender',
    name: 'Lavender',
    description: 'Soft purple fields',
    colors: ['#8360c3', '#2ebf91'],
    primary: '#8360c3',
    primaryLight: '#2ebf91',
    category: 'Nature',
  },
  cherry: {
    id: 'cherry',
    name: 'Cherry Blossom',
    description: 'Delicate pink petals',
    colors: ['#ff9a9e', '#fecfef'],
    primary: '#ff9a9e',
    primaryLight: '#fecfef',
    category: 'Nature',
  },
  // New Bold Themes
  neon: {
    id: 'neon',
    name: 'Neon',
    description: 'Electric cyan and magenta',
    colors: ['#00d2ff', '#ff0099'],
    primary: '#00d2ff',
    primaryLight: '#ff0099',
    category: 'Bold',
  },
  volcano: {
    id: 'volcano',
    name: 'Volcano',
    description: 'Molten lava flow',
    colors: ['#ff4b1f', '#ff9068'],
    primary: '#ff4b1f',
    primaryLight: '#ff9068',
    category: 'Bold',
  },
  electric: {
    id: 'electric',
    name: 'Electric',
    description: 'High voltage energy',
    colors: ['#667eea', '#764ba2'],
    primary: '#667eea',
    primaryLight: '#764ba2',
    category: 'Bold',
  },
  // New Elegant Themes
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep navy and silver',
    colors: ['#2c3e50', '#4ca1af'],
    primary: '#2c3e50',
    primaryLight: '#4ca1af',
    category: 'Elegant',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    description: 'Luxurious golden tones',
    colors: ['#f7971e', '#ffd200'],
    primary: '#f7971e',
    primaryLight: '#ffd200',
    category: 'Elegant',
  },
  platinum: {
    id: 'platinum',
    name: 'Platinum',
    description: 'Premium silver gradient',
    colors: ['#bdc3c7', '#2c3e50'],
    primary: '#bdc3c7',
    primaryLight: '#2c3e50',
    category: 'Elegant',
  },
  // New Pastel Themes
  cotton: {
    id: 'cotton',
    name: 'Cotton Candy',
    description: 'Sweet pastel dreams',
    colors: ['#ffecd2', '#fcb69f'],
    primary: '#ffecd2',
    primaryLight: '#fcb69f',
    category: 'Pastel',
  },
  mint: {
    id: 'mint',
    name: 'Mint',
    description: 'Fresh mint breeze',
    colors: ['#a8edea', '#fed6e3'],
    primary: '#a8edea',
    primaryLight: '#fed6e3',
    category: 'Pastel',
  },
  peach: {
    id: 'peach',
    name: 'Peach',
    description: 'Soft peach sunset',
    colors: ['#ffb347', '#ffcc33'],
    primary: '#ffb347',
    primaryLight: '#ffcc33',
    category: 'Pastel',
  },
  // New Cosmic Themes
  galaxy: {
    id: 'galaxy',
    name: 'Galaxy',
    description: 'Deep space mystery',
    colors: ['#2b5876', '#4e4376'],
    primary: '#2b5876',
    primaryLight: '#4e4376',
    category: 'Cosmic',
  },
  nebula: {
    id: 'nebula',
    name: 'Nebula',
    description: 'Colorful cosmic clouds',
    colors: ['#667eea', '#764ba2'],
    primary: '#667eea',
    primaryLight: '#764ba2',
    category: 'Cosmic',
  },
  starlight: {
    id: 'starlight',
    name: 'Starlight',
    description: 'Twinkling stellar glow',
    colors: ['#ffecd2', '#fcb69f'],
    primary: '#ffecd2',
    primaryLight: '#fcb69f',
    category: 'Cosmic',
  },
  // New Professional Themes
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    description: 'Professional blue tones',
    colors: ['#1e3c72', '#2a5298'],
    primary: '#1e3c72',
    primaryLight: '#2a5298',
    category: 'Professional',
  },
  executive: {
    id: 'executive',
    name: 'Executive',
    description: 'Sophisticated charcoal',
    colors: ['#434343', '#000000'],
    primary: '#434343',
    primaryLight: '#000000',
    category: 'Professional',
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Clean contemporary style',
    colors: ['#74b9ff', '#0984e3'],
    primary: '#74b9ff',
    primaryLight: '#0984e3',
    category: 'Professional',
  },
  // New Vibrant Themes
  tropical: {
    id: 'tropical',
    name: 'Tropical',
    description: 'Vibrant island paradise',
    colors: ['#f093fb', '#f5576c'],
    primary: '#f093fb',
    primaryLight: '#f5576c',
    category: 'Vibrant',
  },
  rainbow: {
    id: 'rainbow',
    name: 'Rainbow',
    description: 'Colorful spectrum blend',
    colors: ['#ff9a9e', '#fecfef'],
    primary: '#ff9a9e',
    primaryLight: '#fecfef',
    category: 'Vibrant',
  },
  festival: {
    id: 'festival',
    name: 'Festival',
    description: 'Celebration of colors',
    colors: ['#fa709a', '#fee140'],
    primary: '#fa709a',
    primaryLight: '#fee140',
    category: 'Vibrant',
  },
};

// Legacy theme definitions for backward compatibility
export const lightTheme = createTheme('#667eea', '#764ba2', false);
export const darkTheme = createTheme('#667eea', '#764ba2', true);



// Create Theme Context
const ThemeContext = createContext();

// Theme Provider Component
export const ThemeProvider = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [currentThemeId, setCurrentThemeId] = useState('default');
    const [isLoading, setIsLoading] = useState(true);

    // Load theme preferences from storage
    useEffect(() => {
        loadThemePreferences();
    }, []);

    const loadThemePreferences = async () => {
        try {
            const savedDarkMode = await AsyncStorage.getItem('isDarkMode');
            const savedThemeId = await AsyncStorage.getItem('currentThemeId');
            
            if (savedDarkMode !== null) {
                setIsDarkMode(JSON.parse(savedDarkMode));
            }
            if (savedThemeId !== null) {
                setCurrentThemeId(savedThemeId);
            }
        } catch (error) {
            console.log('Error loading theme preferences:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTheme = async () => {
        try {
            const newDarkMode = !isDarkMode;
            setIsDarkMode(newDarkMode);
            await AsyncStorage.setItem('isDarkMode', JSON.stringify(newDarkMode));
        } catch (error) {
            console.log('Error saving dark mode preference:', error);
        }
    };

    const changeTheme = async (themeId) => {
        try {
            setCurrentThemeId(themeId);
            await AsyncStorage.setItem('currentThemeId', themeId);
        } catch (error) {
            console.log('Error saving theme preference:', error);
        }
    };

    // Generate current theme based on selected theme and dark mode
    const getCurrentTheme = () => {
        const themeConfig = themeConfigs[currentThemeId] || themeConfigs.default;
        return createTheme(themeConfig.primary, themeConfig.primaryLight, isDarkMode);
    };

    const theme = getCurrentTheme();

    const value = {
        isDarkMode,
        currentThemeId,
        theme: theme || lightTheme, // Ensure theme is never undefined
        themeConfigs,
        toggleTheme,
        changeTheme,
        isLoading,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

// Custom hook to use theme
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};