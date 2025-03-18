import React, { useEffect, useState, useRef, useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Animated, PanResponder, StatusBar, Share, BackHandler, Modal, SafeAreaView, Easing, Switch, Platform } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { EventTabParamList, RootStackParamList } from '../../types';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Media, MediaLike } from '../types/database';
import { MaterialIcons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors, spacing } from '../styles/theme';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { refreshCurrentUserDisplayName } from '../lib/displayNameUtils';
import { RadioButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

type GalleryScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<EventTabParamList, 'Gallery'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type GalleryScreenRouteProp = RouteProp<RootStackParamList, 'EventTabs'>;

type MediaWithUser = Media & {
  user: {
    display_name: string;
  };
  likes_count: number;
  user_has_liked: boolean;
};

const { width, height } = Dimensions.get('window');
const numColumns = 3;
const tileSize = width / numColumns;

// Add "likes" to the SortOption type
type SortOption = 'newest' | 'oldest' | 'most_likes' | 'likes';

export const GalleryScreen = () => {
  const navigation = useNavigation<GalleryScreenNavigationProp>();
  const route = useRoute<GalleryScreenRouteProp>();
  const { currentEvent, isCreator } = useEvent();
  const { session } = useAuth();
  const [media, setMedia] = useState<MediaWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaWithUser | null>(null);
  const [likingInProgress, setLikingInProgress] = useState(false);
  
  // Add a ref to track if we've focused before
  const hasFocusedBefore = useRef(false);
  
  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [multiDeleteInProgress, setMultiDeleteInProgress] = useState(false);

  // Image viewer state
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Add state to track if HeaderBar should be visible
  const [headerVisible, setHeaderVisible] = useState(true);

  // Swipe animation state
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Get event ID from route params or context
  const eventId = route.params?.eventId || currentEvent?.id;
  const eventName = route.params?.eventName || currentEvent?.name;

  // Add new state variables for filtering
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filteredMedia, setFilteredMedia] = useState<MediaWithUser[]>([]);
  // Add new filter to show only user's photos
  const [showOnlyMyPhotos, setShowOnlyMyPhotos] = useState(false);
  
  // Add this for direct swipe handling
  const [imageIndex, setImageIndex] = useState(0);

  // Add a debug effect to check isCreator
  useEffect(() => {
    console.log('GalleryScreen mounted - isCreator:', isCreator, 'eventId:', eventId);
  }, [isCreator, eventId]);

  // Add custom back button handler
  useLayoutEffect(() => {
    // Add a hardware back button handler
    const backHandler = () => {
      if (selectedMedia) {
        // If in full screen mode, just close it
        closeFullScreenImage();
        return true; // Prevent default behavior
      } else {
        // Navigate to Events screen
        navigation.navigate('Events');
        return true; // Prevent default behavior
      }
    };

    // We don't need to set up the handler here since we're handling it at the EventTabNavigator level
  }, [navigation, selectedMedia]);

  // Use useFocusEffect to handle hardware back button
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (selectedMedia) {
          // If in full screen mode, just close it
          closeFullScreenImage();
          return true; // Prevent default behavior
        }
        return false; // Let the EventTabNavigator handle it
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [selectedMedia])
  );

  // Add useFocusEffect to refresh media when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('GalleryScreen focused - refreshing media to update display names');
      
      if (eventId) {
        // First, refresh the current user's display name in all tables
        (async () => {
          try {
            // Refresh the current user's display name in all tables
            await refreshCurrentUserDisplayName();
            console.log('Refreshed current user display name in all tables');
          } catch (error) {
            console.error('Error refreshing display name:', error);
          }
          
          // If we've focused before, this means we're returning to the screen
          // and should force a refresh to get updated display names
          if (hasFocusedBefore.current) {
            console.log('Returning to GalleryScreen - forcing refresh to get updated display names');
            fetchEventMedia();
          } else {
            // First time focusing
            fetchEventMedia();
            hasFocusedBefore.current = true;
          }
        })();
      }
      
      return () => {
        // Cleanup if needed
      };
    }, [eventId])
  );

  useEffect(() => {
    if (!eventId) {
      Alert.alert('Error', 'No event selected. Please select an event first.');
      navigation.navigate('Events');
      return;
    }

    fetchEventMedia();

    // Subscribe to changes in the media table
    const mediaSubscription = supabase
      .channel('media-channel')
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'media',
        filter: `event_id=eq.${eventId}`
      }, (payload) => {
        console.log('DELETE event received:', payload);
        fetchEventMedia();
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'media',
        filter: `event_id=eq.${eventId}`
      }, (payload) => {
        console.log('INSERT event received:', payload);
        fetchEventMedia();
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'media',
        filter: `event_id=eq.${eventId}`
      }, (payload) => {
        console.log('UPDATE event received:', payload);
        fetchEventMedia();
      })
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Subscribe to changes in the media_likes table
    const likesSubscription = supabase
      .channel('likes-channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'media_likes'
      }, (payload) => {
        console.log('Likes change event received:', payload);
        fetchEventMedia();
      })
      .subscribe((status) => {
        console.log('Likes subscription status:', status);
      });

    return () => {
      console.log('Unsubscribing from channels');
      mediaSubscription.unsubscribe();
      likesSubscription.unsubscribe();
    };
  }, [eventId]);

  const fetchEventMedia = async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      console.log('Fetching media for event:', eventId);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      // First, get the event details to get the creator
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id, name, created_by, created_at, creator_display_name')
        .eq('id', eventId)
        .single();
        
      if (eventError) {
        console.error('Error fetching event details:', eventError);
        throw eventError;
      }
      
      console.log('Event data:', JSON.stringify(eventData, null, 2));
      
      // Get media for the current event with user info only
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select(`
          *,
          user:user_id(display_name)
        `)
        .eq('event_id', eventId)
        .eq('type', 'photo')  // Only fetch photos for the gallery
        .order('created_at', { ascending: false });

      if (mediaError) throw mediaError;
      
      // If we have media, try to fetch likes information separately
      if (mediaData && mediaData.length > 0) {
        // Get all media IDs
        const mediaIds = mediaData.map(item => item.id);
        
        // Get all user IDs from media
        const userIds = mediaData.map(item => item.user_id).filter(Boolean);
        const uniqueUserIds = [...new Set(userIds)];
        
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
        
        // Get display names from event_participants table
        const { data: participantsData, error: participantsError } = await supabase
          .from('event_participants')
          .select('user_id, display_name')
          .eq('event_id', eventId)
          .in('user_id', uniqueUserIds);
          
        if (participantsError) {
          console.error('Error fetching participants:', participantsError);
        }
        
        // Create a map of user IDs to display names from participants
        const participantDisplayNames: Record<string, string> = {};
        if (participantsData) {
          participantsData.forEach(participant => {
            if (participant.user_id && participant.display_name) {
              participantDisplayNames[participant.user_id] = participant.display_name;
            }
          });
        }
        
        // Fetch display names for users who don't have them in the initial query
        const usersWithMissingNames = mediaData.filter(item => !item.user?.display_name);
        
        if (usersWithMissingNames.length > 0) {
          console.log(`Fetching display names for ${usersWithMissingNames.length} users`);
          
          // Get display names from user table
          const { data: userData, error: userError } = await supabase
            .from('user')
            .select('id, display_name')
            .in('id', uniqueUserIds);
            
          if (!userError && userData) {
            // Create a map of user IDs to display names
            const userDisplayNames: Record<string, string> = {};
            userData.forEach(user => {
              if (user.id && user.display_name) {
                userDisplayNames[user.id] = user.display_name;
              }
            });
            
            // Update media items with display names
            mediaData.forEach(item => {
              if (item.user_id && !item.user?.display_name && userDisplayNames[item.user_id]) {
                item.user = {
                  display_name: userDisplayNames[item.user_id]
                };
              }
            });
          }
        }
        
        // Process all media items to ensure they have display names
        const processDisplayNames = async () => {
          // Create a copy of the media data to work with
          const updatedMediaData = [...mediaData];
          
          // Process each media item
          for (const item of updatedMediaData) {
            // If this media was uploaded by the event creator, use the creator's display name from the event
            if (item.user_id === eventData?.created_by && eventData?.creator_display_name) {
              item.user = {
                display_name: eventData.creator_display_name
              };
              console.log(`Set creator display name from event for media ${item.id}: ${eventData.creator_display_name}`);
            } 
            // If we have a display name from event_participants, use that
            else if (item.user_id && participantDisplayNames[item.user_id]) {
              item.user = {
                display_name: participantDisplayNames[item.user_id]
              };
              console.log(`Set participant display name for media ${item.id}: ${participantDisplayNames[item.user_id]}`);
            }
            // Otherwise, ensure there's a fallback display name
            else if (!item.user || !item.user.display_name) {
              try {
                // Try to get display name from auth.users using a function
                const { data, error } = await supabase
                  .rpc('get_user_display_name', { user_id: item.user_id });
                  
                if (!error && data) {
                  item.user = {
                    display_name: data
                  };
                  console.log(`Set RPC display name for media ${item.id}: ${data}`);
                } else {
                  // If RPC fails, use a shortened ID
                  const fallbackName = `User ${item.user_id.substring(0, 6)}`;
                  item.user = {
                    display_name: fallbackName
                  };
                  console.log(`Set fallback display name for media ${item.id}: ${fallbackName}`);
                }
              } catch (err) {
                console.error('Error getting user display name:', err);
                // If all else fails, use a shortened ID
                const fallbackName = `User ${item.user_id.substring(0, 6)}`;
                item.user = {
                  display_name: fallbackName
                };
                console.log(`Set error fallback display name for media ${item.id}: ${fallbackName}`);
              }
            }
          }
          
          return updatedMediaData;
        };
        
        // Process display names and then continue with likes processing
        const updatedMediaData = await processDisplayNames();
        
        let allLikes: any[] = [];
        let likesError = null;
        
        try {
          // Fetch all likes for these media items
          const response = await supabase
            .from('media_likes')
            .select('media_id, user_id')
            .in('media_id', mediaIds);
            
          allLikes = response.data || [];
          likesError = response.error;
        } catch (error) {
          console.error('Error fetching likes:', error);
          // If there's an error fetching likes, we'll just continue with empty likes
        }
        
        if (likesError && likesError.code === '42P01') {
          console.log('media_likes table does not exist, skipping likes data');
          // Table doesn't exist, just use empty likes data
          allLikes = [];
        } else if (likesError) {
          console.error('Error fetching likes:', likesError);
        }
        
        // Process likes data
        const likesCountMap: Record<string, number> = {};
        const userLikedMedia: Record<string, boolean> = {};
        
        // Initialize with zero likes for all media
        mediaIds.forEach(id => {
          likesCountMap[id] = 0;
          userLikedMedia[id] = false;
        });
        
        // Count likes and check if user liked each media
        if (allLikes && allLikes.length > 0) {
          allLikes.forEach(like => {
            // Increment like count
            likesCountMap[like.media_id] = (likesCountMap[like.media_id] || 0) + 1;
            
            // Check if this is the current user's like
            if (like.user_id === userId) {
              userLikedMedia[like.media_id] = true;
            }
          });
        }
        
        // Process the data to include likes information
        const processedData = updatedMediaData.map(item => ({
          ...item,
          likes_count: likesCountMap[item.id] || 0,
          user_has_liked: userLikedMedia[item.id] || false
        }));
        
        console.log(`Fetched ${processedData?.length || 0} media items`);
        setMedia(processedData as MediaWithUser[]);
      } else {
        // No media found
        setMedia([]);
      }
    } catch (err) {
      console.error('Error fetching media:', err);
      setError('Failed to load media');
    } finally {
      setLoading(false);
    }
  };

  const downloadMedia = async (mediaItem: MediaWithUser) => {
    try {
      setDownloading(true);
      
      // Download the file
      const fileUri = `${FileSystem.documentDirectory}${mediaItem.id}.jpg`;
      const { uri } = await FileSystem.downloadAsync(mediaItem.url, fileUri);
      
      // Save to media library
      const asset = await MediaLibrary.saveToLibraryAsync(uri);
      
      Alert.alert('Success', 'Media saved to your gallery!');
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download media');
    } finally {
      setDownloading(false);
      setSelectedMedia(null);
    }
  };

  const deleteMedia = async (mediaItem: MediaWithUser) => {
    // Get current user
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData?.session?.user?.id;
    
    // Check if current user has permission to delete this media
    // They can delete if they're the event creator OR if it's their own photo
    const isOwnMedia = mediaItem.user_id === currentUserId;
    const canDelete = isCreator || isOwnMedia;
    
    if (!canDelete) {
      Alert.alert('Permission Denied', 'You can only delete your own photos.');
      return;
    }
    
    Alert.alert(
      'Delete Media',
      'Are you sure you want to delete this media? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              console.log('Starting deletion process for media ID:', mediaItem.id);
              
              // Force remove from local state immediately
              setMedia(prevMedia => prevMedia.filter(m => m.id !== mediaItem.id));
              setSelectedMedia(null);
              
              // Try to delete from database - but don't wait for it
              console.log('Attempting database deletion, id:', mediaItem.id);
              supabase
                .from('media')
                .delete()
                .eq('id', mediaItem.id)
                .then(({ error }) => {
                  if (error) {
                    console.log('Database deletion error (non-critical):', error);
                  } else {
                    console.log('Database deletion request sent successfully');
                  }
                });
              
              // Try to delete from storage if possible - also don't wait
              try {
                // Extract path from URL if it's a full URL
                let storagePath = '';
                if (mediaItem.url.includes('https://')) {
                  const urlParts = mediaItem.url.split('/media/');
                  if (urlParts.length > 1) {
                    storagePath = urlParts[1];
                  }
                } else {
                  storagePath = mediaItem.url;
                }
                
                if (storagePath) {
                  console.log('Attempting to delete from storage:', storagePath);
                  supabase.storage
                    .from('media')
                    .remove([storagePath])
                    .then(({ error }) => {
                      if (error) {
                        console.log('Storage deletion error (non-critical):', error);
                      } else {
                        console.log('Storage deletion request sent successfully');
                      }
                    });
                }
              } catch (storageError) {
                // Just log storage errors but don't fail the operation
                console.log('Storage deletion error (non-critical):', storageError);
              }
              
              // Show success message immediately
              Alert.alert('Success', 'Media removed from gallery');
              
              // Force refresh the media list after a delay
              setTimeout(() => {
                fetchEventMedia();
              }, 2000);
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete media');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  // Toggle selection mode
  const toggleSelectionMode = () => {
    console.log('toggleSelectionMode called, isCreator:', isCreator);
    if (selectionMode) {
      // Exit selection mode
      setSelectionMode(false);
      setSelectedItems([]);
    } else {
      // Enter selection mode
      setSelectionMode(true);
    }
  };

  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  // Delete multiple media items
  const deleteSelectedItems = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item to delete.');
      return;
    }

    // Get current user
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData?.session?.user?.id;

    // Check which items the user can delete
    const selectedMedia = media.filter(m => selectedItems.includes(m.id));
    
    // Filter out items the user doesn't have permission to delete
    const itemsUserCanDelete = selectedMedia.filter(m => 
      isCreator || m.user_id === currentUserId
    );
    
    const itemsUserCannotDelete = selectedMedia.filter(m => 
      !isCreator && m.user_id !== currentUserId
    );
    
    if (itemsUserCanDelete.length === 0) {
      Alert.alert('Permission Denied', 'You can only delete your own photos.');
      return;
    }
    
    let message = `Are you sure you want to delete ${itemsUserCanDelete.length} selected item(s)? This action cannot be undone.`;
    
    if (itemsUserCannotDelete.length > 0) {
      message += `\n\nNote: ${itemsUserCannotDelete.length} item(s) will not be deleted because you don't have permission to delete them.`;
    }

    Alert.alert(
      'Delete Selected Media',
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setMultiDeleteInProgress(true);
              console.log('Starting batch deletion for', itemsUserCanDelete.length, 'items');
              
              // Remove selected items from local state immediately
              setMedia(prevMedia => prevMedia.filter(m => 
                !itemsUserCanDelete.some(item => item.id === m.id)
              ));
              
              // Process each deletion in sequence
              for (const item of itemsUserCanDelete) {
                console.log('Deleting item:', item.id);
                
                // Delete from database
                const { error: dbError } = await supabase
                  .from('media')
                  .delete()
                  .eq('id', item.id);
                
                if (dbError) {
                  console.log('Database deletion error for item', item.id, ':', dbError);
                }
                
                // Try to delete from storage
                try {
                  let storagePath = '';
                  if (item.url.includes('https://')) {
                    const urlParts = item.url.split('/media/');
                    if (urlParts.length > 1) {
                      storagePath = urlParts[1];
                    }
                  } else {
                    storagePath = item.url;
                  }
                  
                  if (storagePath) {
                    await supabase.storage
                      .from('media')
                      .remove([storagePath]);
                  }
                } catch (storageError) {
                  console.log('Storage deletion error for item', item.id, ':', storageError);
                }
              }
              
              // Exit selection mode
              setSelectionMode(false);
              setSelectedItems([]);
              
              // Show success message
              Alert.alert('Success', `${itemsUserCanDelete.length} item(s) removed from gallery`);
              
              // Force refresh after a delay
              setTimeout(() => {
                fetchEventMedia();
              }, 2000);
            } catch (error) {
              console.error('Batch delete error:', error);
              Alert.alert('Error', 'Failed to delete some items');
            } finally {
              setMultiDeleteInProgress(false);
            }
          }
        }
      ]
    );
  };

  // Completely rewritten navigation with improved smooth animation
  const navigateToNextImage = () => {
    console.log('Navigating to next image, current index:', imageIndex);
    if (imageIndex < filteredMedia.length - 1) {
      // Set direction for animation
      const newIndex = imageIndex + 1;
      
      // Animate current image off-screen to the left
      Animated.timing(translateX, {
        toValue: -width,
        duration: 300, // Slower animation (300ms)
        useNativeDriver: true,
        easing: Easing.out(Easing.ease), // Add easing function for smoother animation
      }).start(() => {
        // After animation completes, update the state and reset animation
        setImageIndex(newIndex);
        setSelectedMedia(filteredMedia[newIndex]);
        translateX.setValue(0); // Reset position
      });
    }
  };
  
  // Completely rewritten navigation with improved smooth animation
  const navigateToPreviousImage = () => {
    console.log('Navigating to previous image, current index:', imageIndex);
    if (imageIndex > 0) {
      // Set direction for animation
      const newIndex = imageIndex - 1;
      
      // Animate current image off-screen to the right
      Animated.timing(translateX, {
        toValue: width,
        duration: 300, // Slower animation (300ms)
        useNativeDriver: true,
        easing: Easing.out(Easing.ease), // Add easing function for smoother animation
      }).start(() => {
        // After animation completes, update the state and reset animation
        setImageIndex(newIndex);
        setSelectedMedia(filteredMedia[newIndex]);
        translateX.setValue(0); // Reset position
      });
    }
  };
  
  // Show fullscreen image with our new index tracking
  const showFullScreenImage = (item: MediaWithUser) => {
    if (filteredMedia.length === 0) {
      console.error('Cannot show image - filteredMedia is empty');
      return;
    }
    
    const index = filteredMedia.findIndex(m => m.id === item.id);
    console.log('showFullScreenImage - Selected index:', index, 'item ID:', item.id);
    
    if (index !== -1) {
      // Reset the animation position
      translateX.setValue(0);
      
      setImageIndex(index);
      setSelectedMedia(item);
      setFullScreenVisible(true);
      setHeaderVisible(false);
    } else {
      console.error('Cannot find selected media (ID:', item.id, ') in filteredMedia array');
    }
  };
  
  // Close fullscreen image
  const closeFullScreenImage = () => {
    setFullScreenVisible(false);
    setSelectedMedia(null);
    setHeaderVisible(true);
  };
  
  // Update the renderFullScreenImage function to only allow owners to delete their photos
  const renderFullScreenImage = () => {
    if (!selectedMedia || filteredMedia.length === 0) {
      console.error('Cannot render full screen image - no selected media or empty filteredMedia');
      return null;
    }
    
    const hasPrevious = imageIndex > 0;
    const hasNext = imageIndex < filteredMedia.length - 1;
    
    // Check if this media was uploaded by the event creator
    const isCreatorMedia = selectedMedia.user_id === currentEvent?.created_by;
    
    // Get current user ID from the session object we already have
    const currentUserId = session?.user?.id;
    
    // Check if current user owns this media
    const isOwnMedia = selectedMedia.user_id === currentUserId;
    
    // User can delete if they're the event creator OR if it's their own photo
    const canDelete = isCreator || isOwnMedia;
    
    // Get the display name
    let displayName = 'Unknown User';
    
    // If it's the creator's media, use the creator_display_name from the event
    if (isCreatorMedia && currentEvent?.creator_display_name) {
      displayName = currentEvent.creator_display_name;
    } 
    // Use the display name from the media item
    else if (selectedMedia.user?.display_name) {
      displayName = selectedMedia.user.display_name;
    }
    
    return (
      <View style={styles.fullScreenContainer}>
        <StatusBar hidden />
        
        <Animated.View 
          style={[
            styles.fullScreenImageContainer,
            { transform: [{ translateX }] }
          ]}
        >
          <Image 
            source={{ uri: selectedMedia.url }} 
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
        </Animated.View>
        
        <View style={styles.fullScreenOverlay}>
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={closeFullScreenImage}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            <Text style={styles.imageCounter}>
              {imageIndex + 1} / {filteredMedia.length}
            </Text>
          </View>
          
          <View style={styles.fullScreenFooter}>
            <View style={styles.mediaInfo}>
              <Text style={styles.mediaInfoText}>
                By: {displayName}
                {isCreatorMedia && <Text style={styles.creatorTag}> (Creator)</Text>}
                {isOwnMedia && <Text style={styles.ownPhotoTag}> (You)</Text>}
              </Text>
              <Text style={styles.mediaInfoDate}>
                {new Date(selectedMedia.created_at).toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.mediaActions}>
              <TouchableOpacity
                style={[
                  styles.mediaAction,
                  selectedMedia.user_has_liked && styles.likedAction
                ]}
                onPress={() => handleLikeMedia(selectedMedia)}
                disabled={likingInProgress}
              >
                <MaterialIcons 
                  name={selectedMedia.user_has_liked ? "favorite" : "favorite-border"} 
                  size={24} 
                  color="#fff" 
                />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.mediaAction}
                onPress={() => downloadMedia(selectedMedia)}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialIcons name="file-download" size={24} color="#fff" />
                )}
              </TouchableOpacity>
              
              {canDelete && (
                <TouchableOpacity
                  style={[styles.mediaAction, styles.deleteAction]}
                  onPress={() => deleteMedia(selectedMedia)}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialIcons name="delete" size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {hasPrevious && (
            <TouchableOpacity 
              style={[styles.navButton, styles.prevButton]}
              onPress={navigateToPreviousImage}
              hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
            >
              <MaterialIcons name="chevron-left" size={40} color="#fff" />
            </TouchableOpacity>
          )}
          
          {hasNext && (
            <TouchableOpacity 
              style={[styles.navButton, styles.nextButton]}
              onPress={navigateToNextImage}
              hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
            >
              <MaterialIcons name="chevron-right" size={40} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const handleDownloadAllPhotos = async () => {
    try {
      // Request permissions if not already granted
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to save photos to your device.');
        return;
      }

      setDownloadingAll(true);
      
      // Create a temporary directory to store all images
      const tempDir = FileSystem.cacheDirectory + 'event_photos/';
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true }).catch(() => {});
      
      // Show progress alert
      Alert.alert(
        'Downloading Photos',
        `Downloading ${filteredMedia.length} photos. This may take a while.`,
        [{ text: 'OK' }]
      );
      
      // Download each photo
      const downloadPromises = filteredMedia.map(async (item, index) => {
        try {
          const fileName = `photo_${index + 1}.jpg`;
          const fileUri = tempDir + fileName;
          
          // Download the file
          await FileSystem.downloadAsync(item.url, fileUri);
          
          // Save to media library
          await MediaLibrary.saveToLibraryAsync(fileUri);
          
          return fileUri;
        } catch (error) {
          console.error(`Error downloading photo ${index + 1}:`, error);
          return null;
        }
      });
      
      const downloadedFiles = await Promise.all(downloadPromises);
      const successfulDownloads = downloadedFiles.filter(uri => uri !== null);
      
      // Show completion alert
      Alert.alert(
        'Download Complete',
        `Successfully downloaded ${successfulDownloads.length} of ${filteredMedia.length} photos to your device.`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Error downloading all photos:', error);
      Alert.alert('Download Failed', 'There was an error downloading the photos.');
    } finally {
      setDownloadingAll(false);
    }
  };

  // Update all instances of the back button TouchableOpacity
  const handleBackPress = () => {
    navigation.navigate('Events');
  };

  // Update useEffect to apply filters when media, sortBy, or showOnlyMyPhotos changes
  useEffect(() => {
    console.log(`Filtering media: ${media.length} items available, sort by: ${sortBy}, show only my photos: ${showOnlyMyPhotos}`);
    
    if (media.length === 0) {
      console.log('No media to filter, setting empty filteredMedia');
      setFilteredMedia([]);
      return;
    }

    let filtered = [...media];
    
    // First filter by user ownership if needed
    if (showOnlyMyPhotos && session?.user) {
      const currentUserId = session.user.id;
      filtered = filtered.filter(item => item.user_id === currentUserId);
    }
    
    // Then sort the filtered list
    switch (sortBy) {
      case 'newest':
        filtered = filtered.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case 'oldest':
        filtered = filtered.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case 'most_likes':
        filtered = filtered.sort((a, b) => b.likes_count - a.likes_count);
        break;
    }
    
    console.log(`Setting filteredMedia with ${filtered.length} items after filtering`);
    setFilteredMedia(filtered);
  }, [media, sortBy, showOnlyMyPhotos, session?.user?.id]);

  // Add function to toggle filter modal
  const toggleFilterModal = () => {
    setFilterModalVisible(!filterModalVisible);
  };

  // Add function to apply filter
  const applyFilter = (filter: 'newest' | 'oldest' | 'most_likes') => {
    setSortBy(filter);
    setFilterModalVisible(false);
  };

  // Update filter modal component to include "My Photos" option
  const renderFilterModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort & Filter</Text>
            
            {/* Sort options */}
            <Text style={styles.modalSectionTitle}>Sort By</Text>
            <TouchableOpacity
              style={[styles.sortOption, sortBy === 'newest' && styles.selectedSortOption]}
              onPress={() => setSortBy('newest')}
            >
              <Text style={styles.sortOptionText}>Newest First</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortOption, sortBy === 'oldest' && styles.selectedSortOption]}
              onPress={() => setSortBy('oldest')}
            >
              <Text style={styles.sortOptionText}>Oldest First</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortOption, sortBy === 'most_likes' && styles.selectedSortOption]}
              onPress={() => setSortBy('most_likes')}
            >
              <Text style={styles.sortOptionText}>Most Likes</Text>
            </TouchableOpacity>
            
            {/* Filter options */}
            <Text style={styles.modalSectionTitle}>Filter Options</Text>
            <View style={styles.modalFilterOption}>
              <Text style={styles.filterOptionText}>Show only my photos</Text>
              <Switch
                value={showOnlyMyPhotos}
                onValueChange={setShowOnlyMyPhotos}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={showOnlyMyPhotos ? '#4630EB' : '#f4f3f4'}
              />
            </View>
            
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setFilterModalVisible(false)}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Add this function to show a user-friendly alert about the missing table
  const showMediaLikesTableMissingAlert = () => {
    Alert.alert(
      'Likes Feature Not Available',
      'The likes feature is not available yet. Please contact the app administrator to enable this feature.',
      [
        {
          text: 'OK',
          style: 'default'
        }
      ]
    );
  };

  // Add the missing handleLikeMedia function
  const handleLikeMedia = async (mediaItem: MediaWithUser) => {
    if (likingInProgress) return;
    
    try {
      setLikingInProgress(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to like media');
        return;
      }
      
      // Check if media_likes table exists, create it if it doesn't
      try {
        console.log('Checking if media_likes table exists...');
        // Try to create the table if it doesn't exist
        const { error: createTableError } = await supabase.rpc('create_media_likes_table_if_not_exists');
        
        if (createTableError) {
          console.log('Error calling RPC function, trying direct SQL:', createTableError);
          
          // If RPC fails, try direct SQL (requires admin privileges)
          const { error: sqlError } = await supabase.from('_temp_create_table').select('*').limit(1);
          console.log('SQL check result:', sqlError ? 'Error' : 'Success');
          
          // If we can't create the table, we'll just try to use it anyway
          // The user might need to ask the admin to create the table
        }
      } catch (tableCheckError) {
        console.error('Error checking/creating table:', tableCheckError);
      }
      
      if (mediaItem.user_has_liked) {
        // Unlike the media
        console.log('Unliking media:', mediaItem.id);
        const { error } = await supabase
          .from('media_likes')
          .delete()
          .eq('media_id', mediaItem.id)
          .eq('user_id', user.id);
          
        if (error) {
          console.error('Error unliking media:', error);
          if (error.code === '42P01') { // Table doesn't exist error
            showMediaLikesTableMissingAlert();
            return;
          }
          throw error;
        }
        
        console.log('Successfully unliked media');
        
        // Update local state immediately
        setMedia(prevMedia => 
          prevMedia.map(item => 
            item.id === mediaItem.id 
              ? { 
                  ...item, 
                  likes_count: Math.max(0, item.likes_count - 1),
                  user_has_liked: false 
                } 
              : item
          )
        );
        
        // If we're viewing this media in full screen, update that too
        if (selectedMedia?.id === mediaItem.id) {
          setSelectedMedia({
            ...selectedMedia,
            likes_count: Math.max(0, selectedMedia.likes_count - 1),
            user_has_liked: false
          });
        }
      } else {
        // Like the media
        console.log('Liking media:', mediaItem.id);
        const { error } = await supabase
          .from('media_likes')
          .insert({
            media_id: mediaItem.id,
            user_id: user.id
          });
          
        if (error) {
          console.error('Error liking media:', error);
          if (error.code === '42P01') { // Table doesn't exist error
            showMediaLikesTableMissingAlert();
            return;
          }
          throw error;
        }
        
        console.log('Successfully liked media');
        
        // Update local state immediately
        setMedia(prevMedia => 
          prevMedia.map(item => 
            item.id === mediaItem.id 
              ? { 
                  ...item, 
                  likes_count: item.likes_count + 1,
                  user_has_liked: true 
                } 
              : item
          )
        );
        
        // If we're viewing this media in full screen, update that too
        if (selectedMedia?.id === mediaItem.id) {
          setSelectedMedia({
            ...selectedMedia,
            likes_count: selectedMedia.likes_count + 1,
            user_has_liked: true
          });
        }
      }
    } catch (error) {
      console.error('Error liking/unliking media:', error);
      Alert.alert('Error', 'Failed to like/unlike media');
    } finally {
      setLikingInProgress(false);
    }
  };

  // Add the missing renderMediaItem function
  const renderMediaItem = ({ item }: { item: MediaWithUser }) => {
    // Check if this media was uploaded by the event creator
    const isCreatorMedia = item.user_id === currentEvent?.created_by;
    
    // Get current user ID
    const currentUserId = session?.user?.id;
    
    // Check if current user owns this media
    const isOwnMedia = item.user_id === currentUserId;
    
    // User can delete if they're the event creator OR if it's their own photo
    const canDelete = isCreator || isOwnMedia;
    
    // Get the display name to show
    let displayName = 'Unknown User';
    
    // If it's the creator's media, use the creator_display_name from the event
    if (isCreatorMedia && currentEvent?.creator_display_name) {
      displayName = currentEvent.creator_display_name;
    } 
    // Otherwise use the display name from the media item
    else if (item.user?.display_name) {
      displayName = item.user.display_name;
    }
    
    if (selectionMode) {
      // In selection mode, allow selecting but only if user has delete permission
      const isSelected = selectedItems.includes(item.id);
      
      // Only allow selection of items user can delete
      const canSelect = isCreator || isOwnMedia;
      
      // If user can't select this item, show it without selection capability
      if (!canSelect) {
        return (
          <TouchableOpacity 
            style={styles.mediaItem}
            onPress={() => showFullScreenImage(item)}
          >
            <Image 
              source={{ uri: item.url }} 
              style={styles.mediaThumbnail}
              resizeMode="cover"
            />
            {item.likes_count > 0 && (
              <View style={styles.likesCountBadge}>
                <MaterialIcons name="favorite" size={12} color="#fff" />
                <Text style={styles.likesCountText}>{item.likes_count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      }
      
      return (
        <TouchableOpacity 
          style={[
            styles.mediaItem, 
            isSelected && styles.selectedMediaItem
          ]}
          onPress={() => toggleItemSelection(item.id)}
        >
          <Image 
            source={{ uri: item.url }} 
            style={styles.mediaThumbnail}
            resizeMode="cover"
          />
          {isSelected && (
            <View style={styles.selectionOverlay}>
              <MaterialIcons name="check-circle" size={24} color="#007AFF" />
            </View>
          )}
          {item.likes_count > 0 && (
            <View style={styles.likesCountBadge}>
              <MaterialIcons name="favorite" size={12} color="#fff" />
              <Text style={styles.likesCountText}>{item.likes_count}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }
    
    return (
      <TouchableOpacity 
        style={styles.mediaItem}
        onPress={() => showFullScreenImage(item)}
        onLongPress={() => {
          console.log('onLongPress triggered, canDelete:', canDelete);
          // Only allow entering selection mode if user can delete this item
          if (canDelete) {
            toggleSelectionMode();
            toggleItemSelection(item.id);
          }
        }}
        delayLongPress={500}
      >
        <Image 
          source={{ uri: item.url }} 
          style={styles.mediaThumbnail}
          resizeMode="cover"
        />
        <View style={styles.mediaAttributionStrip}>
          <Text style={styles.mediaAttributionText} numberOfLines={1}>
            by: {displayName}
          </Text>
        </View>
        {item.likes_count > 0 && (
          <View style={styles.likesCountBadge}>
            <MaterialIcons name="favorite" size={12} color="#fff" />
            <Text style={styles.likesCountText}>{item.likes_count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {/* Modern header with gradient background */}
        <View style={styles.modernHeader}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButtonContainer}
              onPress={handleBackPress}
            >
              <MaterialIcons name="arrow-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.titleContainer}>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {`${filteredMedia.length} ${Number(filteredMedia.length) === 1 ? "photo" : "photos"}`}
                {selectionMode && ` • ${selectedItems.length} selected`}
              </Text>
            </View>
            
            <View style={styles.headerActionsContainer}>
              {/* Filter button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setFilterModalVisible(true)}
              >
                <MaterialIcons name="filter-list" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              
              {/* Refresh button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={async () => {
                  console.log('Manual refresh requested');
                  await refreshCurrentUserDisplayName();
                  fetchEventMedia();
                }}
              >
                <MaterialIcons name="refresh" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              
              {/* Download all button */}
              {!selectionMode && filteredMedia.length > 0 && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleDownloadAllPhotos}
                  disabled={downloadingAll}
                >
                  {downloadingAll ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcons name="file-download" size={24} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
              
              {/* Selection mode buttons */}
              {selectionMode ? (
                <>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={toggleSelectionMode}
                  >
                    <MaterialIcons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton, 
                      styles.deleteButton,
                      selectedItems.length === 0 && styles.disabledButton
                    ]}
                    onPress={deleteSelectedItems}
                    disabled={selectedItems.length === 0 || multiDeleteInProgress}
                  >
                    {multiDeleteInProgress ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <MaterialIcons name="delete" size={24} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={toggleSelectionMode}
                >
                  <MaterialIcons name="select-all" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchEventMedia}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (filteredMedia.length === 0) {
    return (
      <View style={styles.container}>
        {/* Modern header with gradient background */}
        <View style={styles.modernHeader}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButtonContainer}
              onPress={handleBackPress}
            >
              <MaterialIcons name="arrow-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.titleContainer}>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {`${filteredMedia.length} ${Number(filteredMedia.length) === 1 ? "photo" : "photos"}`}
              </Text>
            </View>
            
            <View style={styles.headerActionsContainer}>
              {/* Filter button */}
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setFilterModalVisible(true)}
              >
                <Ionicons name="filter-outline" size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="photo-library" size={64} color="#8E8E93" />
          <Text style={styles.emptyText}>No photos or videos yet</Text>
          <Text style={styles.emptySubtext}>Take some photos to see them here!</Text>
          <TouchableOpacity 
            style={styles.cameraButton}
            onPress={() => {
              console.log('Navigating to Camera with eventId:', eventId);
              navigation.navigate('Camera', { eventId });
            }}
          >
            <Text style={styles.cameraButtonText}>Go to Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  console.log('Render state - selectionMode:', selectionMode, 'isCreator:', isCreator);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        {/* Modern header with gradient background */}
        <View style={styles.modernHeader}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButtonContainer}
              onPress={handleBackPress}
            >
              <MaterialIcons name="arrow-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.titleContainer}>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {`${filteredMedia.length} ${Number(filteredMedia.length) === 1 ? "photo" : "photos"}`}
                {selectionMode && ` • ${selectedItems.length} selected`}
              </Text>
            </View>
            
            <View style={styles.headerActionsContainer}>
              {/* Filter button */}
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setFilterModalVisible(true)}
              >
                <Ionicons name="filter-outline" size={24} color="#333" />
              </TouchableOpacity>
              
              {/* Refresh button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={async () => {
                  console.log('Manual refresh requested');
                  await refreshCurrentUserDisplayName();
                  fetchEventMedia();
                }}
              >
                <MaterialIcons name="refresh" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              
              {/* Download all button */}
              {!selectionMode && filteredMedia.length > 0 && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleDownloadAllPhotos}
                  disabled={downloadingAll}
                >
                  {downloadingAll ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcons name="file-download" size={24} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
              
              {/* Selection mode buttons */}
              {selectionMode ? (
                <>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={toggleSelectionMode}
                  >
                    <MaterialIcons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton, 
                      styles.deleteButton,
                      selectedItems.length === 0 && styles.disabledButton
                    ]}
                    onPress={deleteSelectedItems}
                    disabled={selectedItems.length === 0 || multiDeleteInProgress}
                  >
                    {multiDeleteInProgress ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <MaterialIcons name="delete" size={24} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={toggleSelectionMode}
                >
                  <MaterialIcons name="select-all" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        
        {selectedMedia ? (
          renderFullScreenImage()
        ) : (
          <>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading media...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={fetchEventMedia}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : filteredMedia.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="photo-library" size={64} color="#CCCCCC" />
                <Text style={styles.emptyText}>No photos or videos yet</Text>
                <Text style={styles.emptySubtext}>Take some photos to see them here!</Text>
              </View>
            ) : (
              <FlatList
                data={filteredMedia}
                renderItem={renderMediaItem}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                contentContainerStyle={styles.mediaGrid}
                refreshing={loading}
                onRefresh={fetchEventMedia}
                showsVerticalScrollIndicator={false}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={5}
                removeClippedSubviews={true}
                ListFooterComponent={<View style={{ height: 20 }} />}
              />
            )}
          </>
        )}
        {downloadingAll && (
          <LoadingOverlay isVisible={true} message="Downloading all photos..." />
        )}
        {multiDeleteInProgress && (
          <LoadingOverlay isVisible={true} message="Deleting selected items..." />
        )}
        {renderFilterModal()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mediaGrid: {
    padding: spacing.xs,
  },
  mediaItem: {
    width: tileSize - spacing.xs * 2,
    height: tileSize - spacing.xs * 2,
    margin: spacing.xs / 2,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 8,
    marginBottom: 20,
    textAlign: 'center',
  },
  cameraButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  cameraButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  eventBanner: {
    backgroundColor: '#007AFF',
    padding: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  creatorBadge: {
    color: '#fff',
    fontSize: 12,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  selectedMediaItem: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionModeActions: {
    flexDirection: 'row',
  },
  selectionModeAction: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: '#555',
  },
  selectionModeActionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  fullScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 10,
  },
  fullScreenImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width,
    height,
  },
  fullScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCounter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fullScreenFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaInfo: {
    flex: 1,
  },
  mediaInfoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mediaInfoDate: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  mediaActions: {
    flexDirection: 'row',
  },
  mediaAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -25,
  },
  prevButton: {
    left: 16,
  },
  nextButton: {
    right: 16,
  },
  deleteAction: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  likedAction: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  likesCountBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 2,
  },
  likesCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  creatorTag: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  creatorBadgeSmall: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(76, 175, 80, 0.7)',
    borderRadius: 12,
    padding: 2,
  },
  creatorMediaItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  mediaItemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaItemUserName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mediaAttributionStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  mediaAttributionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginHorizontal: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernHeader: {
    backgroundColor: colors.primary,
    paddingTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleMain: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginHorizontal: 6,
  },
  headerActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  selectionCount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,122,255,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  deleteButton: {
    backgroundColor: 'rgba(255,59,48,0.8)',
    padding: 10,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  filterModal: {
    backgroundColor: '#fff',
    width: '100%',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterOptions: {
    marginTop: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterOptionText: {
    marginLeft: 10,
  },
  applyFilterButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 20,
  },
  applyFilterButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  selectionBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.primary,
  },
  selectionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  mediaList: {
    paddingBottom: 16,
  },
  likeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  deleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  deleteOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  downloadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  downloadOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  ownPhotoTag: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  filterButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  sortOption: {
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
  },
  selectedSortOption: {
    backgroundColor: '#e6f0ff',
  },
  sortOptionText: {
    fontSize: 16,
  },
  modalFilterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  applyButton: {
    backgroundColor: '#4630EB',
    borderRadius: 5,
    padding: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 