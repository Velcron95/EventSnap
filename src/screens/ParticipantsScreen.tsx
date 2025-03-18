import React, { useEffect, useState, useLayoutEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, SafeAreaView, BackHandler, Clipboard, Platform } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { EventTabParamList, RootStackParamList } from '../../types';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing } from '../styles/theme';
import { HeaderBar } from '../components/HeaderBar';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { refreshCurrentUserDisplayName } from '../lib/displayNameUtils';

type ParticipantsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<EventTabParamList, 'Participants'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type ParticipantsScreenRouteProp = RouteProp<RootStackParamList, 'EventTabs'>;

type Participant = {
  id: string;
  user_id: string;
  event_id: string;
  joined_at: string;
  user: {
    id: string;
    display_name: string;
    email: string;
  };
};

// Add this helper function at the top of the file
const ONE_MINUTE = 60 * 1000;

// Wrap the component with React.memo to prevent unnecessary re-renders
export const ParticipantsScreen = React.memo(() => {
  const navigation = useNavigation<ParticipantsScreenNavigationProp>();
  const route = useRoute<ParticipantsScreenRouteProp>();
  const { currentEvent, isCreator, refreshEvent, setCurrentEvent } = useEvent();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [removing, setRemoving] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'participants' | 'blocked'>('participants');
  const [deletingEvent, setDeletingEvent] = useState(false);
  
  // Change password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [eventCode, setEventCode] = useState<string>('');

  // Get event ID from route params or context
  const eventId = route.params?.eventId || currentEvent?.id;
  const eventName = route.params?.eventName || currentEvent?.name;

  // Add a handler for the back button
  const handleBackPress = () => {
    navigation.navigate('Events');
  };

  // Use useFocusEffect to handle hardware back button
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        // If a modal is open, close it instead of navigating
        if (showBlockModal) {
          setShowBlockModal(false);
          return true;
        }
        if (showPasswordModal) {
          setShowPasswordModal(false);
          return true;
        }
        
        // Otherwise, let the EventTabNavigator handle it
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [showBlockModal, showPasswordModal])
  );

  // Add ref to track last fetch time
  const lastFetchTime = useRef<number>(0);
  
  // Only fetch data when focused if needed
  useFocusEffect(
    React.useCallback(() => {
      if (eventId) {
        console.log('ParticipantsScreen focused - checking if refresh needed');
        
        // Check if we need to refresh data
        const now = Date.now();
        // Only fetch if data is stale (older than 1 minute) or no data exists
        if (!participants.length || (now - lastFetchTime.current > ONE_MINUTE)) {
          console.log('Fetching fresh participants data');
          fetchParticipants();
          lastFetchTime.current = now;
        } else {
          console.log('Using cached participants data');
        }
      }
      return () => {
        // Clean up if needed
      };
    }, [eventId, participants.length])
  );

  useEffect(() => {
    if (!eventId) {
      Alert.alert('Error', 'No event selected. Please select an event first.');
      navigation.navigate('Events');
      return;
    }

    // Check if the current user has access to this event
    const checkEventAccess = async () => {
      try {
        // Get the current user ID
        const { data: session } = await supabase.auth.getSession();
        const currentUserId = session?.session?.user?.id;
        
        if (!currentUserId) {
          setError('You are not logged in');
          return false;
        }
        
        // Check if the user is a participant in this event
        const { data: participantData, error: participantError } = await supabase
          .from('event_participants')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', currentUserId)
          .single();

        if (participantError && participantError.code !== 'PGRST116') {
          console.error('Error checking event access:', participantError);
          setError('You do not have access to this event');
          return false;
        }

        // If not a participant and not the creator, show error
        if (!participantData && !isCreator) {
          setError('You do not have access to this event');
          return false;
        }

        return true;
      } catch (err) {
        console.error('Error checking event access:', err);
        return false;
      }
    };

    const loadData = async () => {
      const hasAccess = await checkEventAccess();
      if (hasAccess) {
        fetchParticipants();
        if (isCreator) {
          fetchBlockedUsers();
        }
      }
    };

    loadData();

    // Subscribe to changes in the event_participants table
    const participantsSubscription = supabase
      .channel('participants-channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'event_participants',
        filter: `event_id=eq.${eventId}`
      }, () => {
        fetchParticipants();
      })
      .subscribe();

    // Subscribe to changes in the event_blocked_users table
    const blockedUsersSubscription = supabase
      .channel('blocked-users-channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'event_blocked_users',
        filter: `event_id=eq.${eventId}`
      }, () => {
        fetchBlockedUsers();
      })
      .subscribe();

    return () => {
      participantsSubscription.unsubscribe();
      blockedUsersSubscription.unsubscribe();
    };
  }, [eventId]);

  const fetchParticipants = async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      console.log('Fetching participants for event:', eventId);
      
      // First, get the event details to get the creator
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id, name, created_by, created_at, creator_display_name, event_code')
        .eq('id', eventId)
        .single();
        
      if (eventError) {
        console.error('Error fetching event details:', eventError);
        throw eventError;
      }
      
      console.log('Event data:', JSON.stringify(eventData, null, 2));
      
      // Store the event code
      if (eventData?.event_code) {
        setEventCode(eventData.event_code);
      }
      
      // Get participants for the current event with display_name
      const { data: participantsData, error: participantsError } = await supabase
        .from('event_participants')
        .select('id, user_id, event_id, joined_at, display_name')
        .eq('event_id', eventId)
        .order('joined_at', { ascending: false });

      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
        throw participantsError;
      }
      
      console.log('Participants data:', JSON.stringify(participantsData, null, 2));
      
      // Get creator's display name - use the new creator_display_name field if available
      let creatorDisplayName = eventData?.creator_display_name || '';
      
      // If creator_display_name is not available, fall back to the old method
      if (!creatorDisplayName && eventData?.created_by) {
        try {
          // First try to get from user table
          const { data: creatorData, error: creatorError } = await supabase
            .from('user')
            .select('display_name')
            .eq('id', eventData.created_by)
            .single();
            
          if (!creatorError && creatorData && creatorData.display_name) {
            creatorDisplayName = creatorData.display_name;
            console.log('Found creator display name in user table:', creatorDisplayName);
          } else {
            console.log('Creator not found in user table, trying to get from auth.users');
            
            // Try to get directly from auth.users using a function
            const { data: authUserData, error: authUserError } = await supabase
              .rpc('get_user_display_name', { user_id: eventData.created_by });
              
            if (!authUserError && authUserData) {
              creatorDisplayName = authUserData;
              console.log('Found creator display name from auth.users:', creatorDisplayName);
            } else {
              console.log('Failed to get creator display name from auth.users:', authUserError);
              
              // Try to get from auth.users metadata via the current user if it's the creator
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session?.user?.id === eventData.created_by) {
                creatorDisplayName = sessionData.session?.user?.user_metadata?.display_name || 
                                    sessionData.session?.user?.email?.split('@')[0] || 
                                    `User ${eventData.created_by.substring(0, 6)}`;
                console.log('Using current user session for creator display name:', creatorDisplayName);
              } else {
                // As a last resort, use a shortened ID
                creatorDisplayName = `User ${eventData.created_by.substring(0, 6)}`;
                console.log('Using fallback ID for creator display name:', creatorDisplayName);
              }
            }
          }
        } catch (err) {
          console.error('Error getting creator display name:', err);
          creatorDisplayName = `User ${eventData.created_by.substring(0, 6)}`;
        }
      } else {
        console.log('Using creator_display_name from events table:', creatorDisplayName);
      }
      
      // Map the participants data
      const mappedParticipants = (participantsData || []).map(participant => ({
        ...participant,
        user: {
          id: participant.user_id,
          display_name: participant.display_name || `User ${participant.user_id.substring(0, 6)}`,
          email: ''
        }
      }));
      
      // Check if creator is already in the participants list
      const creatorInList = mappedParticipants.some(p => p.user_id === eventData?.created_by);
      
      // If creator is not in the list, add them
      if (eventData?.created_by && !creatorInList) {
        console.log('Adding creator to participants list');
        mappedParticipants.push({
          id: 'creator-' + eventData.id,
          user_id: eventData.created_by,
          event_id: eventData.id,
          joined_at: eventData.created_at,
          display_name: creatorDisplayName,
          user: {
            id: eventData.created_by,
            display_name: creatorDisplayName,
            email: ''
          }
        });
      }
      
      // Sort the list to put the creator at the top
      mappedParticipants.sort((a, b) => {
        // Creator always comes first
        if (a.user_id === eventData?.created_by) return -1;
        if (b.user_id === eventData?.created_by) return 1;
        
        // Otherwise sort by joined date (newest first)
        return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime();
      });
      
      console.log('Final participants list:', mappedParticipants.length);
      setParticipants(mappedParticipants as Participant[]);
    } catch (err) {
      console.error('Error fetching participants:', err);
      setError('Failed to load participants');
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedUsers = async () => {
    if (!eventId || !isCreator) return;

    try {
      const { data, error } = await supabase
        .from('event_blocked_users')
        .select(`
          id,
          user_id,
          blocked_at,
          reason
        `)
        .eq('event_id', eventId);

      if (error) {
        console.error('Error fetching blocked users:', error);
        return;
      }

      // For each blocked user, try to get their display name
      const blockedUsersWithNames = await Promise.all((data || []).map(async (blockedUser) => {
        try {
          // Try to get user info from auth.users
          const { data: userData, error: userError } = await supabase
            .from('user')
            .select('display_name')
            .eq('id', blockedUser.user_id)
            .single();

          if (userError || !userData) {
            return {
              ...blockedUser,
              display_name: `User ${blockedUser.user_id.substring(0, 6)}`
            };
          }

          return {
            ...blockedUser,
            display_name: userData.display_name
          };
        } catch (err) {
          console.error('Error fetching blocked user info:', err);
          return {
            ...blockedUser,
            display_name: `User ${blockedUser.user_id.substring(0, 6)}`
          };
        }
      }));

      setBlockedUsers(blockedUsersWithNames);
    } catch (err) {
      console.error('Error fetching blocked users:', err);
    }
  };

  const removeParticipant = async (participant: Participant) => {
    if (!isCreator) {
      Alert.alert('Error', 'Only the event creator can remove participants');
      return;
    }

    const displayName = participant.user?.display_name || 'this participant';

    Alert.alert(
      'Remove Participant',
      `Are you sure you want to remove ${displayName} from this event?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setRemoving(true);
              
              const { error } = await supabase
                .from('event_participants')
                .delete()
                .eq('id', participant.id);
              
              if (error) throw error;
              
              // Remove from local state
              setParticipants(participants.filter(p => p.id !== participant.id));
              
              // Refresh event to update participant count
              if (refreshEvent) {
                await refreshEvent();
              }
              
              Alert.alert('Success', 'Participant removed successfully');
            } catch (error) {
              console.error('Remove participant error:', error);
              Alert.alert('Error', 'Failed to remove participant');
            } finally {
              setRemoving(false);
            }
          }
        }
      ]
    );
  };

  const openBlockModal = (participant: Participant) => {
    if (!isCreator) {
      Alert.alert('Error', 'Only the event creator can block participants');
      return;
    }

    // Don't allow blocking the event creator
    if (currentEvent?.created_by === participant.user_id) {
      Alert.alert('Error', 'You cannot block yourself as the event creator');
      return;
    }

    setSelectedParticipant(participant);
    setBlockReason('');
    setShowBlockModal(true);
  };

  const blockParticipant = async () => {
    if (!selectedParticipant || !eventId || !isCreator) return;

    try {
      setBlocking(true);
      
      // Call the block_user_from_event function
      const { data, error } = await supabase
        .rpc('block_user_from_event', {
          p_event_id: eventId,
          p_user_id: selectedParticipant.user_id,
          p_reason: blockReason
        });
      
      if (error) throw error;
      
      // Remove from local state
      setParticipants(participants.filter(p => p.id !== selectedParticipant.id));
      
      // Refresh blocked users list
      fetchBlockedUsers();
      
      // Refresh event to update participant count
      if (refreshEvent) {
        await refreshEvent();
      }
      
      setShowBlockModal(false);
      Alert.alert('Success', `${selectedParticipant.user?.display_name} has been blocked from this event`);
    } catch (error) {
      console.error('Block participant error:', error);
      Alert.alert('Error', 'Failed to block participant');
    } finally {
      setBlocking(false);
      setSelectedParticipant(null);
    }
  };

  const unblockUser = async (userId: string, displayName: string) => {
    if (!eventId || !isCreator) return;

    try {
      // Call the unblock_user_from_event function
      const { data, error } = await supabase
        .rpc('unblock_user_from_event', {
          p_event_id: eventId,
          p_user_id: userId
        });
      
      if (error) throw error;
      
      // Add the user back to the event as a participant
      const { error: addError } = await supabase
        .from('event_participants')
        .insert({
          event_id: eventId,
          user_id: userId,
          display_name: displayName
        });
        
      if (addError) {
        console.error('Error adding user back to event:', addError);
        Alert.alert('Warning', 'User was unblocked but could not be added back to the event automatically');
      } else {
        // Refresh event to update participant count
        if (refreshEvent) {
          await refreshEvent();
        }
        
        Alert.alert('Success', 'User has been unblocked and added back to the event');
      }
      
      // Refresh blocked users list
      fetchBlockedUsers();
      // Refresh participants list
      fetchParticipants();
      
    } catch (error) {
      console.error('Unblock user error:', error);
      Alert.alert('Error', 'Failed to unblock user');
    }
  };

  const handleDeleteEventPress = () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This will permanently remove all event data including photos, participants, and settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: deleteEvent
        }
      ]
    );
  };

  const deleteEvent = async () => {
    if (!currentEvent || !isCreator) {
      Alert.alert('Error', 'You must be the event creator to delete this event');
      return;
    }

    setDeletingEvent(true);

    try {
      console.log('Starting event deletion process for event:', currentEvent.id);
      
      // Get current user to verify creator status
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user:', userError);
        throw new Error('Authentication error. Please try again.');
      }
      
      if (!user) {
        throw new Error('You must be logged in to delete an event');
      }
      
      // Double-check that the current user is the creator
      if (currentEvent.created_by !== user.id) {
        throw new Error('Only the event creator can delete this event');
      }
      
      console.log('User authenticated as creator:', user.id);
      
      // 1. Delete all media from storage
      console.log('Deleting event media from storage...');
      
      // Get all media for this event
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('id, url')
        .eq('event_id', currentEvent.id);
      
      if (mediaError) {
        console.error('Error fetching media:', mediaError);
        throw mediaError;
      }
      
      console.log(`Found ${mediaData?.length || 0} media items to delete`);
      
      // Extract file paths from URLs
      const mediaFiles = mediaData?.map(item => {
        const url = item.url;
        // Extract the path after /media/
        const pathMatch = url.match(/\/media\/([^?]+)/);
        return pathMatch ? pathMatch[1] : null;
      }).filter(Boolean);
      
      console.log('Extracted file paths:', mediaFiles);
      
      // Delete files from storage if there are any
      if (mediaFiles && mediaFiles.length > 0) {
        console.log(`Attempting to delete ${mediaFiles.length} files from storage`);
        
        // Delete files one by one to avoid batch issues
        for (const filePath of mediaFiles) {
          try {
            const { error: singleFileError } = await supabase.storage
              .from('media')
              .remove([filePath as string]);
              
            if (singleFileError) {
              console.error(`Error deleting file ${filePath}:`, singleFileError);
            } else {
              console.log(`Successfully deleted file: ${filePath}`);
            }
          } catch (fileError) {
            console.error(`Exception deleting file ${filePath}:`, fileError);
          }
        }
      } else {
        console.log('No media files to delete from storage');
      }
      
      // 2. Delete all media records from the database
      console.log('Deleting media records from database...');
      const { error: mediaDeleteError } = await supabase
        .from('media')
        .delete()
        .eq('event_id', currentEvent.id);
        
      if (mediaDeleteError) {
        console.error('Error deleting media records:', mediaDeleteError);
        // Continue with deletion even if media deletion fails
      } else {
        console.log('Successfully deleted media records from database');
      }
      
      // 3. Try to delete from both possible blocked users tables
      console.log('Deleting blocked users...');
      
      // Try to delete from event_blocked_users table
      try {
        const { error: blockedDeleteError } = await supabase
          .from('event_blocked_users')
          .delete()
          .eq('event_id', currentEvent.id);
          
        if (blockedDeleteError) {
          console.error('Error deleting from event_blocked_users:', blockedDeleteError);
        } else {
          console.log('Successfully deleted records from event_blocked_users');
        }
      } catch (error) {
        console.log('event_blocked_users table might not exist, trying blocked_users');
      }
      
      // Also try to delete from blocked_users table as fallback
      try {
        const { error: blockedDeleteError2 } = await supabase
          .from('blocked_users')
          .delete()
          .eq('event_id', currentEvent.id);
          
        if (blockedDeleteError2) {
          console.error('Error deleting from blocked_users:', blockedDeleteError2);
        } else {
          console.log('Successfully deleted records from blocked_users');
        }
      } catch (error) {
        console.log('blocked_users table might not exist either');
      }
      
      // 4. Delete all participants
      console.log('Deleting event participants...');
      const { error: participantsDeleteError } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', currentEvent.id);
        
      if (participantsDeleteError) {
        console.error('Error deleting participants:', participantsDeleteError);
        // Continue with deletion even if participants deletion fails
      } else {
        console.log('Successfully deleted participants from database');
      }
      
      // 5. Finally, delete the event itself
      console.log('Deleting event...');
      const { error: eventDeleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', currentEvent.id)
        .eq('created_by', user.id); // Ensure only the creator can delete
        
      if (eventDeleteError) {
        console.error('Error deleting event:', eventDeleteError);
        throw new Error(`Failed to delete event: ${eventDeleteError.message}`);
      }
      
      console.log('Event successfully deleted');
      
      // Clear the current event from context
      setCurrentEvent(null);
      
      // Show success message
      Alert.alert(
        'Success',
        'Event deleted successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to the Events screen
              navigation.navigate('Events');
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error deleting event:', error);
      Alert.alert('Error', `Failed to delete event: ${error?.message || 'Unknown error'}`);
    } finally {
      setDeletingEvent(false);
    }
  };

  // Function to copy text to clipboard
  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
  };

  const renderParticipantItem = ({ item }: { item: Participant }) => {
    // Check if this participant is the event creator
    const isEventCreator = item.user_id === currentEvent?.created_by;
    
    // Add null check for user object
    if (!item.user) {
      return (
        <View style={styles.participantItem}>
          <View style={styles.participantInfo}>
            <Text style={styles.participantName}>
              Unknown User
              {isEventCreator && <Text style={styles.creatorTag}> (Creator)</Text>}
            </Text>
            <Text style={styles.participantJoinDate}>
              Joined: {new Date(item.joined_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      );
    }
    
    return (
      <View style={[
        styles.participantItem,
        isEventCreator && styles.creatorParticipantItem
      ]}>
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>
            {item.user.display_name || 'Unnamed User'}
            {isEventCreator && <Text style={styles.creatorTag}> (Creator)</Text>}
          </Text>
          <Text style={styles.participantJoinDate}>
            Joined: {new Date(item.joined_at).toLocaleDateString()}
          </Text>
        </View>
        
        {isCreator && !isEventCreator && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.blockButton]}
              onPress={() => openBlockModal(item)}
              disabled={blocking}
            >
              <MaterialIcons name="block" size={20} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton]}
              onPress={() => removeParticipant(item)}
              disabled={removing}
            >
              {removing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="person-remove" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderBlockedUserItem = ({ item }: { item: any }) => {
    return (
      <View style={styles.blockedUserItem}>
        <View style={styles.blockedUserInfo}>
          <Text style={styles.blockedUserName}>
            {item.display_name}
          </Text>
          <Text style={styles.blockedDate}>
            Blocked: {new Date(item.blocked_at).toLocaleDateString()}
          </Text>
          {item.reason && (
            <Text style={styles.blockReason}>
              Reason: {item.reason}
            </Text>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.unblockButton}
          onPress={() => unblockUser(item.user_id, item.display_name)}
        >
          <MaterialIcons name="person-add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchParticipants}
        >
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Event banner with back button */}
      {eventName && (
        <View style={styles.eventBanner}>
          <View style={styles.eventNameContainer}>
            <TouchableOpacity 
              onPress={handleBackPress}
              style={{ marginRight: 10 }}
            >
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.eventActions}>
            {isCreator && (
              <>
                <Text style={styles.creatorBadge}>Creator</Text>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => setShowPasswordModal(true)}
                >
                  <MaterialIcons name="key" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
      
      {/* Only show tabs to creators */}
      {isCreator ? (
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'participants' && styles.activeTab
            ]}
            onPress={() => setActiveTab('participants')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'participants' && styles.activeTabText
            ]}>
              Participants ({participants.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'blocked' && styles.activeTab
            ]}
            onPress={() => setActiveTab('blocked')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'blocked' && styles.activeTabText
            ]}>
              Blocked Users ({blockedUsers.length})
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        // For non-creators, show a simple header
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Participants ({participants.length})</Text>
        </View>
      )}
      
      {/* Only show blocked users tab content to creators when that tab is active */}
      {isCreator && activeTab === 'blocked' ? (
        <>
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Blocked Users ({blockedUsers.length})</Text>
            <Text style={styles.creatorInfo}>Users who are blocked from joining this event</Text>
          </View>
          
          {blockedUsers.length === 0 ? (
            <View style={styles.centerContainer}>
              <MaterialIcons name="block" size={64} color="#8E8E93" />
              <Text style={styles.emptyText}>No blocked users</Text>
            </View>
          ) : (
            <FlatList
              data={blockedUsers}
              renderItem={renderBlockedUserItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.blockedList}
            />
          )}
        </>
      ) : (
        // Show participants list to everyone
        <>
          {isCreator && (
            <View style={styles.headerContainer}>
              <Text style={styles.headerTitle}>Participants ({participants.length})</Text>
              <Text style={styles.creatorInfo}>As the creator, you can remove or block participants</Text>
            </View>
          )}
          
          {participants.length === 0 ? (
            <View style={styles.centerContainer}>
              <MaterialIcons name="people" size={64} color="#8E8E93" />
              <Text style={styles.emptyText}>No participants yet</Text>
            </View>
          ) : (
            <FlatList
              data={participants}
              renderItem={renderParticipantItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.participantsList}
            />
          )}
        </>
      )}

      {/* Block User Modal */}
      <Modal
        visible={showBlockModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBlockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Block User</Text>
            
            <Text style={styles.modalText}>
              Are you sure you want to block {selectedParticipant?.user?.display_name}?
            </Text>
            
            <Text style={styles.modalSubtext}>
              This user will be removed from the event and won't be able to join again.
            </Text>
            
            <TextInput
              style={styles.reasonInput}
              placeholder="Reason for blocking (optional)"
              value={blockReason}
              onChangeText={setBlockReason}
              multiline={true}
              numberOfLines={3}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowBlockModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.blockConfirmButton]}
                onPress={blockParticipant}
                disabled={blocking}
              >
                {blocking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Block User</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Event Code Modal (previously password modal) */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Event Settings</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSectionTitle}>Event Access Code</Text>
            <Text style={styles.modalText}>
              Share this code with others who want to join your event. They'll need both the event name and this code.
            </Text>
            
            <View style={styles.codeContainer}>
              <Text style={styles.eventCodeDisplay}>{eventCode}</Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyToClipboard(eventCode)}
              >
                <MaterialIcons name="content-copy" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.shareCodeButton}
              onPress={() => copyToClipboard(eventCode)}
            >
              <MaterialIcons name="share" size={18} color="#FFFFFF" />
              <Text style={styles.shareCodeText}>Copy Event Code</Text>
            </TouchableOpacity>

            <View style={styles.modalDivider} />

            <Text style={[styles.modalSectionTitle, { color: '#FF3B30' }]}>Delete Event</Text>
            <Text style={styles.modalText}>
              Permanently delete this event and all associated data including photos and participants.
              This action cannot be undone.
            </Text>

            <TouchableOpacity
              style={styles.deleteEventModalButton}
              onPress={() => {
                setShowPasswordModal(false);
                handleDeleteEventPress();
              }}
              disabled={deletingEvent}
            >
              <MaterialIcons name="delete-forever" size={20} color="#FFFFFF" />
              <Text style={styles.deleteEventModalText}>Delete Event</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Show loading overlay when deleting event */}
      {deletingEvent && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Deleting event...</Text>
        </View>
      )}
    </View>
  );
});

// Add display name for debugging
ParticipantsScreen.displayName = 'ParticipantsScreen';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  headerContainer: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  creatorInfo: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  participantsList: {
    padding: spacing.sm,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary,
  },
  participantJoinDate: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  creatorTag: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  removeButton: {
    backgroundColor: '#FF3B30',
  },
  blockButton: {
    backgroundColor: '#FF9500',
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.danger,
    marginBottom: 12,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '500',
  },
  eventBanner: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 50 : spacing.md,
  },
  eventNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  eventName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  creatorBadge: {
    color: '#fff',
    fontSize: 12,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  // Tab navigation
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  // Blocked users section
  blockedSection: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  blockedHeader: {
    padding: spacing.md,
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  blockedList: {
    padding: spacing.sm,
  },
  blockedUserItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#FFF1F0',
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  blockedUserInfo: {
    flex: 1,
  },
  blockedUserName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary,
  },
  blockedDate: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  blockReason: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 4,
    fontStyle: 'italic',
  },
  unblockButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  modalText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButton: {
    backgroundColor: colors.border,
    marginRight: spacing.sm,
  },
  blockConfirmButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  creatorParticipantItem: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)', // Light green background
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  headerButton: {
    marginRight: 16,
    padding: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    minHeight: 80,
  },
  deleteEventContainer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteEventButton: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 8,
  },
  deleteEventText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  deleteEventModalButton: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  deleteEventModalText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 16,
  },
  eventCodeDisplay: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  copyButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  shareCodeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
}); 