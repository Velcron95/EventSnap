import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { TabParamList } from '../../types';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useEvent } from '../context/EventContext';
import { HeaderBar } from '../components/HeaderBar';

type EventConnectionScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList, 'EventConnection'>,
  BottomTabNavigationProp<TabParamList>
>;

export const EventConnectionScreen: React.FC = () => {
  const navigation = useNavigation<EventConnectionScreenNavigationProp>();
  const { setCurrentEvent } = useEvent();
  const [eventName, setEventName] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  
  // For code modal - keeping this for potential future use
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [codeInput, setCodeInput] = useState('');

  const handleJoinSuccess = (event: any) => {
    // Set the current event in context
    setCurrentEvent(event);
    
    // Show success message
    Alert.alert(
      'Success',
      'You have joined the event!',
      [
        {
          text: 'OK',
          onPress: () => {
            // Navigate to the Events screen
            navigation.reset({
              index: 0,
              routes: [{ name: 'Events' }],
            });
          }
        }
      ]
    );
  };

  const handleJoinEvent = async (selectedEventName?: string, selectedEventCode?: string) => {
    const nameToUse = selectedEventName || eventName;
    const codeToUse = selectedEventCode || eventCode;
    
    if (!nameToUse || !codeToUse) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw userError;
      }
      
      if (!user) {
        setError('You must be logged in to join an event');
        setLoading(false);
        return;
      }

      // Find the event by name and code
      const { data: events, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('name', nameToUse)
        .eq('event_code', codeToUse);
      
      if (eventError) {
        throw eventError;
      }
      
      if (!events || events.length === 0) {
        setError('No event found with that name and code. Please check and try again.');
        setLoading(false);
        return;
      }

      const event = events[0];

      // Check if user is already a participant
      const { data: existingParticipant, error: participantCheckError } = await supabase
        .from('event_participants')
        .select('*')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .single();
      
      if (participantCheckError && participantCheckError.code !== 'PGRST116') {
        throw participantCheckError;
      }
      
      if (existingParticipant) {
        // User is already a participant, just navigate to the event
        handleJoinSuccess(event);
        setLoading(false);
        return;
      }

      // Add user as a participant
      const { error: joinError } = await supabase
        .from('event_participants')
        .insert({
          event_id: event.id,
          user_id: user.id,
        });
      
      if (joinError) {
        throw joinError;
      }

      // Success! Navigate to the event
      handleJoinSuccess(event);
    } catch (err: any) {
      console.error('Error joining event:', err);
      setError(err.message || 'Failed to join event');
    } finally {
      setLoading(false);
      setCodeModalVisible(false);
      setCodeInput('');
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar title="Connect to Event" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <MaterialIcons name="link" size={48} color="#007AFF" />
            <Text style={styles.title}>Connect to Event</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Join with Event Details</Text>
            
            <Input
              label="Event Name"
              value={eventName}
              onChangeText={setEventName}
              placeholder="Enter event name"
              autoCapitalize="none"
            />
            
            <Input
              label="Event Code"
              value={eventCode}
              onChangeText={(text) => setEventCode(text.toUpperCase())}
              placeholder="Enter 8-character event code"
              autoCapitalize="characters"
              maxLength={8}
            />
            
            {error && <Text style={styles.errorText}>{error}</Text>}
            
            <Button
              title="Join Event"
              onPress={() => handleJoinEvent()}
              loading={loading}
              style={styles.button}
            />
          </View>
        </ScrollView>

        {/* Code Modal - keeping this for potential future use */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={codeModalVisible}
          onRequestClose={() => setCodeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter Event Code</Text>
              <Text style={styles.modalSubtitle}>
                {selectedEvent ? `Enter code for "${selectedEvent.name}"` : ''}
              </Text>
              
              <TextInput
                style={styles.codeInput}
                placeholder="8-character code"
                value={codeInput}
                onChangeText={(text) => setCodeInput(text.toUpperCase())}
                autoCapitalize="characters"
                maxLength={8}
                autoFocus
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setCodeModalVisible(false);
                    setCodeInput('');
                    setSelectedEvent(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.joinButton]}
                  onPress={() => {
                    if (selectedEvent && codeInput) {
                      handleJoinEvent(selectedEvent.name, codeInput);
                    }
                  }}
                >
                  <Text style={styles.joinButtonText}>Join</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 10,
  },
  button: {
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: '#007AFF',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
}); 