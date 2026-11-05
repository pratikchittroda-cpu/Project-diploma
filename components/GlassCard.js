import React from 'react';
import { View, StyleSheet } from 'react-native';
import GlassSurface, { glassEdge } from './GlassSurface';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Reusable glass card: Expo Liquid Glass (GlassView) tinted with the card colour where iOS supports
 * it, otherwise a blur/translucent tint (see GlassSurface). Pass glass={false} for a solid surface.
 */
const GlassCard = ({
    children,
    style,
    intensity,
    glass = true,
    backgroundColor,
    borderRadius = 20,
    borderWidth,
    padding = 16,
    ...props
}) => {
    const { theme, isDarkMode } = useTheme();
    const dark = isDarkMode ?? theme.isDarkMode;

    const blurIntensity = Number.isFinite(intensity) ? Math.max(0, Math.min(100, intensity)) : undefined;
    const resolvedStyle = StyleSheet.flatten([
        styles.container,
        {
            borderRadius,
            // Glass panes get a thin light rim; solid cards keep the old border-less default.
            borderWidth: borderWidth ?? (glass ? 1 : 0),
            borderColor: glass ? glassEdge(dark) : theme.border,
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
            {glass
                ? <GlassSurface color={surfaceColor} dark={dark} borderRadius={containerStyle.borderRadius} intensity={blurIntensity} />
                : <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: surfaceColor }]} />}
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
