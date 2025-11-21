import { useState, useCallback } from 'react';

export const useThemedMessageBox = () => {
  const [messageBoxConfig, setMessageBoxConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [],
    autoHide: false,
    autoHideDelay: 3000,
    showIcon: true,
    customIcon: null,
    animationType: 'fade',
  });

  const showMessage = useCallback((config) => {
    setMessageBoxConfig({
      visible: true,
      type: 'info',
      autoHide: false,
      autoHideDelay: 3000,
      showIcon: true,
      customIcon: null,
      animationType: 'fade',
      buttons: [],
      ...config,
    });
  }, []);

  const showSuccess = useCallback((title, message, options = {}) => {
    showMessage({
      type: 'success',
      title,
      message,
      autoHide: true,
      autoHideDelay: 3000,
      animationType: 'scale',
      ...options,
    });
  }, [showMessage]);

  const showError = useCallback((title, message, options = {}) => {
    showMessage({
      type: 'error',
      title,
      message,
      animationType: 'slide',
      ...options,
    });
  }, [showMessage]);

  const showWarning = useCallback((title, message, options = {}) => {
    showMessage({
      type: 'warning',
      title,
      message,
      ...options,
    });
  }, [showMessage]);

  const showInfo = useCallback((title, message, options = {}) => {
    showMessage({
      type: 'info',
      title,
      message,
      ...options,
    });
  }, [showMessage]);

  const showConfirm = useCallback((title, message, onConfirm, onCancel, options = {}) => {
    showMessage({
      type: 'confirm',
      title,
      message,
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: 'Confirm',
          onPress: onConfirm,
        },
      ],
      ...options,
    });
  }, [showMessage]);

  const showCustom = useCallback((config) => {
    showMessage(config);
  }, [showMessage]);

  const hideMessage = useCallback(() => {
    setMessageBoxConfig(prev => ({
      ...prev,
      visible: false,
    }));
  }, []);

  return {
    messageBoxConfig,
    showMessage,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm,
    showCustom,
    hideMessage,
  };
};