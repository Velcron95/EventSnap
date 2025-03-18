import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../styles/theme';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ 
  visible, 
  message, 
  type = 'success', 
  duration = 3000, 
  onClose 
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(100)).current;
  const [isHidden, setIsHidden] = useState(!visible);
  
  useEffect(() => {
    if (visible) {
      setIsHidden(false);
      // Show the toast
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);
  
  const hideToast = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsHidden(true);
      if (onClose) onClose();
    });
  };
  
  // Get icon and background color based on type
  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: colors.success,
          icon: 'check-circle' as const,
        };
      case 'error':
        return {
          backgroundColor: colors.danger,
          icon: 'error' as const,
        };
      case 'info':
        return {
          backgroundColor: colors.primary,
          icon: 'info' as const,
        };
      default:
        return {
          backgroundColor: colors.success,
          icon: 'check-circle' as const,
        };
    }
  };
  
  const { backgroundColor, icon } = getToastStyles();
  
  if (!visible && isHidden) return null;
  
  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity, 
          transform: [{ translateY }],
          backgroundColor
        },
      ]}
    >
      <View style={styles.content}>
        <MaterialIcons name={icon} size={24} color="white" />
        <Text style={styles.message}>{message}</Text>
      </View>
      <TouchableOpacity onPress={hideToast}>
        <MaterialIcons name="close" size={20} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70,
    left: width * 0.1,
    right: width * 0.1,
    width: width * 0.8,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  message: {
    color: 'white',
    marginLeft: spacing.sm,
    flex: 1,
    fontWeight: '500',
  },
}); 