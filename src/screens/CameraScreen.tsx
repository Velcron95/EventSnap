import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Image,
  SafeAreaView,
  BackHandler
} from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { supabase } from '../lib/supabase';
import { LoadingOverlay } from '../components/LoadingOverlay';

// Define the route params type
type CameraScreenRouteParams = {
  eventId?: string;
};

type CameraScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CameraScreen = () => {
  const navigation = useNavigation<CameraScreenNavigationProp>();
  const route = useRoute();
  const { session } = useAuth();
  const { currentEvent, isCreator } = useEvent();
  
  // Camera state
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  
  // Image preview state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Get event ID from route params or context
  const routeParams = route.params as CameraScreenRouteParams;
  const eventId = routeParams?.eventId || currentEvent?.id;
  
  // Get user from session
  const user = session?.user;
  
  // Check if event is selected
  useEffect(() => {
    if (!eventId) {
      Alert.alert('Error', 'No event selected. Please select an event first.');
      navigation.navigate('Events');
      return;
    }
  }, [eventId, navigation]);
  
  // Toggle camera type (front/back)
  const toggleCameraType = () => {
    setCameraType(current => (current === 'back' ? 'front' : 'back'));
  };

  // Toggle flash mode
  const toggleFlash = () => {
    setFlash(current => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  };

  // Zoom controls
  const zoomIn = () => {
    setZoom(currentZoom => Math.min(currentZoom + 0.1, 1));
  };

  const zoomOut = () => {
    setZoom(currentZoom => Math.max(currentZoom - 0.1, 0));
  };

  // Take a picture
  const takePicture = async () => {
    if (!cameraRef.current) return;
    
    try {
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.7,
        exif: false
      });
      if (photo) {
        setCapturedImage(photo.uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  // Upload media to Supabase
  const uploadMedia = async (uri: string) => {
    if (!currentEvent || !user) {
      Alert.alert('Error', 'You must be logged in and have an active event to upload media');
      return;
    }

    setUploading(true);
    try {
      console.log('Starting upload process for photo:', uri);
      
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('File does not exist at the specified URI');
      }
      
      // Create a unique filename
      const fileExt = uri.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `${currentEvent.id}/photos/${fileName}`;
      console.log('File path for upload:', filePath);

      // Read the file as base64
      console.log('Reading file as base64...');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      if (!base64) {
        throw new Error('Failed to read file as base64');
      }
      
      console.log('Base64 data length:', base64.length);
      
      // Upload to Supabase Storage using base64
      console.log('Uploading to Supabase storage...');
      const { data, error } = await supabase.storage
        .from('media')
        .upload(filePath, decode(base64), {
          contentType: `image/${fileExt}`,
          upsert: true
        });

      if (error) {
        console.error('Supabase storage upload error:', error);
        throw error;
      }

      console.log('Upload successful, data:', data);

      // Get the public URL for the uploaded file
      const { data: publicURLData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const publicURL = publicURLData.publicUrl;
      console.log('Public URL:', publicURL);

      // Add entry to the media table
      console.log('Adding entry to media table...');
      const { data: mediaData, error: dbError } = await supabase
        .from('media')
        .insert({
          event_id: currentEvent.id,
          user_id: user.id,
          url: publicURL,
          type: 'photo',
        })
        .select();

      if (dbError) {
        console.error('Database insert error:', dbError);
        throw dbError;
      }

      console.log('Database entry created:', mediaData);
      Alert.alert('Success', 'Your photo has been uploaded to the event gallery!');
      
      // Clear preview and stay on camera screen
      setCapturedImage(null);
    } catch (error: unknown) {
      console.error('Error uploading photo:', error);
      // More detailed error message
      let errorMessage = 'There was a problem uploading your photo.';
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Helper function to decode base64
  const decode = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // Discard the preview and return to camera
  const discardPreview = () => {
    setCapturedImage(null);
  };

  // Permission handling
  if (!permission) {
    return (
      <View style={styles.container}>
        <LoadingOverlay isVisible={true} message="Requesting camera permissions..." />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permission to use the camera</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, { marginTop: 10 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show preview if we have an image
  if (capturedImage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.preview} />
          
          <View style={styles.previewControls}>
            {uploading ? (
              <LoadingOverlay isVisible={true} message="Uploading photo..." />
            ) : (
              <>
                <TouchableOpacity 
                  style={styles.previewButton}
                  onPress={discardPreview}
                >
                  <MaterialIcons name="close" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Discard</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.previewButton, styles.uploadButton]}
                  onPress={() => uploadMedia(capturedImage)}
                >
                  <MaterialIcons name="cloud-upload" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Upload to Event</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Main camera view
  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera}
        facing={cameraType}
        enableTorch={flash === 'on'}
        flash={flash}
        zoom={zoom}
        ref={cameraRef}
      >
        <View style={styles.topControls}>
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={toggleFlash}
          >
            <MaterialIcons 
              name={
                flash === 'off' ? "flash-off" : 
                flash === 'on' ? "flash-on" : "flash-auto"
              } 
              size={24} 
              color="#fff" 
            />
          </TouchableOpacity>
          
          <View style={styles.zoomControls}>
            <TouchableOpacity 
              style={styles.zoomButton}
              onPress={zoomOut}
            >
              <MaterialIcons name="remove" size={24} color="#fff" />
            </TouchableOpacity>
            
            <Text style={styles.zoomText}>{Math.round(zoom * 10)}x</Text>
            
            <TouchableOpacity 
              style={styles.zoomButton}
              onPress={zoomIn}
            >
              <MaterialIcons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.bottomControls}>
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={toggleCameraType}
          >
            <MaterialIcons name="flip-camera-android" size={28} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.captureButton}
            onPress={takePicture}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          
          <View style={{ width: 50 }} />
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    maxWidth: 300,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  camera: {
    flex: 1,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preview: {
    width: '100%',
    height: '80%',
    backgroundColor: '#222',
  },
  previewControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    padding: 20,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 10,
  },
  uploadButton: {
    backgroundColor: 'rgba(0,122,255,0.8)',
  },
  button: {
    backgroundColor: 'rgba(0,122,255,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginVertical: 10,
    width: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    paddingHorizontal: 10,
  },
  zoomButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 5,
  },
}); 