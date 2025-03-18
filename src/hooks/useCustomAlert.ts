import { useState, useCallback } from 'react';

type AlertType = 'success' | 'error' | 'info' | 'warning';

interface AlertConfig {
  type?: AlertType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface UseCustomAlertResult {
  alertProps: {
    isVisible: boolean;
    type: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    onBackdropPress: () => void;
  };
  showAlert: (config: AlertConfig) => void;
  hideAlert: () => void;
}

export const useCustomAlert = (): UseCustomAlertResult => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({
    type: 'info',
    title: '',
    message: '',
  });

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  const showAlert = useCallback((newConfig: AlertConfig) => {
    setConfig(newConfig);
    setVisible(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (config.onConfirm) {
      config.onConfirm();
    }
    hideAlert();
  }, [config, hideAlert]);

  const handleCancel = useCallback(() => {
    if (config.onCancel) {
      config.onCancel();
    }
    hideAlert();
  }, [config, hideAlert]);

  return {
    alertProps: {
      isVisible: visible,
      type: config.type || 'info',
      title: config.title,
      message: config.message,
      confirmText: config.confirmText,
      cancelText: config.cancelText,
      onConfirm: handleConfirm,
      onCancel: config.onCancel ? handleCancel : undefined,
      onBackdropPress: hideAlert,
    },
    showAlert,
    hideAlert,
  };
}; 