import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Reusable glassmorphism card component
 * One themed surface on every platform; optional blur sits behind that surface.
 */
const GlassCard = ({
    children,
    style,
    intensity,
    blur,
    backgroundColor,
    borderRadius = 20,
    borderWidth = 0, // Removed border by default
    padding = 16,
    ...props
}) => {
    const { theme, isDarkMode } = useTheme();
    const dark = isDarkMode ?? theme.isDarkMode;

    const blurIntensity = Number.isFinite(intensity) ? Math.max(0, Math.min(100, intensity)) : (dark ? 30 : 60);
    const showBlur = blur ?? (Number.isFinite(intensity) && intensity > 0);
    const resolvedStyle = StyleSheet.flatten([
        styles.container,
        {
            borderRadius,
            borderWidth,
            borderColor: theme.border,
            padding,
            backgroundColor: theme.cardBackground || theme.card || theme.surface,
        },
        backgroundColor !== undefined && { backgroundColor },
        style,
    ]);
    const { backgroundColor: surfaceColor, ...containerStyle } = resolvedStyle;

    return (
        <View
            style={containerStyle}
            {...props}
        >
            {showBlur && blurIntensity > 0 && Platform.OS !== 'android' && <BlurView
                intensity={blurIntensity}
                tint={dark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />}
            <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: surfaceColor }]}
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
