// GreenSpoon Theme Colors
export const colors = {
  // Primary Colors
  primary: {
    light: '#A5D6A7',
    main: '#4CAF50',
    dark: '#2E7D32',
    darker: '#1B5E20',
  },
  
  // Secondary Colors
  secondary: {
    light: '#C8E6C9',
    main: '#81C784',
    dark: '#66BB6A',
  },
  
  // Background Colors
  background: {
    primary: '#A5D6A7',
    secondary: '#81C784',
    tertiary: '#66BB6A',
    card: 'rgba(255, 255, 255, 0.9)',
    cardLight: 'rgba(255, 255, 255, 0.7)',
  },
  
  // Text Colors
  text: {
    primary: '#333',
    secondary: '#666',
    tertiary: '#999',
    white: '#fff',
    whiteMuted: 'rgba(255, 255, 255, 0.8)',
    whiteLight: 'rgba(255, 255, 255, 0.7)',
  },
  
  // Status Colors
  status: {
    success: '#4CAF50',
    successLight: '#A5D6A7',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
  },
  
  // Border Colors
  border: {
    light: '#E0E0E0',
    medium: '#BDBDBD',
    dark: '#9E9E9E',
  },
  
  // Shadow Colors
  shadow: {
    light: 'rgba(0, 0, 0, 0.1)',
    medium: 'rgba(0, 0, 0, 0.2)',
    dark: 'rgba(0, 0, 0, 0.3)',
  },
  
  // Gradient Colors
  gradients: {
    primary: ['#A5D6A7', '#81C784', '#66BB6A'],
    secondary: ['#E8F5E9', '#C8E6C9'],
    button: ['#2E7D32', '#4CAF50'],
    card: ['#E8F5E9', '#C8E6C9'],
  },
  
  // Switch Colors
  switch: {
    track: {
      false: '#E0E0E0',
      true: '#4CAF50',
    },
    thumb: {
      false: '#f4f3f4',
      true: '#fff',
    },
  },
};

// Export individual color groups for convenience
export const {
  primary,
  secondary,
  background,
  text,
  status,
  border,
  shadow,
  gradients,
  switch: switchColors,
} = colors;

// Default export
export default colors; 