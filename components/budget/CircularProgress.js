import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function CircularProgress({
  percentage = 0,
  size = 150,
  strokeWidth = 12,
  color = '#667eea',
  backgroundColor = '#e0e0e0',
  showPercentage = true,
  animated = true,
  textColor = '#333',
  fontSize = 24,
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedValue, {
        toValue: clampedPercentage,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    } else {
      animatedValue.setValue(clampedPercentage);
    }
  }, [clampedPercentage, animated]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress Circle */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      {showPercentage && (
        <View style={styles.textContainer}>
          <Text style={[styles.percentageText, { color: textColor, fontSize }]}>
            {Math.round(clampedPercentage)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontWeight: 'bold',
  },
});
