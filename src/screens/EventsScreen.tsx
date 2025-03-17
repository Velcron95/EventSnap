import React, { useEffect, useState, useLayoutEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { Event } from '../types/database';
import { EventCard } from '../components/EventCard';
import { Button } from '../components/Button';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TabParamList, RootStackParamList } from '../../types';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { HeaderBar } from '../components/HeaderBar';
import { LoadingOverlay } from '../components/LoadingOverlay';

type EventWithParticipants = Event & {
  participant_count: number;
};

type EventsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const EventsScreen = () => {
  const navigation = useNavigation<EventsScreenNavigationProp>();
  const { setCurrentEvent } = useEvent();
  const { signOut } = useAuth();
  const [createdEvents, setCreatedEvents] = useState<EventWithParticipants[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<EventWithParticipants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [creatingEvent, setCreatingEvent] = useState(false);

  useEffect(() => {
    fetchUserEvents();

    // Subscribe to changes in the events table
    const eventsSubscription = supabase
      .channel('events-channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'events' 
      }, () => {
        fetchUserEvents();
      })
      .subscribe();

    // Subscribe to changes in the event_participants table
    const participantsSubscription = supabase
      .channel('participants-channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'event_participants' 
      }, () => {
        fetchUserEvents();
      })
      .subscribe();

    return () => {
      eventsSubscription.unsubscribe();
      participantsSubscription.unsubscribe();
    };
  }, []);

  // Add useFocusEffect to refresh events when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Events screen focused, refreshing events...');
      fetchUserEvents();
      return () => {
        // Cleanup function when screen loses focus (optional)
      };
    }, [])
  );

  const fetchUserEvents = async () => {
    try {
      setLoading(true);
      setError(undefined);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('You must be logged in to view events');
        setLoading(false);
        return;
      }

      // Get events created by the user
      const { data: userCreatedEvents, error: createdEventsError } = await supabase
        .from('events')
        .select('*, participant_count:event_participants(count)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (createdEventsError) {
        console.error('Error fetching created events:', createdEventsError);
        setError('Failed to load events. Please try again.');
        setLoading(false);
        return;
      }

      // Format the created events data
      const formattedCreatedEvents = userCreatedEvents.map(event => ({
        ...event,
        participant_count: event.participant_count?.[0]?.count || 0
      }));

      setCreatedEvents(formattedCreatedEvents);

      // Get events the user has joined but didn't create
      const { data: participations, error: participationsError } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id);

      if (participationsError) {
        console.error('Error fetching participations:', participationsError);
        setError('Failed to load events. Please try again.');
        setLoading(false);
        return;
      }

      if (!participations || participations.length === 0) {
        // User hasn't joined any events
        setJoinedEvents([]);
        setLoading(false);
        return;
      }

      // Get the event details for joined events
      const eventIds = participations.map(p => p.event_id);
      const { data: joinedEventsData, error: joinedEventsError } = await supabase
        .from('events')
        .select('*, participant_count:event_participants(count)')
        .in('id', eventIds)
        .neq('created_by', user.id) // Exclude events created by the user
        .order('created_at', { ascending: false });

      if (joinedEventsError) {
        console.error('Error fetching joined events:', joinedEventsError);
        setError('Failed to load events. Please try again.');
        setLoading(false);
        return;
      }

      // Format the joined events data
      const formattedJoinedEvents = joinedEventsData.map(event => ({
        ...event,
        participant_count: event.participant_count?.[0]?.count || 0
      }));

      setJoinedEvents(formattedJoinedEvents);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleEventPress = (event: EventWithParticipants) => {
    // Set the current event in context
    console.log('Selected event details:', {
      id: event.id,
      name: event.name,
      background_image: event.background_image,
      created_by: event.created_by,
      participant_count: event.participant_count
    });
    
    setCurrentEvent(event);
    
    // Navigate to event tabs
    navigation.navigate('EventTabs', {
      eventId: event.id,
      eventName: event.name,
      screen: 'Gallery',
      params: {
        eventId: event.id,
        eventName: event.name
      }
    });
  };

  const handleConnectToEvent = () => {
    // Navigate to event connection screen
    navigation.navigate('EventConnection');
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        }
      ]
    );
  };

  const checkDatabaseTables = async () => {
    try {
      // Check auth user
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Auth error:', authError);
        Alert.alert('Auth Error', 'Could not get current user');
        return;
      }
      
      console.log('Current auth user:', authData.user);
      
      // Check user profile
      const { data: userData, error: userError } = await supabase
        .from('user')
        .select('*')
        .eq('id', authData.user.id)
        .single();
        
      if (userError) {
        console.error('User profile error:', userError);
        
        // Ask if user wants to create a profile
        Alert.alert(
          'Profile Not Found',
          'No user profile found in the database. Would you like to create one now?',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Create Profile',
              onPress: () => createUserProfile(authData.user)
            }
          ]
        );
        return;
      }
      
      console.log('User profile:', userData);
      
      // Check events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*');
        
      if (eventsError) {
        console.error('Events error:', eventsError);
        Alert.alert('Events Error', `Could not fetch events: ${eventsError.message}`);
      } else {
        console.log('Events:', eventsData);
      }
      
      // Check event_participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('event_participants')
        .select('*');
        
      if (participantsError) {
        console.error('Event participants error:', participantsError);
        Alert.alert('Participants Error', `Could not fetch participants: ${participantsError.message}`);
      } else {
        console.log('Event participants:', participantsData);
      }
      
      // Check RLS policies
      const { data: policiesData, error: policiesError } = await supabase
        .rpc('get_policies_info');
        
      if (policiesError) {
        console.error('Policies error:', policiesError);
      } else {
        console.log('Policies:', policiesData);
      }
      
      Alert.alert(
        'Database Check',
        `Auth User: ${authData.user.email}\n` +
        `User Profile: ${userData ? 'Found' : 'Not found'}\n` +
        `Events: ${eventsData ? eventsData.length : 0} found\n` +
        `Participants: ${participantsData ? participantsData.length : 0} found`
      );
    } catch (error) {
      console.error('Database check error:', error);
      Alert.alert('Error', 'Failed to check database tables');
    }
  };
  
  const createUserProfile = async (user: any) => {
    try {
      if (!user || !user.id) {
        Alert.alert('Error', 'No user information available');
        return;
      }
      
      const displayName = user.user_metadata?.display_name || 'User';
      
      console.log('Creating user profile manually:', {
        id: user.id,
        display_name: displayName,
        email: user.email
      });
      
      const { data, error } = await supabase
        .from('user')
        .insert({
          id: user.id,
          display_name: displayName,
          email: user.email || '',
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error creating user profile:', error);
        Alert.alert('Error', `Failed to create profile: ${error.message}`);
      } else {
        console.log('Successfully created user profile:', data);
        Alert.alert('Success', 'User profile created successfully');
      }
    } catch (error) {
      console.error('Unexpected error creating profile:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleCreateEvent = () => {
    // Navigate to create event screen
    navigation.navigate('CreateEvent');
  };

  const renderEventCard = (event: EventWithParticipants, isCreated: boolean) => {
    console.log('Rendering event card:', {
      id: event.id,
      name: event.name,
      background_image: event.background_image,
      created_by: event.created_by
    });
    
    return (
      <EventCard
        key={event.id}
        title={event.name}
        participantCount={event.participant_count}
        onPress={() => handleEventPress(event)}
        style={styles.eventCard}
        isCreator={isCreated}
        imageUrl={event.background_image}
      />
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingOverlay isVisible={true} message="Loading events..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBar />
      <ScrollView style={styles.scrollView}>
        {/* Main Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
            onPress={handleCreateEvent}
          >
            <MaterialIcons name="add-circle" size={32} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Create New Event</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#007AFF' }]}
            onPress={handleConnectToEvent}
          >
            <MaterialIcons name="link" size={32} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Connect to Event</Text>
          </TouchableOpacity>
        </View>
        
        {/* Your Created Events Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Your Events</Text>
          
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Button 
                title="Try Again" 
                onPress={fetchUserEvents} 
                style={styles.retryButton}
              />
            </View>
          ) : createdEvents.length === 0 ? (
            <View style={styles.emptyEventsContainer}>
              <MaterialIcons name="event-busy" size={64} color="#8E8E93" />
              <Text style={styles.emptyText}>You haven't created any events yet</Text>
            </View>
          ) : (
            createdEvents.map((item) => renderEventCard(item, true))
          )}
        </View>

        {/* Events You've Joined Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Joined Events</Text>
          
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : joinedEvents.length === 0 ? (
            <View style={styles.emptyEventsContainer}>
              <MaterialIcons name="people" size={64} color="#8E8E93" />
              <Text style={styles.emptyText}>You haven't joined any events yet</Text>
            </View>
          ) : (
            joinedEvents.map((item) => renderEventCard(item, false))
          )}
        </View>
      </ScrollView>

      {/* Show loading overlay when creating event */}
      {creatingEvent && (
        <LoadingOverlay isVisible={true} message="Creating event..." />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F2F2F7',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    height: 100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  sectionContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1C1C1E',
  },
  emptyEventsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    textAlign: 'center',
  },
  eventCard: {
    marginBottom: 16,
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    minWidth: 120,
  },
  button: {
    width: 200,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
}); 