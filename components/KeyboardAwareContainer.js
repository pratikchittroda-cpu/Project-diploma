import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StatusBar, Keyboard, Animated, ScrollView, View, Dimensions } from 'react-native';

const { height: screenHeight } = Dimensions.get('window');

const KeyboardAwareContainer = ({
	children,
	style,
	contentContainerStyle,
	keyboardOffset,
	keyboardBehavior,
	showsVerticalScrollIndicator = false,
	...props
}) => {
	const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
	const bottomInset = useRef(new Animated.Value(0)).current;
	const scrollViewRef = useRef(null);

	useEffect(() => {
		const onShow = (e) => {
			setIsKeyboardVisible(true);
			const keyboardHeight = e?.endCoordinates?.height || 0;
			
			// Increase padding significantly for better coverage
			const extraPadding = Platform.OS === 'ios' ? 80 : 120;
			
			Animated.timing(bottomInset, {
				toValue: keyboardHeight + extraPadding,
				duration: 250,
				useNativeDriver: false,
			}).start();

			// Auto-scroll to bottom when keyboard shows
			setTimeout(() => {
				scrollViewRef.current?.scrollToEnd({ animated: true });
			}, 300);
		};

		const onHide = () => {
			setIsKeyboardVisible(false);
			Animated.timing(bottomInset, {
				toValue: 0,
				duration: 250,
				useNativeDriver: false,
			}).start();
		};

		const s1 = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
		const s2 = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
		
		return () => {
			s1.remove();
			s2.remove();
		};
	}, [bottomInset]);

	const behavior = keyboardBehavior || (Platform.OS === 'ios' ? 'padding' : 'height');
	const verticalOffset = keyboardOffset != null ? keyboardOffset : (Platform.OS === 'ios' ? 0 : -200);

	return (
		<KeyboardAvoidingView
			style={[{ flex: 1 }, style]}
			behavior={behavior}
			keyboardVerticalOffset={verticalOffset}
		>
			<ScrollView
				ref={scrollViewRef}
				style={{ flex: 1 }}
				contentContainerStyle={[
					contentContainerStyle,
					{ 
						paddingBottom: isKeyboardVisible ? 150 : 50,
						minHeight: screenHeight + (isKeyboardVisible ? 200 : 0)
					}
				]}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
				showsVerticalScrollIndicator={showsVerticalScrollIndicator}
				bounces={true}
				enableOnAndroid={true}
				{...props}
			>
				{children}
				<Animated.View style={{ height: bottomInset }} />
				{/* Extra space at bottom */}
				<View style={{ height: isKeyboardVisible ? 100 : 50 }} />
			</ScrollView>
		</KeyboardAvoidingView>
	);
};

export default KeyboardAwareContainer;



