import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { HeaderBar } from '../components/HeaderBar';

type CreateEventScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CreateEventScreen = () => {
  const [eventName, setEventName] = useState('');
  const [eventPassword, setEventPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const navigation = useNavigation<CreateEventScreenNavigationProp>();

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to select a background image.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setBackgroundImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadBackgroundImage = async (eventId: string) => {
    if (!backgroundImage) return null;
    
    try {
      setUploadingImage(true);
      console.log('Starting background image upload process...');
      console.log('Background image URI:', backgroundImage);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');
      
      // Create a unique filename
      const fileExt = backgroundImage.split('.').pop() || 'jpg';
      const fileName = `event_bg_${eventId}_${Date.now()}.${fileExt}`;
      const filePath = `events/backgrounds/${fileName}`;
      console.log('File path for upload:', filePath);
      
      // Read the file as base64
      console.log('Reading file as base64...');
      try {
        const base64 = await FileSystem.readAsStringAsync(backgroundImage, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        if (!base64) {
          throw new Error('Failed to read file as base64');
        }
        
        console.log('Base64 data length:', base64.length);
        
        // Check if the bucket exists
        const { data: buckets, error: bucketsError } = await supabase.storage
          .listBuckets();
          
        console.log('Available buckets:', buckets);
        
        if (bucketsError) {
          console.error('Error listing buckets:', bucketsError);
          throw bucketsError;
        }
        
        // Use the first available bucket if 'media' doesn't exist
        let bucketName = 'media';
        if (buckets && buckets.length > 0) {
          const mediaBucket = buckets.find(b => b.name === 'media');
          if (!mediaBucket) {
            bucketName = buckets[0].name;
            console.log('Media bucket not found, using bucket:', bucketName);
          }
        }
        
        // Upload to Supabase Storage
        console.log(`Uploading to Supabase storage bucket '${bucketName}'...`);
        
        // Convert base64 to Uint8Array
        const binaryData = decode(base64);
        console.log('Binary data length:', binaryData.length);
        
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(filePath, binaryData, {
            contentType: `image/${fileExt}`,
            upsert: true
          });

        if (error) {
          console.error('Supabase storage upload error:', error);
          throw error;
        }

        console.log('Upload successful, data:', data);
        
        // Get the public URL
        const { data: publicURLData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);

        console.log('Public URL:', publicURLData.publicUrl);
        return publicURLData.publicUrl;
      } catch (fileError: any) {
        console.error('Error reading or processing file:', fileError);
        throw new Error(`File processing error: ${fileError.message}`);
      }
    } catch (error: any) {
      console.error('Error uploading background image:', error);
      Alert.alert('Upload Error', `Failed to upload background image: ${error.message || 'Unknown error'}`);
      return null;
    } finally {
      setUploadingImage(false);
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

  const handleCreateEvent = async () => {
    if (!eventName || !eventPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      console.log('Starting event creation process...');
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user:', userError);
        Alert.alert('Error', 'Failed to get user information');
        setLoading(false);
        return;
      }
      
      if (!user) {
        console.error('No user found');
        Alert.alert('Error', 'You must be logged in to create an event');
        setLoading(false);
        return;
      }

      console.log('User authenticated:', user.id);

      // Create the event
      console.log('Creating event with name:', eventName);
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          name: eventName,
          password: eventPassword,
          created_by: user.id,
        })
        .select()
        .single();

      if (eventError) {
        console.error('Error creating event:', eventError);
        throw eventError;
      }

      console.log('Event created successfully:', event);

      // Upload background image if selected
      let backgroundImageUrl = null;
      if (backgroundImage) {
        console.log('Uploading background image...');
        backgroundImageUrl = await uploadBackgroundImage(event.id);
        
        if (backgroundImageUrl) {
          console.log('Background image uploaded successfully, updating event with URL:', backgroundImageUrl);
          
          // Update the event with the background image URL
          try {
            // First try with the standard update
            const { data: updatedEvent, error: updateError } = await supabase
              .from('events')
              .update({ background_image: backgroundImageUrl })
              .eq('id', event.id)
              .select()
              .single();
              
            if (updateError) {
              console.error('Error updating event with background image:', updateError);
              
              // If standard update fails, try with a direct SQL query
              console.log('Trying direct SQL query to update background_image...');
              const { data: sqlData, error: sqlError } = await supabase
                .rpc('update_event_background', { 
                  event_id: event.id, 
                  bg_image_url: backgroundImageUrl 
                });
                
              if (sqlError) {
                console.error('SQL update error:', sqlError);
                Alert.alert('Warning', 'Event was created but we could not save the background image. Please try again later.');
              } else {
                console.log('SQL update result:', sqlData);
                Alert.alert('Success', 'Event created successfully with background image!');
              }
            } else {
              console.log('Event updated successfully with background image:', updatedEvent);
              
              // Verify the background_image field was updated
              if (updatedEvent && updatedEvent.background_image === backgroundImageUrl) {
                console.log('Background image URL verified in database');
              } else {
                console.error('Background image URL mismatch or missing in database response');
                console.log('Expected:', backgroundImageUrl);
                console.log('Received:', updatedEvent?.background_image);
                
                // Try with a direct SQL query as fallback
                console.log('Trying direct SQL query to update background_image...');
                const { data: sqlData, error: sqlError } = await supabase
                  .rpc('update_event_background', { 
                    event_id: event.id, 
                    bg_image_url: backgroundImageUrl 
                  });
                  
                if (sqlError) {
                  console.error('SQL update error:', sqlError);
                } else {
                  console.log('SQL update result:', sqlData);
                }
              }
            }
          } catch (updateError: any) {
            console.error('Exception updating event with background image:', updateError);
            Alert.alert('Warning', `Event was created but we could not save the background image: ${updateError.message}`);
          }
        } else {
          console.error('Failed to upload background image, URL is null');
          Alert.alert('Warning', 'Event was created but we could not upload the background image. Please try again later.');
        }
      }

      // Add the creator as a participant
      console.log('Adding creator as participant...');
      const { error: participantError } = await supabase
        .from('event_participants')
        .insert({
          event_id: event.id,
          user_id: user.id,
        });

      if (participantError) {
        console.error('Error adding participant:', participantError);
        throw participantError;
      }

      console.log('Creator added as participant successfully');

      Alert.alert(
        'Success',
        'Event created successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Just go back to the Events screen
              navigation.goBack();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event: ' + (error as any)?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar title="Create Event" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="event" size={64} color="#007AFF" />
          </View>
          
          <Text style={styles.title}>Create New Event</Text>
          
          <Text style={styles.label}>Event Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter event name"
            value={eventName}
            onChangeText={setEventName}
          />
          
          <Text style={styles.label}>Event Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Create a password for others to join"
            value={eventPassword}
            onChangeText={setEventPassword}
            secureTextEntry
          />
          
          <Text style={styles.label}>Background Image (Optional)</Text>
          <TouchableOpacity 
            style={styles.imagePickerContainer}
            onPress={pickImage}
            disabled={loading || uploadingImage}
          >
            {backgroundImage ? (
              <Image source={{ uri: backgroundImage }} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <MaterialIcons name="add-photo-alternate" size={40} color="#007AFF" />
                <Text style={styles.imagePlaceholderText}>Tap to add a background image</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {backgroundImage && (
            <TouchableOpacity 
              style={styles.changeImageButton}
              onPress={pickImage}
              disabled={loading || uploadingImage}
            >
              <MaterialIcons name="edit" size={16} color="#FFFFFF" />
              <Text style={styles.changeImageText}>Change Image</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.button}
            onPress={handleCreateEvent}
            disabled={loading || uploadingImage}
          >
            {loading || uploadingImage ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Event</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={loading || uploadingImage}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  input: {
    height: 50,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  imagePickerContainer: {
    width: '100%',
    height: 180,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  imagePlaceholderText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  changeImageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    height: 50,
    width: '100%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    height: 50,
    width: '100%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
}); 