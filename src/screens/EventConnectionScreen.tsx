import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
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

type EventConnectionScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList, 'EventConnection'>,
  BottomTabNavigationProp<TabParamList>
>;

type EventWithParticipants = {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
  participant_count: number;
};

export const EventConnectionScreen: React.FC = () => {
  const navigation = useNavigation<EventConnectionScreenNavigationProp>();
  const { setCurrentEvent } = useEvent();
  const [eventName, setEventName] = useState('');
  const [eventPassword, setEventPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [availableEvents, setAvailableEvents] = useState<EventWithParticipants[]>([]);
  
  // For password modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventWithParticipants | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    fetchAvailableEvents();
  }, []);

  const fetchAvailableEvents = async () => {
    try {
      setSearchLoading(true);
      
      // Get all events with participant counts
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          name,
          created_at,
          created_by,
          participant_count:event_participants(count)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Format the data to include participant count
      const formattedEvents = data.map(event => ({
        ...event,
        participant_count: event.participant_count?.[0]?.count || 0
      }));

      setAvailableEvents(formattedEvents);
    } catch (err) {
      console.error('Error fetching available events:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleJoinEvent = async (selectedEventName?: string, selectedEventPassword?: string) => {
    const nameToUse = selectedEventName || eventName;
    const passwordToUse = selectedEventPassword || eventPassword;
    
    if (!nameToUse || !passwordToUse) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      console.log('Starting join event process...');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('You must be logged in to join an event');
        setLoading(false);
        return;
      }

      console.log('User authenticated:', user.id);

      // Check event credentials
      console.log('Looking for event with name:', nameToUse);
      const { data: event, error: findError } = await supabase
        .from('events')
        .select('id, password')
        .eq('name', nameToUse)
        .single();

      if (findError || !event) {
        console.error('Event not found:', findError);
        setError('Event not found');
        setLoading(false);
        return;
      }

      console.log('Found event:', event.id);

      if (event.password !== passwordToUse) {
        console.log('Password mismatch. Provided:', passwordToUse, 'Expected:', event.password);
        setError('Incorrect password');
        setLoading(false);
        return;
      }

      console.log('Password verified');

      // Check if user is already a participant
      console.log('Checking if user is already a participant...');
      const { data: existingParticipant, error: participantError } = await supabase
        .from('event_participants')
        .select('id')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .single();

      if (participantError) {
        console.log('User is not a participant yet:', participantError.message);
      }

      if (existingParticipant) {
        console.log('User is already a participant:', existingParticipant.id);
        // User is already a participant, just navigate
        // Get full event details
        const { data: fullEvent } = await supabase
          .from('events')
          .select('*')
          .eq('id', event.id)
          .single();
          
        setCurrentEvent(fullEvent);
        navigation.navigate('Main', { screen: 'Events' });
        Alert.alert('Success', `You've joined "${nameToUse}"!`);
        return;
      }

      // Add user to event participants
      console.log('Adding user to event participants...');
      const { data: newParticipant, error: joinError } = await supabase
        .from('event_participants')
        .insert({
          event_id: event.id,
          user_id: user.id,
        })
        .select();

      if (joinError) {
        console.error('Error joining event:', joinError);
        throw joinError;
      }

      console.log('Successfully joined event:', newParticipant);

      // Get full event details
      const { data: fullEvent } = await supabase
        .from('events')
        .select('*')
        .eq('id', event.id)
        .single();
        
      setCurrentEvent(fullEvent);

      // Navigate back to Events screen
      navigation.navigate('Main', { screen: 'Events' });
      Alert.alert('Success', `You've joined "${nameToUse}"!`);
    } catch (err) {
      setError('Failed to join event. Please try again.');
      console.error('Join event error:', err);
    } finally {
      setLoading(false);
      // Clear password modal state
      if (passwordModalVisible) {
        setPasswordModalVisible(false);
        setPasswordInput('');
        setSelectedEvent(null);
      }
    }
  };

  const openPasswordModal = (event: EventWithParticipants) => {
    setSelectedEvent(event);
    setPasswordInput('');
    setPasswordModalVisible(true);
  };

  const renderEventItem = ({ item }: { item: EventWithParticipants }) => (
    <TouchableOpacity 
      style={styles.eventItem}
      onPress={() => openPasswordModal(item)}
    >
      <View style={styles.eventItemContent}>
        <Text style={styles.eventName}>{item.name}</Text>
        <Text style={styles.eventDetails}>
          Created: {new Date(item.created_at).toLocaleDateString()} • 
          Participants: {item.participant_count}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#8E8E93" />
    </TouchableOpacity>
  );

  return (
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
          <Text style={styles.sectionTitle}>Join by Name & Password</Text>
          
          <Input
            label="Event Name"
            value={eventName}
            onChangeText={setEventName}
            placeholder="Enter event name"
            autoCapitalize="none"
          />
          
          <Input
            label="Event Password"
            value={eventPassword}
            onChangeText={setEventPassword}
            placeholder="Enter event password"
            secureTextEntry
          />
          
          {error && <Text style={styles.errorText}>{error}</Text>}
          
          <Button
            title="Join Event"
            onPress={() => handleJoinEvent()}
            loading={loading}
            style={styles.button}
          />
        </View>

        <View style={styles.availableEventsContainer}>
          <Text style={styles.sectionTitle}>Available Events</Text>
          
          {searchLoading ? (
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
          ) : availableEvents.length === 0 ? (
            <Text style={styles.noEventsText}>No events available</Text>
          ) : (
            <FlatList
              data={availableEvents}
              renderItem={renderEventItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              style={styles.eventsList}
            />
          )}
          
          <Button
            title="Refresh Events"
            onPress={fetchAvailableEvents}
            variant="outline"
            loading={searchLoading}
            style={styles.refreshButton}
          />
        </View>
      </ScrollView>

      {/* Password Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={passwordModalVisible}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Password</Text>
            <Text style={styles.modalSubtitle}>
              {selectedEvent ? `Enter password for "${selectedEvent.name}"` : ''}
            </Text>
            
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setPasswordInput('');
                  setSelectedEvent(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.joinButton]}
                onPress={() => {
                  if (selectedEvent && passwordInput) {
                    handleJoinEvent(selectedEvent.name, passwordInput);
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
  availableEventsContainer: {
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
  loader: {
    marginVertical: 20,
  },
  noEventsText: {
    textAlign: 'center',
    color: '#8E8E93',
    marginVertical: 20,
  },
  eventsList: {
    marginBottom: 16,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  eventItemContent: {
    flex: 1,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  eventDetails: {
    fontSize: 14,
    color: '#8E8E93',
  },
  refreshButton: {
    marginTop: 10,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  passwordInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 20,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f2f2f2',
  },
  joinButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  joinButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
}); 