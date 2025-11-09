import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

const EnhancedCard = ({
  children,
  title,
  subtitle,
  icon,
  iconColor,
  gradient,
  onPress,
  style,
  elevation = 'medium',
  borderRadius = 'lg',
  padding = 'lg',
  animation = true,
  disabled = false,
  ...props
}) => {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shadowAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animation) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [animation]);

  const getElevationStyle = () => {
    switch (elevation) {
      case 'none':
        return { elevation: 0, shadowOpacity: 0 };
      case 'low':
        return {
          elevation: 2,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: theme.shadowLight,
          shadowRadius: 2,
        };
      case 'medium':
        return {
          elevation: 4,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.shadowMedium,
          shadowRadius: 4,
        };
      case 'high':
        return {
          elevation: 8,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: theme.shadowHeavy,
          shadowRadius: 8,
        };
      default:
        return {
          elevation: 4,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.shadowMedium,
          shadowRadius: 4,
        };
    }
  };

  const getBorderRadius = () => {
    return theme.borderRadius[borderRadius] || theme.borderRadius.lg;
  };

  const getPadding = () => {
    return theme.spacing[padding] || theme.spacing.lg;
  };

  const handlePressIn = () => {
    if (!disabled && onPress) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.98,
          tension: 300,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(shadowAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 300,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(shadowAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const styles = createStyles(theme);

  const CardContent = () => (
    <Animated.View
      style={[
        styles.card,
        {
          borderRadius: getBorderRadius(),
          padding: getPadding(),
          transform: [{ scale: scaleAnim }],
          opacity: fadeAnim,
          ...getElevationStyle(),
          shadowColor: theme.shadow,
          backgroundColor: theme.cardBackground,
          borderWidth: 1,
          borderColor: theme.borderLight,
        },
        style,
      ]}
      {...props}
    >
      {(title || subtitle || icon) && (
        <View style={styles.header}>
          {icon && (
            <View style={[styles.iconContainer, { backgroundColor: iconColor ? `${iconColor}20` : theme.primaryContainer }]}>
              <Icon
                name={icon}
                size={24}
                color={iconColor || theme.primary}
              />
            </View>
          )}
          <View style={styles.titleContainer}>
            {title && (
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
      )}
      {children}
    </Animated.View>
  );

  if (gradient) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.9}
        style={styles.touchableContainer}
      >
        <LinearGradient
          colors={gradient}
          style={[
            styles.gradientCard,
            {
              borderRadius: getBorderRadius(),
              ...getElevationStyle(),
              shadowColor: theme.shadow,
            },
          ]}
        >
          <CardContent />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.9}
        style={styles.touchableContainer}
      >
        <CardContent />
      </TouchableOpacity>
    );
  }

  return <CardContent />;
};

const createStyles = (theme) => StyleSheet.create({
  touchableContainer: {
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.cardBackground,
  },
  gradientCard: {
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    lineHeight: theme.typography.lineHeight.tight,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.normal,
    lineHeight: theme.typography.lineHeight.normal,
    marginTop: theme.spacing.xs,
  },
});

export default EnhancedCard;
