import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface UploadSuccessIndicatorProps {
  visible: boolean;
  onAnimationComplete?: () => void;
}

export const UploadSuccessIndicator: React.FC<UploadSuccessIndicatorProps> = ({
  visible,
  onAnimationComplete
}) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset values
      scale.setValue(0);
      opacity.setValue(0);
      
      // Run animation sequence
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.2,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(scale, {
          toValue: 1,
          duration: 100,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Keep visible for a moment
        setTimeout(() => {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start(() => {
            if (onAnimationComplete) {
              onAnimationComplete();
            }
          });
        }, 1500);
      });
    }
  }, [visible, scale, opacity, onAnimationComplete]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.circle,
          {
            opacity,
            transform: [{ scale }]
          }
        ]}
      >
        <MaterialIcons 
          name="check" 
          size={40} 
          color="#FFFFFF" 
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
}); 