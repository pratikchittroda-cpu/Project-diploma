class MessageService {
  constructor() {
    this.messageBoxRef = null;
  }

  setMessageBoxRef(ref) {
    this.messageBoxRef = ref;
  }

  show(config) {
    if (this.messageBoxRef) {
      this.messageBoxRef.showMessage(config);
    }
  }

  showSuccess(title, message, options = {}) {
    this.show({
      type: 'success',
      title,
      message,
      autoHide: true,
      autoHideDelay: 3000,
      animationType: 'scale',
      ...options,
    });
  }

  showError(title, message, options = {}) {
    this.show({
      type: 'error',
      title,
      message,
      animationType: 'slide',
      ...options,
    });
  }

  showWarning(title, message, options = {}) {
    this.show({
      type: 'warning',
      title,
      message,
      ...options,
    });
  }

  showInfo(title, message, options = {}) {
    this.show({
      type: 'info',
      title,
      message,
      ...options,
    });
  }

  showConfirm(title, message, onConfirm, onCancel, options = {}) {
    this.show({
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
  }

  showCustomButtons(title, message, buttons, options = {}) {
    this.show({
      title,
      message,
      buttons,
      ...options,
    });
  }

  hide() {
    if (this.messageBoxRef) {
      this.messageBoxRef.hideMessage();
    }
  }
}

// Create a singleton instance
const messageService = new MessageService();

export default messageService;

// Export individual functions for convenience
export const showSuccess = (title, message, options) => messageService.showSuccess(title, message, options);
export const showError = (title, message, options) => messageService.showError(title, message, options);
export const showWarning = (title, message, options) => messageService.showWarning(title, message, options);
export const showInfo = (title, message, options) => messageService.showInfo(title, message, options);
export const showConfirm = (title, message, onConfirm, onCancel, options) => 
  messageService.showConfirm(title, message, onConfirm, onCancel, options);
export const showMessage = (config) => messageService.show(config);
export const hideMessage = () => messageService.hide();