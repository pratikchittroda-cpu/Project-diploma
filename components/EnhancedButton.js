import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

const EnhancedButton = ({
	title,
	onPress,
	icon,
	gradient,
	color,
	variant = 'primary', // 'primary' | 'outline' | 'ghost'
	size = 'md', // 'sm' | 'md' | 'lg'
	disabled = false,
	loading = false,
	style,
	textStyle,
	...props
}) => {
	const { theme } = useTheme();
	const scaleAnim = useRef(new Animated.Value(1)).current;
	const opacityAnim = useRef(new Animated.Value(1)).current;

	const sizes = {
		sm: { paddingV: 10, font: theme.typography.fontSize.sm, radius: theme.borderRadius.md },
		md: { paddingV: 14, font: theme.typography.fontSize.base, radius: theme.borderRadius.lg },
		lg: { paddingV: 16, font: theme.typography.fontSize.lg, radius: theme.borderRadius.xl },
	};

	const currentSize = sizes[size] || sizes.md;
	const isDisabled = disabled || loading;

	const handlePressIn = () => {
		if (isDisabled) return;
		Animated.parallel([
			Animated.spring(scaleAnim, { toValue: 0.98, tension: 300, friction: 10, useNativeDriver: true }),
			Animated.timing(opacityAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
		]).start();
	};

	const handlePressOut = () => {
		Animated.parallel([
			Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
			Animated.timing(opacityAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
		]).start();
	};

	const renderContent = (foregroundColor) => (
		<Animated.View
			style={{
				paddingVertical: currentSize.paddingV,
				alignItems: 'center',
				justifyContent: 'center',
				transform: [{ scale: scaleAnim }],
				opacity: opacityAnim,
				flexDirection: 'row',
			}}
		>
			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="small" color={foregroundColor} style={{ marginRight: 8 }} />
					<Text
						style={[
							{ color: foregroundColor, fontSize: currentSize.font, fontWeight: theme.typography.fontWeight.bold },
							textStyle,
						]}
					>
						{title || 'Please wait…'}
					</Text>
				</View>
			) : (
				<>
					{icon ? (
						<Icon name={icon} size={currentSize.font + 2} color={foregroundColor} style={{ marginRight: 6 }} />
					) : null}
					<Text
						style={[
							{ color: foregroundColor, fontSize: currentSize.font, fontWeight: theme.typography.fontWeight.bold },
							textStyle,
						]}
					>
						{title}
					</Text>
				</>
			)}
		</Animated.View>
	);

	const baseStyles = [
		styles.button,
		{
			borderRadius: currentSize.radius,
			opacity: isDisabled ? 0.7 : 1,
		},
		style,
	];

	if (variant === 'outline') {
		const border = color || theme.primary;
		return (
			<TouchableOpacity
				activeOpacity={0.9}
				onPress={onPress}
				onPressIn={handlePressIn}
				onPressOut={handlePressOut}
				disabled={isDisabled}
				style={baseStyles}
				{...props}
			>
				<View
					style={{
						paddingVertical: currentSize.paddingV,
						alignItems: 'center',
						justifyContent: 'center',
						borderWidth: 1,
						borderColor: border,
						borderRadius: currentSize.radius,
					}}
				>
					{renderContent(border)}
				</View>
			</TouchableOpacity>
		);
	}

	if (variant === 'ghost') {
		const fg = color || theme.primary;
		return (
			<TouchableOpacity
				activeOpacity={0.8}
				onPress={onPress}
				onPressIn={handlePressIn}
				onPressOut={handlePressOut}
				disabled={isDisabled}
				style={baseStyles}
				{...props}
			>
				{renderContent(fg)}
			</TouchableOpacity>
		);
	}

	// default: primary (solid) with optional gradient
	const fg = theme.buttonText;
	return (
		<TouchableOpacity
			activeOpacity={0.9}
			onPress={onPress}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			disabled={isDisabled}
			style={baseStyles}
			{...props}
		>
			{gradient ? (
				<LinearGradient colors={gradient} style={{ borderRadius: currentSize.radius }}>
					{renderContent(fg)}
				</LinearGradient>
			) : (
				<View style={{ backgroundColor: color || theme.primary, borderRadius: currentSize.radius }}>
					{renderContent(fg)}
				</View>
			)}
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	button: {
		borderRadius: 12,
		overflow: 'hidden',
	},
	loadingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
});

export default EnhancedButton;


