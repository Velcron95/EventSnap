import { alertPolyfill } from '../components/CustomAlert';

// Re-export the alert function with the same API as React Native's Alert
export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>,
    options?: { cancelable?: boolean }
  ) => {
    alertPolyfill.alert(title, message, buttons, options);
  }
};

// Use these helper methods for common alert patterns
export const showSuccessAlert = (title: string, message: string, onConfirm?: () => void) => {
  Alert.alert(
    title,
    message,
    [{ text: 'OK', onPress: onConfirm }]
  );
};

export const showErrorAlert = (title: string, message: string, onConfirm?: () => void) => {
  Alert.alert(
    title,
    message,
    [{ text: 'OK', style: 'destructive', onPress: onConfirm }]
  );
};

export const showConfirmationAlert = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText: string = 'OK',
  cancelText: string = 'Cancel'
) => {
  Alert.alert(
    title,
    message,
    [
      { text: cancelText, style: 'cancel', onPress: onCancel },
      { text: confirmText, style: 'destructive', onPress: onConfirm }
    ]
  );
}; 