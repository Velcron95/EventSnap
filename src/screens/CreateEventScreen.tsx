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
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { MaterialIcons } from '@expo/vector-icons';

type CreateEventScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CreateEventScreen = () => {
  const [eventName, setEventName] = useState('');
  const [eventPassword, setEventPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<CreateEventScreenNavigationProp>();

  const handleCreateEvent = async () => {
    if (!eventName || !eventPassword) {
      Alert.alert('Error', 'Please fill in all fields');
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
            onPress: () => navigation.goBack()
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
    <KeyboardAvoidingView
      style={styles.container}
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
        
        <TouchableOpacity
          style={styles.button}
          onPress={handleCreateEvent}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Event</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
}); 