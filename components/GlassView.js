import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * A reusable Glassmorphism component that works consistently on both iOS and Android.
 * On Android, it uses the experimentalBlurMethod if necessary for better performance/quality.
 */
const GlassView = ({
    intensity = 50,
    tint = 'dark',
    style,
    children,
    borderRadius = 0,
    borderWidth = 1,
    borderColor = 'rgba(255, 255, 255, 0.1)'
}) => {
    return (
        <View style={[
            styles.container,
            { borderRadius, borderWidth, borderColor },
            style
        ]}>
            <BlurView
                intensity={intensity}
                tint={tint}
                style={StyleSheet.absoluteFill}
                // experimentalBlurMethod is recommended for Android for better results in some Expo versions
                experimentalBlurMethod={Platform.OS === 'android' ? 'none' : undefined}
            />
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.05)', // Fallback / base transparency
    },
});

export default GlassView;
