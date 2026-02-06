import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Reusable glassmorphism card component
 * Provides consistent glass effect across the app with theme support
 */
const GlassCard = ({
    children,
    style,
    intensity,
    borderRadius = 20,
    borderWidth = 0, // Removed border by default
    padding = 16,
    ...props
}) => {
    const { theme } = useTheme();

    // Auto-adjust intensity based on theme if not provided
    // Scale intensity for Android as 100 on Android looks different than 100 on iOS
    const blurIntensity = Platform.OS === 'android' ? 10 : (theme.isDarkMode ? 30 : 60);
    const blurTint = theme.isDarkMode ? 'dark' : 'light';

    return (
        <View
            style={[
                styles.container,
                {
                    borderRadius,
                    borderWidth,
                    padding,
                },
                style
            ]}
            {...props}
        >
            <BlurView
                intensity={blurIntensity}
                tint={blurTint}
                experimentalBlurMethod={Platform.OS === 'android' ? 'none' : undefined}
                style={StyleSheet.absoluteFill}
            />
            {/* Dynamic overlay to reduce saturation and add "milky" effect */}
            <View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        backgroundColor: theme.isDarkMode
                            ? 'rgba(0, 0, 0, 0.1)'
                            : (Platform.OS === 'android' ? 'rgba(255, 255, 255, 0)' : 'rgba(255, 255, 255, 0.1)')
                    }
                ]}
            />
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    content: {
        // Content wrapper to ensure proper layering
    },
});

export default GlassCard;
