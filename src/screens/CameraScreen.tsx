import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Image,
  SafeAreaView
} from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { supabase } from '../lib/supabase';

export const CameraScreen = () => {
  // Camera state
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  
  // Refs
  const cameraRef = useRef<CameraView>(null);
  
  // Navigation and context
  const navigation = useNavigation();
  const { session } = useAuth();
  const { currentEvent } = useEvent();
  
  // Get user from session
  const user = session?.user;

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

  // Take a picture
  const takePicture = async () => {
    if (!cameraRef.current) return;
    
    try {
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.7,
        exif: false
      });
      if (photo) {
        setPreviewImage(photo.uri);
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

    setIsUploading(true);
    try {
      console.log('Starting upload process for:', uri);
      
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
          url: publicURL, // Store the full public URL instead of just the path
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
      setPreviewImage(null);
    } catch (error: unknown) {
      console.error('Error uploading media:', error);
      // More detailed error message
      let errorMessage = 'There was a problem uploading your media.';
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setIsUploading(false);
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
    setPreviewImage(null);
  };

  // Permission handling
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permission to show the camera</Text>
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
  if (previewImage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.previewContainer}>
          <Image source={{ uri: previewImage }} style={styles.preview} />
          
          <View style={styles.previewControls}>
            {isUploading ? (
              <ActivityIndicator size="large" color="#fff" />
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
                  onPress={() => uploadMedia(previewImage)}
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
        ref={cameraRef}
      >
        <View style={styles.topControls}>
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
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
          
          <View style={styles.controlButton} />
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
  camera: {
    flex: 1,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 40,
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
}); 