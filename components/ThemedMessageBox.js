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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

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
}) => {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(visible);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
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
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      animationType === 'fade' 
        ? Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          })
        : animationType === 'scale'
        ? Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          })
        : Animated.spring(slideAnim, {
            toValue: 0,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          })
    ]).start();
  };

  const hideAnimation = () => {
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      animationType === 'fade'
        ? Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          })
        : animationType === 'scale'
        ? Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          })
        : Animated.timing(slideAnim, {
            toValue: 50,
            duration: 200,
            useNativeDriver: true,
          })
    ]).start(() => {
      setIsVisible(false);
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
          backgroundColor: '#E8F5E8',
          borderColor: '#4CAF50',
        };
      case 'error':
        return {
          icon: 'alert-circle',
          color: '#F44336',
          backgroundColor: '#FFEBEE',
          borderColor: '#F44336',
        };
      case 'warning':
        return {
          icon: 'alert',
          color: '#FF9800',
          backgroundColor: '#FFF3E0',
          borderColor: '#FF9800',
        };
      case 'confirm':
        return {
          icon: 'help-circle',
          color: '#2196F3',
          backgroundColor: '#E3F2FD',
          borderColor: '#2196F3',
        };
      default: // info
        return {
          icon: 'information',
          color: '#2196F3',
          backgroundColor: '#E3F2FD',
          borderColor: '#2196F3',
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
      <View style={styles.buttonContainer}>
        {buttons.map((button, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.button,
              button.style === 'cancel' ? styles.cancelButton : styles.confirmButton,
              {
                backgroundColor: button.style === 'cancel' 
                  ? 'transparent' 
                  : button.color || theme.primary,
                borderColor: button.style === 'cancel' 
                  ? theme.border 
                  : button.color || theme.primary,
              }
            ]}
            onPress={() => {
              button.onPress && button.onPress();
              if (button.dismissOnPress !== false) {
                handleDismiss();
              }
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color: button.style === 'cancel' 
                    ? theme.textSecondary 
                    : 'white'
                }
              ]}
            >
              {button.text}
            </Text>
          </TouchableOpacity>
        ))}
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
      <Animated.View
        style={[
          styles.overlay,
          {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            opacity: overlayAnim,
          }
        ]}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={type !== 'confirm' ? handleDismiss : undefined}
        >
          <Animated.View
            style={[
              styles.messageBox,
              {
                backgroundColor: theme.cardBackground,
                borderColor: typeConfig.borderColor,
              },
              getAnimationStyle(),
            ]}
          >
            {/* Header with Icon */}
            {showIcon && (
              <View style={[styles.header, { backgroundColor: typeConfig.backgroundColor }]}>
                <Icon
                  name={iconName}
                  size={32}
                  color={typeConfig.color}
                />
              </View>
            )}

            {/* Content */}
            <View style={styles.content}>
              {title && (
                <Text style={[styles.title, { color: theme.text }]}>
                  {title}
                </Text>
              )}
              {message && (
                <Text style={[styles.message, { color: theme.textSecondary }]}>
                  {message}
                </Text>
              )}
            </View>

            {/* Buttons */}
            <View style={styles.footer}>
              {renderButtons()}
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  messageBox: {
    width: screenWidth * 0.85,
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 2,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  singleButton: {
    marginTop: 8,
  },
  confirmButton: {
    borderWidth: 0,
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ThemedMessageBox;