import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  BackHandler,
  Platform,
  TextInput,
} from 'react-native';
import { Icon } from '../constants/Icons';
import { useTheme } from '../contexts/ThemeContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ThemedMessageBox = ({
  visible,
  type = 'info', // 'success', 'error', 'warning', 'info', 'confirm'
  title,
  message,
  buttons = [],
  onDismiss,
  autoHide = false,
  autoHideDelay = 3000,
  showIcon = true,
  customIcon,
  animationType = 'fade', // 'fade', 'slide', 'scale'
  showInput = false,
  placeholder = '',
  secureTextEntry = false,
  initialValue = '',
}) => {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(visible);
  const [internalInputValue, setInternalInputValue] = useState(initialValue);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      setInternalInputValue(initialValue || '');
      showAnimation();

      // Auto hide functionality
      if (autoHide && type !== 'confirm') {
        const timer = setTimeout(() => {
          handleDismiss();
        }, autoHideDelay);

        return () => clearTimeout(timer);
      }
    } else {
      hideAnimation();
    }
  }, [visible]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isVisible) {
        handleDismiss();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isVisible]);

  const showAnimation = () => {
    const animations = [
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ];

    if (animationType === 'scale') {
      animations.push(
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        })
      );
    } else if (animationType === 'slide') {
      animations.push(
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        })
      );
    }

    Animated.parallel(animations).start();
  };

  const hideAnimation = () => {
    const animations = [
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ];

    if (animationType === 'scale') {
      animations.push(
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        })
      );
    } else if (animationType === 'slide') {
      animations.push(
        Animated.timing(slideAnim, {
          toValue: Platform.OS === 'ios' ? -100 : -60,
          duration: 200,
          useNativeDriver: true,
        })
      );
    }

    Animated.parallel(animations).start(() => {
      // Use setTimeout to avoid React scheduler conflicts (useInsertionEffect error)
      setTimeout(() => {
        setIsVisible(false);
      }, 0);
    });
  };

  const handleDismiss = () => {
    hideAnimation();
    setTimeout(() => {
      onDismiss && onDismiss();
    }, 200);
  };

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'check-circle',
          color: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.15)',
          borderColor: 'rgba(76, 175, 80, 0.3)',
        };
      case 'error':
        return {
          icon: 'alert-circle',
          color: '#FF5252',
          backgroundColor: 'rgba(255, 82, 82, 0.15)',
          borderColor: 'rgba(255, 82, 82, 0.3)',
        };
      case 'warning':
        return {
          icon: 'alert',
          color: '#FF9800',
          backgroundColor: 'rgba(255, 152, 0, 0.15)',
          borderColor: 'rgba(255, 152, 0, 0.3)',
        };
      case 'confirm':
        return {
          icon: 'help-circle',
          color: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.15)',
          borderColor: 'rgba(33, 150, 243, 0.3)',
        };
      default: // info
        return {
          icon: 'information',
          color: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.15)',
          borderColor: 'rgba(33, 150, 243, 0.3)',
        };
    }
  };

  const typeConfig = getTypeConfig();
  const iconName = customIcon || typeConfig.icon;

  const getAnimationStyle = () => {
    switch (animationType) {
      case 'scale':
        return {
          transform: [{ scale: scaleAnim }],
          opacity: fadeAnim,
        };
      case 'slide':
        return {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        };
      default: // fade
        return {
          opacity: fadeAnim,
        };
    }
  };

  const renderButtons = () => {
    if (buttons.length === 0) {
      return (
        <TouchableOpacity
          style={[styles.button, styles.singleButton, { backgroundColor: theme.primary }]}
          onPress={handleDismiss}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: 'white' }]}>OK</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.buttonContainer, type === 'confirm' && styles.confirmButtonContainer]}>
        {buttons.map((button, index) => {
          const isCancel = button.style === 'cancel';
          const buttonColor = button.color || theme.primary;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.button,
                isCancel ? styles.cancelButton : styles.confirmButton,
                isCancel && { backgroundColor: theme.isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' },
                type === 'confirm' && styles.modalButton,
                !isCancel && !button.color && { backgroundColor: theme.primary }
              ]}
              onPress={() => {
                button.onPress && button.onPress(showInput ? internalInputValue : undefined);
                if (button.dismissOnPress !== false) {
                  handleDismiss();
                }
              }}
              activeOpacity={0.8}
            >
              {!isCancel ? (
                <LinearGradient
                  colors={[buttonColor, buttonColor + 'cc']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: isCancel
                      ? (theme.isDarkMode ? 'rgba(255, 255, 255, 0.7)' : '#000000')
                      : 'white'
                  },
                  type === 'confirm' && styles.modalButtonText
                ]}
              >
                {button.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  if (!isVisible) return null;

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={[styles.overlay, type !== 'confirm' && styles.toastOverlay]}>
        <Animated.View
          style={[
            styles.messageBox,
            { backgroundColor: theme.isDarkMode ? '#1a1a1a' : '#ffffff' },
            type !== 'confirm' && styles.toastBox,
            type === 'confirm' && styles.confirmBox,
            getAnimationStyle(),
          ]}
        >

          <View style={[
            styles.contentWrapper,
            type === 'confirm' ? styles.confirmContent : styles.toastContent
          ]}>
            {/* Icon - Hidden for confirm type based on user request */}
            {showIcon && type !== 'confirm' && (
              <View style={[
                styles.iconContainer,
                { backgroundColor: typeConfig.backgroundColor }
              ]}>
                <Icon
                  name={iconName}
                  size={24}
                  color={typeConfig.color}
                />
              </View>
            )}

            {/* Text Content */}
            <View style={[
              styles.textContent,
              type === 'confirm' && styles.confirmTextContent,
              type === 'confirm' && { flex: 0, width: '100%' }
            ]}>
              {title && (
                <Text style={[
                  styles.toastTitle,
                  type === 'confirm' && styles.confirmTitle,
                  { color: theme.isDarkMode ? '#ffffff' : '#000000' }
                ]}>
                  {title}
                </Text>
              )}
              {message && (
                <Text style={[
                  styles.toastMessage,
                  type === 'confirm' && styles.confirmMessage,
                  { color: theme.isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }
                ]}>
                  {message}
                </Text>
              )}

              {showInput && (
                <View style={[styles.inputContainer, {
                  borderColor: theme.border,
                  backgroundColor: theme.isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'
                }]}>
                  <TextInput
                    style={[styles.input, { color: theme.isDarkMode ? 'white' : 'black' }]}
                    placeholder={placeholder}
                    placeholderTextColor={theme.isDarkMode ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)"}
                    secureTextEntry={secureTextEntry}
                    value={internalInputValue}
                    onChangeText={setInternalInputValue}
                    autoFocus={true}
                    autoCapitalize="none"
                  />
                </View>
              )}
            </View>

            {/* Buttons / Close */}
            {type === 'confirm' ? (
              <View style={styles.modalButtonWrapper}>
                {renderButtons()}
              </View>
            ) : (
              <View style={styles.toastRight}>
                {buttons.length > 0 ? renderButtons() : (
                  <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
                    <Icon name="close" size={20} color={theme.isDarkMode ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)"} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  toastOverlay: {
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  messageBox: {
    width: screenWidth * 0.9,
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  toastBox: {
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  confirmBox: {
    padding: 24,
    borderRadius: 32,
  },
  contentWrapper: {
    width: '100%',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmContent: {
    alignItems: 'center',
    textAlign: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  confirmIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 16,
    marginRight: 0,
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
  },
  confirmTextContent: {
    alignItems: 'center',
    marginBottom: 24,
  },
  toastTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  toastMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  confirmMessage: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 15,
  },
  toastRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  closeButton: {
    padding: 8,
    marginLeft: 4,
  },
  modalButtonWrapper: {
    width: '100%',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  confirmButtonContainer: {
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 10,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    overflow: 'hidden',
  },
  modalButton: {
    flex: 1,
    minHeight: 50,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  confirmButton: {
    // Background handled by primary color or gradient
  },
  buttonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalButtonText: {
    fontSize: 16,
  },
  inputContainer: {
    width: '100%',
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
});

export default ThemedMessageBox;