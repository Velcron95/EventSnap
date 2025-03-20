import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '../components/Button';

interface Props {
  onPermissionsGranted: () => void;
}

export const PermissionsScreen: React.FC<Props> = ({ onPermissionsGranted }) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [photoPermission, requestPhotoPermission] = ImagePicker.useMediaLibraryPermissions();

  // Use useEffect to call onPermissionsGranted when permissions are granted
  useEffect(() => {
    if (cameraPermission?.granted && mediaPermission?.granted && photoPermission?.granted) {
      onPermissionsGranted();
    }
  }, [cameraPermission, mediaPermission, photoPermission, onPermissionsGranted]);

  const handleRequestPermission = async () => {
    try {
      console.log('Requesting permissions...');
      
      // Request camera permission
      const cameraResult = await requestCameraPermission();
      
      // Request media permission
      const mediaResult = await requestMediaPermission();
      
      // Request photo permission
      const photoResult = await requestPhotoPermission();
      
      console.log('Permission results:', { cameraResult, mediaResult, photoResult });

      if (cameraResult.granted && mediaResult?.granted && photoResult?.granted) {
        console.log('All permissions granted');
        // onPermissionsGranted will be called by the useEffect
      } else {
        console.log('Some permissions were denied');
        Alert.alert(
          'Permissions Required',
          'Camera, photo library, and media access are required to use EventSnap. Please enable them in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions');
    }
  };

  // Show loading state while permissions are being checked
  if (!cameraPermission || !mediaPermission || !photoPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.description}>Checking permissions...</Text>
      </View>
    );
  }

  // If any permission is not granted, show the permission request screen
  if (!cameraPermission.granted || !mediaPermission.granted || !photoPermission.granted) {
    return (
      <View style={styles.container}>
        <MaterialIcons name="camera-alt" size={64} color="#007AFF" style={styles.icon} />
        <Text style={styles.title}>Permissions Required</Text>
        <Text style={styles.description}>
          EventSnap needs access to your camera, photo library, and media to take and save photos for event sharing.
          Without these permissions, you won't be able to use the app.
        </Text>
        <Button
          title="Grant Access"
          onPress={handleRequestPermission}
          variant="primary"
          style={styles.button}
        />
      </View>
    );
  }

  // If we reach here, all permissions are granted, but we don't call onPermissionsGranted directly
  // It will be called by the useEffect
  return (
    <View style={styles.container}>
      <MaterialIcons name="check-circle" size={64} color="#4CD964" style={styles.icon} />
      <Text style={styles.title}>Permissions Granted</Text>
      <Text style={styles.description}>
        All required permissions have been granted. You can now use all features of EventSnap.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
    lineHeight: 24,
  },
  button: {
    minWidth: 200,
  },
}); 