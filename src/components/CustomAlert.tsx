import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Modal from 'react-native-modal';
import { MaterialIcons } from '@expo/vector-icons';

type AlertType = 'success' | 'error' | 'info' | 'warning';

interface CustomAlertProps {
  isVisible: boolean;
  type: AlertType;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  onBackdropPress?: () => void;
}

// For global alert management
interface AlertConfig extends Omit<CustomAlertProps, 'isVisible'> {}

let globalAlertConfig: AlertConfig | null = null;
let setAlertVisibleCallback: ((visible: boolean) => void) | null = null;

const alertIcons = {
  success: { name: 'check-circle', color: '#4CAF50' },
  error: { name: 'error', color: '#F44336' },
  info: { name: 'info', color: '#2196F3' },
  warning: { name: 'warning', color: '#FF9800' }
};

// Static alert methods for global use
export const showAlert = (config: AlertConfig) => {
  globalAlertConfig = config;
  if (setAlertVisibleCallback) {
    setAlertVisibleCallback(true);
  }
};

export const hideAlert = () => {
  if (setAlertVisibleCallback) {
    setAlertVisibleCallback(false);
  }
};

// Drop-in replacement for Alert.alert
export const alertPolyfill = {
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
    let type: AlertType = 'info';
    let confirmText = 'OK';
    let cancelText = 'Cancel';
    let onConfirm = () => hideAlert();
    let onCancel = options?.cancelable === false ? undefined : () => hideAlert();
    
    // If we have buttons, extract the actions
    if (buttons && buttons.length > 0) {
      // Find confirm and cancel buttons
      const confirmButton = buttons.find(b => b.style === 'destructive' || b.style === 'default');
      const cancelButton = buttons.find(b => b.style === 'cancel');
      
      // Set type based on destructive action
      if (confirmButton?.style === 'destructive') {
        type = 'error';
      }
      
      // Set button texts
      if (confirmButton) {
        confirmText = confirmButton.text;
        if (confirmButton.onPress) {
          const originalOnPress = confirmButton.onPress;
          onConfirm = () => {
            hideAlert();
            originalOnPress();
          };
        }
      }
      
      if (cancelButton) {
        cancelText = cancelButton.text;
        if (cancelButton.onPress) {
          const originalOnPress = cancelButton.onPress;
          onCancel = () => {
            hideAlert();
            originalOnPress();
          };
        }
      }
    }
    
    showAlert({
      type,
      title,
      message: message || '',
      onConfirm,
      onCancel,
      confirmText,
      cancelText,
      onBackdropPress: onCancel
    });
  }
};

export const CustomAlert: React.FC<CustomAlertProps> = ({
  isVisible,
  type = 'info',
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onBackdropPress
}) => {
  const icon = alertIcons[type];
  
  return (
    <Modal
      isVisible={isVisible}
      animationIn="zoomIn"
      animationOut="zoomOut"
      animationInTiming={400}
      animationOutTiming={300}
      backdropTransitionInTiming={400}
      backdropTransitionOutTiming={300}
      backdropOpacity={0.6}
      onBackdropPress={onBackdropPress || onCancel}
      style={styles.modal}
      useNativeDriverForBackdrop={true}
      useNativeDriver={true}
      statusBarTranslucent
      avoidKeyboard
    >
      <View style={[styles.container, getContainerStyle(type)]}>
        <View style={styles.iconContainer}>
          <MaterialIcons name={icon.name as any} size={48} color={icon.color} />
        </View>
        
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        
        <View style={styles.buttonContainer}>
          {onCancel && (
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.button, 
              styles.confirmButton,
              type === 'error' && styles.errorButton,
              type === 'success' && styles.successButton,
              type === 'warning' && styles.warningButton,
              !onCancel && styles.fullWidthButton
            ]}
            onPress={onConfirm}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmButtonText}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Global Alert component that can be rendered at the root level
export const GlobalAlert: React.FC = () => {
  const [alertVisible, setAlertVisible] = React.useState(false);
  const [config, setConfig] = React.useState<AlertConfig | null>(null);
  
  // Set up the global callback
  React.useEffect(() => {
    setAlertVisibleCallback = setAlertVisible;
    
    return () => {
      setAlertVisibleCallback = null;
    };
  }, []);
  
  // Update config when global config changes
  React.useEffect(() => {
    if (globalAlertConfig) {
      setConfig(globalAlertConfig);
    }
  }, [globalAlertConfig]);
  
  if (!config) return null;
  
  return (
    <CustomAlert
      isVisible={alertVisible}
      {...config}
      onConfirm={() => {
        config.onConfirm?.();
        setAlertVisible(false);
      }}
      onCancel={config.onCancel ? () => {
        config.onCancel?.();
        setAlertVisible(false);
      } : undefined}
      onBackdropPress={() => {
        config.onBackdropPress?.();
        setAlertVisible(false);
      }}
    />
  );
};

// Helper function to get container style based on alert type
const getContainerStyle = (type: AlertType) => {
  switch (type) {
    case 'success':
      return { borderLeftColor: '#4CAF50', borderLeftWidth: 6 };
    case 'error':
      return { borderLeftColor: '#F44336', borderLeftWidth: 6 };
    case 'warning':
      return { borderLeftColor: '#FF9800', borderLeftWidth: 6 };
    case 'info':
      return { borderLeftColor: '#2196F3', borderLeftWidth: 6 };
    default:
      return {};
  }
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 15,
    padding: 10,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 5,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    minWidth: '45%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  confirmButton: {
    backgroundColor: '#2196F3', // Default blue
  },
  errorButton: {
    backgroundColor: '#F44336', // Red for error alerts
  },
  successButton: {
    backgroundColor: '#4CAF50', // Green for success alerts
  },
  warningButton: {
    backgroundColor: '#FF9800', // Orange for warning alerts
  },
  cancelButton: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#eee',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 16,
  },
  fullWidthButton: {
    width: '100%',
  },
});