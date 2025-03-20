import React, { useEffect, useState, useRef, useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Animated, PanResponder, StatusBar, Share, BackHandler, Modal, SafeAreaView, Easing, Switch, Platform, ImageStyle, SectionList, RefreshControl } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, useTheme } from '@react-navigation/native';
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
import { Toast } from '../components/Toast';
import * as ImagePicker from 'expo-image-picker';
import { FallbackImage } from '../components/FallbackImage';
import * as ImageManipulator from 'expo-image-manipulator';
import { v4 as uuidv4 } from 'uuid';
import { HeaderBar } from '../components/HeaderBar';

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
type SortOption = 'newest' | 'oldest' | 'most_likes' | 'by_user';

// Helper function to fix Supabase URLs - focused on the specific issue
const fixSupabaseImageUrl = (url: string): string => {
  if (!url) return '';
  
  try {
    // First, encode the URL components properly
    const urlParts = url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    
    // Replace the file name part with a properly encoded version
    urlParts[urlParts.length - 1] = encodeURIComponent(decodeURIComponent(fileName));
    
    return urlParts.join('/');
  } catch (e) {
    console.error('Error fixing URL:', e);
    return url;
  }
};

// Custom URL encoder to handle special characters
const customEncodeURL = (url: string): string => {
  if (!url) return '';
  
  try {
    // Try to detect if URL is already encoded
    if (url.includes('%')) {
      try {
        // Try decoding once to normalize
        const decodedOnce = decodeURIComponent(url);
        // Then encode it properly
        return encodeURI(decodedOnce);
      } catch (decodeError) {
        // If decoding fails, the URL might be partially encoded
        // Just encode as is
        return encodeURI(url);
      }
    } else {
      // URL is not encoded, encode it
      return encodeURI(url);
    }
  } catch (error) {
    console.error('Error in customEncodeURL:', error);
    // Return original URL if encoding fails
    return url;
  }
};

export const GalleryScreen = () => {
  const navigation = useNavigation<GalleryScreenNavigationProp>();
  const route = useRoute<GalleryScreenRouteProp>();
  const { currentEvent, isCreator } = useEvent();
  const { session } = useAuth();
  const theme = useTheme();
  
  const [media, setMedia] = useState<MediaWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Add the upload state variables
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Other existing state
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

  // Add new state variables for filtering
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filteredMedia, setFilteredMedia] = useState<MediaWithUser[]>([]);
  // Add new filter to show only user's photos
  const [showOnlyMyPhotos, setShowOnlyMyPhotos] = useState(false);
  
  // Add this for direct swipe handling
  const [imageIndex, setImageIndex] = useState(0);

  // Add toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  // Add state for caching base64 images
  const [imageCache, setImageCache] = React.useState<Record<string, string>>({});
  
  // Add state for grouped by user feature
  // Add a type for the grouped media
  type GroupedMedia = {
    user: string;
    userId: string;
    data: MediaWithUser[];
  };

  // Update the state type
  const [groupedMediaByUser, setGroupedMediaByUser] = useState<{[key: string]: GroupedMedia}>({});
  const [isSectionList, setIsSectionList] = useState(false);
  
  // Create a simple placeholder image as base64 - a gray square
  const PLACEHOLDER_IMAGE = {
    uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  };

  // Function to fix problematic URLs specifically for this issue
  const fixSupabaseStorageUrl = (url: string): string => {
    if (!url) return url;
    
    // Check if it's a problematic Supabase URL
    if (url.includes('storage/v1/object/public/media/')) {
      // Log the original URL
      console.log('Fixing URL:', url);
      
      try {
        // Pattern matching the URLs in error logs
        const supabaseBase = url.split('/storage/v1/object/public/media/')[0];
        const path = url.split('/storage/v1/object/public/media/')[1];
        
        if (!path) return url;
        
        // Split path by '/'
        const pathParts = path.split('/');
        
        // We know the format: [eventId]/photos/[filename]
        const eventId = pathParts[0];
        const fileName = pathParts[pathParts.length - 1];
        
        // Reconstruct URL with the supabase base URL and path parts correctly
        // Use decodeURIComponent first to avoid double-encoding
        const decodedFileName = decodeURIComponent(fileName);
        const encodedFileName = encodeURIComponent(decodedFileName);
        
        const fixedUrl = `${supabaseBase}/storage/v1/object/public/media/${eventId}/photos/${encodedFileName}`;
        console.log('Fixed URL:', fixedUrl);
        return fixedUrl;
      } catch (e) {
        console.error('Error fixing URL:', e);
        return url;
      }
    }
    
    return url;
  };

  // Function to properly process and encode image URLs
  const processUrl = (url: string): string => {
    // Make sure URL is properly encoded
    try {
      // First decode the URL to prevent double-encoding
      const decodedUrl = decodeURIComponent(url);
      
      // Parse the URL to get its components
      const parsedUrl = new URL(decodedUrl);
      
      // Create a properly encoded URL by encoding each path segment separately
      const encodedPath = parsedUrl.pathname.split('/').map(segment => 
        encodeURIComponent(segment)
      ).join('/');
      
      // Reconstruct the URL with encoded path
      parsedUrl.pathname = encodedPath;
      return parsedUrl.toString();
    } catch (error) {
      console.error('Error processing URL:', error);
      return url; // Return original if something fails
    }
  };

  // Function to show toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

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
        setFilteredMedia(processedData as MediaWithUser[]);
        
        // Log the first few media items to check URLs
        console.log(`Fetched ${processedData.length} media items`);
        if (processedData.length > 0) {
          console.log(`First media item: ID: ${processedData[0].id}, URL: ${processedData[0].url}`);
        }
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

  // Update the downloadMedia function to use signed URLs
  const downloadMedia = async (mediaItem: MediaWithUser) => {
    try {
      if (!mediaItem) {
        console.error('No media item provided to downloadMedia');
        showToast('Error: No image selected', 'error');
        return;
      }
      
      console.log('Download media started:', mediaItem.id);
      setDownloading(true);
      
      // Explicitly show toast at the start - log for debugging
      console.log('Setting download toast visible');
      setToastMessage('Downloading image...');
      setToastType('info');
      setToastVisible(true);
      
      // Get a properly processed URL
      const signedUrl = processUrl(mediaItem.url);
      console.log(`Downloading image from: ${signedUrl}`);
      
      // Request permissions if not already granted
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission denied for media library');
        setToastMessage('Please grant permission to save photos to your device.');
        setToastType('error');
        setToastVisible(true);
        return;
      }
      
      // Prepare a temporary file path
      const fileName = signedUrl.split('/').pop() || 'image.jpg';
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      // Download the file
      const downloadResult = await FileSystem.downloadAsync(signedUrl, fileUri);
      
      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }
      
      // Save to media library
      const asset = await MediaLibrary.saveToLibraryAsync(fileUri);
      
      // Success - explicitly set toast properties
      console.log('Image saved successfully, showing success toast');
      setToastMessage('Image saved to your device.');
      setToastType('success');
      setToastVisible(true);
      console.log('Image saved:', asset);
      
    } catch (error) {
      console.error('Error downloading media:', error);
      showToast('Failed to save image. Please try again.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const deleteMedia = async (mediaItem: MediaWithUser) => {
    try {
      // Show loading state
      setDeleting(true);
      console.log('Deleting media item:', mediaItem.id);
      
      // Extract the filename from the URL
      const urlParts = mediaItem.url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${eventId}/photos/${fileName}`;
      
      console.log('Deleting from storage path:', filePath);
      
      // Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('media')
        .remove([filePath]);
        
      if (storageError) {
        console.error('Error deleting from storage:', storageError);
        Alert.alert('Error', 'Failed to delete image from storage');
        return;
      }
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('media')
        .delete()
        .eq('id', mediaItem.id);
        
      if (dbError) {
        console.error('Error deleting from database:', dbError);
        Alert.alert('Error', 'Failed to delete image record from database');
        return;
      }
      
      // Update local state
      setMedia(prevMedia => prevMedia.filter(m => m.id !== mediaItem.id));
      setFilteredMedia(prevFilteredMedia => prevFilteredMedia.filter(m => m.id !== mediaItem.id));
      
      // Show success toast
      showToast('Photo deleted successfully', 'success');
      
    } catch (error) {
      console.error('Error deleting media:', error);
      showToast('Failed to delete photo', 'error');
    } finally {
      setDeleting(false);
    }
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
      return;
    }

    Alert.alert(
      'Delete Selected',
      `Are you sure you want to delete ${selectedItems.length} selected item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setMultiDeleteInProgress(true);
              
              // Delete items one by one (not ideal, but safest)
              for (const itemId of selectedItems) {
                // Find the media item
                const mediaItem = filteredMedia.find(m => m.id === itemId);
                if (!mediaItem) continue;
                
                // Delete from storage
                const urlParts = mediaItem.url.split('/');
                const fileName = urlParts[urlParts.length - 1];
                const filePath = `${eventId}/photos/${fileName}`;
                
                // Delete from storage
                const { error: storageError } = await supabase.storage
                  .from('media')
                  .remove([filePath]);
                  
                if (storageError) {
                  console.error('Error deleting from storage:', storageError);
                }
                
                // Delete from database
                const { error: dbError } = await supabase
                  .from('media')
                  .delete()
                  .eq('id', itemId);
                  
                if (dbError) {
                  console.error('Error deleting from database:', dbError);
                }
              }
              
              // Clear selection and exit selection mode
              setSelectedItems([]);
              setSelectionMode(false);
              
              // Refresh the media list
              await fetchEventMedia();
              
              // Show success toast
              showToast(`${selectedItems.length} items deleted successfully`, 'success');
            } catch (error) {
              console.error('Error deleting selected items:', error);
              showToast('Failed to delete some items', 'error');
            } finally {
              setMultiDeleteInProgress(false);
            }
          }
        }
      ]
    );
  };

  // Replace the navigateToNextImage function with this simpler version without animation
  const navigateToNextImage = () => {
    console.log(`Navigating to next image, current index: ${imageIndex} of ${filteredMedia.length}, sort order: ${sortBy}`);
    if (imageIndex < filteredMedia.length - 1) {
      const newIndex = imageIndex + 1;
      console.log(`Moving to index: ${newIndex}, image ID: ${filteredMedia[newIndex]?.id}`);
      setImageIndex(newIndex);
      setSelectedMedia(filteredMedia[newIndex]);
    }
  };

  // Replace the navigateToPreviousImage function with this simpler version without animation
  const navigateToPreviousImage = () => {
    console.log(`Navigating to previous image, current index: ${imageIndex} of ${filteredMedia.length}, sort order: ${sortBy}`);
    if (imageIndex > 0) {
      const newIndex = imageIndex - 1;
      console.log(`Moving to index: ${newIndex}, image ID: ${filteredMedia[newIndex]?.id}`);
      setImageIndex(newIndex);
      setSelectedMedia(filteredMedia[newIndex]);
    }
  };

  // Update the showFullScreenImage function to use a simpler approach for saving scroll position
  const showFullScreenImage = (item: MediaWithUser) => {
    // Find the correct index of the item in the filteredMedia array
    const index = filteredMedia.findIndex(media => media.id === item.id);
    console.log(`Opening fullscreen for image ${item.id} at index ${index} of ${filteredMedia.length} total images. Current sort order: ${sortBy}`);
    
    if (index !== -1) {
      setImageIndex(index);
    } else {
      console.error('Could not find image index in filteredMedia', item.id);
      setImageIndex(0); // Default to first image if not found
    }
    
    setSelectedMedia(item);
    setFullScreenVisible(true);
    setHeaderVisible(false);
  };

  // Update the closeFullScreenImage function to restore scroll position
  const closeFullScreenImage = () => {
    setFullScreenVisible(false);
    setSelectedMedia(null);
    setHeaderVisible(true);
    
    // Restore scroll position after a short delay to allow the list to render
    setTimeout(() => {
      if (isSectionList && groupedFlatListRef.current) {
        groupedFlatListRef.current.scrollToOffset({ offset: scrollPosition, animated: false });
      } else if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: scrollPosition, animated: false });
      }
    }, 100);
  };

  // Function to load an image as base64 (memoized)
  const loadImageAsBase64 = React.useCallback(async (item: MediaWithUser) => {
    try {
      // If we already have this image in cache, don't reload it
      if (imageCache[item.id]) {
        return;
      }

      console.log(`Loading image as base64: ${item.id}`);
      
      // Check if the URL is valid
      if (!item.url || !item.url.startsWith('http')) {
        console.error(`Invalid URL for image ${item.id}: ${item.url}`);
        return;
      }
      
      // Process the URL for proper encoding
      const processedUrl = processUrl(item.url);
      console.log(`Using processed URL: ${processedUrl}`);
      
      // Prepare temporary file path
      const localFileName = `${item.id}.jpg`;
      const localFilePath = `${FileSystem.cacheDirectory}${localFileName}`;
      
      // Try to download the file
      try {
        console.log(`Downloading image to local cache: ${processedUrl}`);
        const downloadResult = await FileSystem.downloadAsync(
          processedUrl,
          localFilePath
        );
        
        if (downloadResult.status !== 200) {
          console.error(`Failed to download image: ${downloadResult.status}`);
          return;
        }
        
        console.log(`Successfully downloaded image to: ${localFilePath}`);
        
        // Read the file as base64
        const base64 = await FileSystem.readAsStringAsync(localFilePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Update cache
        setImageCache(prev => ({
          ...prev,
          [item.id]: `data:image/jpeg;base64,${base64}`
        }));
        
        console.log(`Successfully cached image: ${item.id}`);
      } catch (error) {
        console.error(`Error downloading image: ${error}`);
      }
    } catch (error) {
      console.error(`Failed to load image as base64: ${error}`);
    }
  }, [imageCache, processUrl]);

  // Add this function to get image source from cache or placeholder
  const getImageSource = React.useCallback((item: MediaWithUser) => {
    // If we have a cached base64 version, use it
    if (imageCache[item.id]) {
      console.log(`Using cached image for ${item.id}`);
      return { uri: imageCache[item.id] };
    }
    
    // Otherwise, return the placeholder and start loading the image
    console.log(`No cached image for ${item.id}, loading and using placeholder`);
    loadImageAsBase64(item);
    return PLACEHOLDER_IMAGE;
  }, [imageCache, loadImageAsBase64]);

  // Restore the original renderMediaItem without the like button
  const renderMediaItem = React.useCallback(({ item }: { item: MediaWithUser }) => {
    const fixedUrl = fixSupabaseImageUrl(item.url);
    console.log(`Rendering media item: ${item.id} with fixed URL: ${fixedUrl.substring(0, 100)}...`);
    
    // Use our custom URL encoder
    const encodedUrl = customEncodeURL(fixedUrl);
    console.log(`Rendering item ${item.id} with URL: ${encodedUrl.substring(0, 100)}...`);
    
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

    // Define the image element
    const imageElement = (
      <Image 
        source={{ uri: encodedUrl }}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#f0f0f0',
        }}
        resizeMode="cover"
        onLoad={() => console.log(`Image loaded: ${item.id}`)}
        onError={(e) => console.error(`Image error: ${item.id}`, e.nativeEvent)}
      />
    );
    
    if (selectionMode) {
      // Selection mode rendering...
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
            {imageElement}
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
          {imageElement}
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
        {imageElement}
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
  }, [
    selectionMode, 
    selectedItems, 
    currentEvent, 
    isCreator, 
    session?.user?.id, 
    showFullScreenImage, 
    toggleItemSelection, 
    toggleSelectionMode,
    imageCache, // Add this dependency since we use getImageSource which uses imageCache
    customEncodeURL
  ]);

  // Fix the handleUploadImages function using the working implementation from CameraScreen
  const handleUploadImages = async () => {
    if (!eventId || !session?.user) {
      Alert.alert('Error', 'You must be logged in and have an active event to upload images');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access gallery was denied');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        exif: false,
        allowsEditing: false,
      });
      
      if (!result.canceled && result.assets.length > 0) {
        setUploadingImages(true);
        setUploadProgress(0);
        
        const totalImages = result.assets.length;
        let successfulUploads = 0;
        let failedUploads = 0;

        showToast(`Uploading ${totalImages} images...`, 'info');

        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          try {
            console.log(`Processing image ${i+1}/${totalImages}`);
            
            // Standardize image size
            const resizedImage = await ImageManipulator.manipulateAsync(
              asset.uri,
              [{ resize: { width: 1080, height: 1350 } }],
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            );
            
            // Convert to base64
            const base64 = await FileSystem.readAsStringAsync(resizedImage.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            // Generate unique filename and path
            const fileExt = 'jpg';
            const fileName = `${session.user.id}_${Date.now()}_${i}.${fileExt}`;
            const filePath = `${eventId}/${fileName}`;
            
            // Upload to Supabase Storage using the same method as CameraScreen
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
            
            // Get the public URL
            const { data: publicURLData } = supabase.storage
              .from('media')
              .getPublicUrl(filePath);
              
            const publicURL = publicURLData.publicUrl;
            
            // Add entry to the media table
            const { error: dbError } = await supabase
              .from('media')
              .insert({
                event_id: eventId,
                user_id: session.user.id,
                url: publicURL,
                type: 'photo',
              });
              
            if (dbError) {
              console.error('Database insert error:', dbError);
              throw dbError;
            }
            
            successfulUploads++;
            setUploadProgress((successfulUploads / totalImages) * 100);
            
          } catch (error) {
            console.error(`Error uploading image ${i+1}/${totalImages}:`, error);
            failedUploads++;
          }
        }
        
        if (successfulUploads > 0) {
          showToast(`Uploaded ${successfulUploads} of ${totalImages} images${failedUploads > 0 ? `, ${failedUploads} failed` : ''}`, 'success');
          fetchEventMedia(); // Refresh the gallery
        } else {
          showToast('All uploads failed. Please try again.', 'error');
        }
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      showToast('Failed to upload images', 'error');
    } finally {
      setUploadingImages(false);
      setUploadProgress(0);
    }
  };

  // Add the decode function from CameraScreen
  const decode = (base64: string): Uint8Array => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // Fix the standardizeImage function to use the proper API
  const standardizeImage = async (uri: string): Promise<string> => {
    try {
      // Use manipulateAsync without checking dimensions first
      const resizedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080, height: 1350 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      return resizedImage.uri;
    } catch (error) {
      console.error('Error standardizing image:', error);
      return uri; // Return original if processing fails
    }
  };

  // Helper function to check if an image URL is accessible
  const checkImageUrl = async (url: string): Promise<boolean> => {
    try {
      console.log(`Checking URL accessibility: ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const isOk = response.ok;
      console.log(`URL check result: ${isOk ? 'Accessible' : 'Not accessible'}`);
      return isOk;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`URL check error: ${errorMessage}`);
      return false;
    }
  };

  // Add a test upload function for debugging
  const handleDebugUpload = async () => {
    if (!eventId || !session?.user) {
      Alert.alert('Error', 'You must be logged in and have an active event to upload images');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access gallery was denied');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false, // Only pick one image for testing
        quality: 1.0,
        exif: false,
        allowsEditing: true, // Allow cropping for testing
        base64: true, // Add this to get base64 data directly
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setUploadingImages(true);
        
        Alert.alert('Debug Upload', 'Starting debug upload with one image');
        
        console.log('DEBUG UPLOAD - Selected asset:');
        console.log(`URI: ${asset.uri}`);
        console.log(`Width: ${asset.width}, Height: ${asset.height}`);
        console.log(`Type: ${asset.type || 'unknown'}`);
        console.log(`FileSize: ${asset.fileSize ? (asset.fileSize / 1024 / 1024).toFixed(2) + 'MB' : 'Unknown'}`);
        console.log(`Has base64: ${!!asset.base64}`);
        
        // Use a simple filename and path
        const fileName = `debug_${Date.now()}.jpg`;
        const filePath = `${eventId}/photos/${fileName}`;
        
        console.log(`Debug filename: ${fileName}`);
        console.log(`Debug filepath: ${filePath}`);
        
        try {
          let blob;
          // If we have base64 data, use it directly
          if (asset.base64) {
            // Create blob from base64
            const byteCharacters = atob(asset.base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            blob = new Blob([byteArray], { type: 'image/jpeg' });
            
            // Save in cache immediately
            const base64Uri = `data:image/jpeg;base64,${asset.base64}`;
            console.log('Saving in local cache immediately');
          } else {
            // Fetch as blob if base64 not available
            console.log('Fetching as blob...');
            const response = await fetch(asset.uri);
            blob = await response.blob();
          }
          
          console.log(`Blob created, size: ${blob.size} bytes, type: ${blob.type || 'unknown'}`);
          
          // Upload directly
          console.log('Uploading to Supabase...');
          const { data, error } = await supabase.storage
            .from('media')
            .upload(filePath, blob, {
              contentType: 'image/jpeg',
              upsert: true,
            });
          
          if (error) {
            console.error('Upload error:', error);
            throw error;
          }
          
          console.log('Upload successful, data:', data);
          
          // Get public URL
          console.log('Getting public URL...');
          const { data: urlData } = await supabase.storage
            .from('media')
            .getPublicUrl(filePath);
          
          if (!urlData) {
            console.error('No data returned when getting public URL');
            throw new Error('Failed to get public URL');
          }
          
          const publicUrl = urlData.publicUrl;
          console.log('Public URL:', publicUrl);
          
          // Create a new record for database
          const newMediaId = `debug_${Date.now()}`;
          
          // If we have base64 data, save it to cache immediately
          if (asset.base64) {
            // Cache the image so it displays immediately
            setImageCache(prev => ({
              ...prev,
              [newMediaId]: `data:image/jpeg;base64,${asset.base64}`
            }));
          }
          
          // Save to database
          console.log('Saving to database...');
          const { error: dbError } = await supabase
            .from('media')
            .insert({
              id: newMediaId, // Use our generated ID so we can show it immediately
              event_id: eventId,
              user_id: session.user.id,
              url: publicUrl,
              type: 'photo',
            });
          
          if (dbError) {
            console.error('Database insert error:', dbError);
            throw dbError;
          }
          
          console.log('Debug upload complete - refreshing gallery');
          fetchEventMedia();
          Alert.alert('Debug Upload', 'Upload completed successfully!');
          
        } catch (error) {
          console.error('Debug upload error:', error);
          Alert.alert('Debug Upload Error', `Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      console.error('Error in debug upload:', error);
      Alert.alert('Debug Upload Error', 'Failed to complete debug upload');
    } finally {
      setUploadingImages(false);
    }
  };

  // Load images as they enter the visible area
  React.useEffect(() => {
    if (filteredMedia.length === 0) return;
    
    console.log(`Loading ${Math.min(5, filteredMedia.length)} initial images...`);
    
    // Load first few images immediately
    const initialImages = filteredMedia.slice(0, 5);
    initialImages.forEach(item => {
      loadImageAsBase64(item);
    });
  }, [filteredMedia, loadImageAsBase64]);

  // Debug effect to track imageCache changes
  React.useEffect(() => {
    console.log(`[DEBUG] imageCache updated, entries: ${Object.keys(imageCache).length}`);
    // Uncomment the next line to see all cache keys
    // console.log(`[DEBUG] imageCache keys: ${Object.keys(imageCache).join(', ')}`);
  }, [imageCache]);

  // Add these state variables at the component level
  const [fullscreenLikeStatus, setFullscreenLikeStatus] = useState<Record<string, boolean>>({});
  const [fullscreenLikesCount, setFullscreenLikesCount] = useState<Record<string, number>>({});

  // Update these when selectedMedia changes
  useEffect(() => {
    if (selectedMedia) {
      setFullscreenLikeStatus(prev => ({
        ...prev,
        [selectedMedia.id]: selectedMedia.user_has_liked
      }));
      setFullscreenLikesCount(prev => ({
        ...prev,
        [selectedMedia.id]: selectedMedia.likes_count
      }));
    }
  }, [selectedMedia]);

  // Fix fullscreen and download button implementation
  const renderFullScreenImage = () => {
    if (!fullScreenVisible || !selectedMedia) return null;
    
    // Local function for showing toast in fullscreen context
    const showFullscreenToast = (msg: string, tp: 'success' | 'error' | 'info' = 'success') => {
      console.log('FULLSCREEN TOAST:', msg, tp);
      setToastMessage(msg);
      setToastType(tp);
      setToastVisible(true);
    };
    
    return (
      <View style={styles.absoluteFullscreen}>
        <StatusBar hidden />
        
        <View style={styles.centeredImageContainer}>
          <Image 
            source={{ uri: processImageUrl(selectedMedia.url) }}
            style={styles.trueFullscreenImage}
            resizeMode="contain"
          />
        </View>
        
        {/* Close button */}
        <TouchableOpacity 
          style={styles.closeButtonTopLeft}
          onPress={closeFullScreenImage}
        >
          <MaterialIcons name="close" size={32} color="#FFFFFF" />
        </TouchableOpacity>
        
        {/* Image counter */}
        <View style={styles.imageCounterContainer}>
          <Text style={styles.imageCounter}>
            {imageIndex + 1} / {filteredMedia.length}
          </Text>
        </View>
        
        {/* Navigation arrows */}
        {imageIndex > 0 && (
          <TouchableOpacity 
            style={[styles.navButton, styles.prevButton]}
            onPress={navigateToPreviousImage}
          >
            <MaterialIcons name="chevron-left" size={40} color="#fff" />
          </TouchableOpacity>
        )}
        
        {imageIndex < filteredMedia.length - 1 && (
          <TouchableOpacity 
            style={[styles.navButton, styles.nextButton]}
            onPress={navigateToNextImage}
          >
            <MaterialIcons name="chevron-right" size={40} color="#fff" />
          </TouchableOpacity>
        )}
        
        {/* Toast for the fullscreen view */}
        <Toast
          visible={toastVisible}
          message={toastMessage}
          type={toastType}
          duration={2000}
          onClose={() => setToastVisible(false)}
        />
        
        {/* Bottom action bar */}
        <View style={styles.fullScreenFooter}>
          <View style={styles.mediaInfo}>
            <Text style={styles.mediaInfoText}>
              By: {selectedMedia.user?.display_name || 'Unknown User'}
            </Text>
            <Text style={styles.mediaInfoDate}>
              {new Date(selectedMedia.created_at).toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.mediaActions}>
            {/* Like button */}
            <TouchableOpacity 
              style={[styles.mediaAction, selectedMedia.user_has_liked && styles.likedAction]}
              onPress={() => {
                const likeHandler = async () => {
                  try {
                    if (!session?.user) {
                      showToast('You must be logged in to like photos', 'error');
                      return;
                    }
                    
                    // Toggle the like status
                    const newLikeStatus = !selectedMedia.user_has_liked;
                    
                    // Update the UI immediately
                    setSelectedMedia({
                      ...selectedMedia,
                      user_has_liked: newLikeStatus,
                      likes_count: newLikeStatus 
                        ? (selectedMedia.likes_count || 0) + 1 
                        : Math.max(0, (selectedMedia.likes_count || 0) - 1)
                    });
                    
                    // Update in the database
                    if (newLikeStatus) {
                      // Like
                      await supabase
                        .from('media_likes')
                        .insert({
                          media_id: selectedMedia.id,
                          user_id: session.user.id,
                          created_at: new Date().toISOString()
                        });
                    } else {
                      // Unlike
                      await supabase
                        .from('media_likes')
                        .delete()
                        .eq('media_id', selectedMedia.id)
                        .eq('user_id', session.user.id);
                    }
                    
                    // Update main media arrays
                    setMedia(prevMedia => 
                      prevMedia.map(item => 
                        item.id === selectedMedia.id 
                          ? {
                              ...item,
                              user_has_liked: newLikeStatus,
                              likes_count: newLikeStatus 
                                ? (item.likes_count || 0) + 1 
                                : Math.max(0, (item.likes_count || 0) - 1)
                            } 
                          : item
                      )
                    );
                    
                    setFilteredMedia(prevMedia => 
                      prevMedia.map(item => 
                        item.id === selectedMedia.id 
                          ? {
                              ...item,
                              user_has_liked: newLikeStatus,
                              likes_count: newLikeStatus 
                                ? (item.likes_count || 0) + 1 
                                : Math.max(0, (item.likes_count || 0) - 1)
                            } 
                          : item
                      )
                    );
                  } catch (error) {
                    console.error('Error toggling like:', error);
                    showToast('Failed to update like status', 'error');
                  }
                };
                
                likeHandler();
              }}
            >
              <Ionicons 
                name={selectedMedia.user_has_liked ? "heart" : "heart-outline"} 
                size={24} 
                color={selectedMedia.user_has_liked ? "#ff4d4d" : "white"} 
              />
            </TouchableOpacity>
            
            {/* Download button - fixed implementation */}
            <TouchableOpacity 
              style={styles.mediaAction}
              onPress={() => {
                console.log("Download button pressed in fullscreen");
                // Show a toast directly using the local function
                showFullscreenToast('Downloading image...', 'info');
                
                // Then attempt to do the download (wrapped in try/catch)
                try {
                  downloadMedia(selectedMedia);
                } catch (error) {
                  console.error('Error in fullscreen download:', error);
                  showFullscreenToast('Download failed', 'error');
                }
              }}
            >
              <MaterialIcons name="file-download" size={24} color="white" />
            </TouchableOpacity>
            
            {/* Delete button (only shown if user can delete) */}
            {(isCreator || (session?.user && selectedMedia.user_id === session.user.id)) && (
              <TouchableOpacity 
                style={[styles.mediaAction, styles.deleteAction]}
                onPress={() => {
                  Alert.alert(
                    'Delete Photo',
                    'Are you sure you want to delete this photo?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Delete', 
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await deleteMedia(selectedMedia);
                            closeFullScreenImage();
                          } catch (error) {
                            console.error('Error deleting media:', error);
                            showToast('Failed to delete photo', 'error');
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <MaterialIcons name="delete" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Add a proper applyFilters function to sort and filter media
  useEffect(() => {
    if (media.length > 0) {
      // Start with all media
      let filtered = [...media];
      
      // Filter by user if needed
      if (showOnlyMyPhotos && session?.user) {
        filtered = filtered.filter(item => item.user_id === session.user.id);
      }
      
      // Check if we're using the section list (grouped by user)
      if (sortBy === 'by_user') {
        setIsSectionList(true);
        
        // Group photos by user_id
        const grouped: {[key: string]: {user: string, userId: string, data: MediaWithUser[]}} = {};
        
        filtered.forEach(item => {
          const userId = item.user_id || 'unknown';
          const displayName = item.user?.display_name || 'Unknown User';
          
          // Create an entry for this user if it doesn't exist
          if (!grouped[userId]) {
            grouped[userId] = {
              user: displayName,
              userId: userId,
              data: []
            };
          }
          
          // Add the photo to this user's group
          grouped[userId].data.push(item);
        });
        
        // Sort photos within each group by newest first
        Object.keys(grouped).forEach(userId => {
          grouped[userId].data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        });
        
        // Update the grouped state
        setGroupedMediaByUser(grouped);
      } else {
        setIsSectionList(false);
        
        // Apply regular sorting
        switch (sortBy) {
          case 'newest':
            filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            break;
          case 'oldest':
            filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            break;
          case 'most_likes':
            filtered.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
            break;
          default:
            // Default to newest first
            filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
      }
      
      // Update filtered media
      setFilteredMedia(filtered);
    }
  }, [media, sortBy, showOnlyMyPhotos, session?.user?.id]);

  // Handle navigation back to Events
  const handleBackPress = () => {
    navigation.navigate('Events');
  };

  // Fix the renderSectionHeader function to be simpler
  const renderSectionHeader = ({ section }: { section: { user: string, data: MediaWithUser[] } }) => (
    <Text style={styles.sectionHeaderText}>{section.user}</Text>
  );

  // Process image URLs for download/display
  const processImageUrl = (url: string): string => {
    // Make sure URL is properly encoded
    try {
      // First decode the URL to prevent double-encoding
      const decodedUrl = decodeURIComponent(url);
      
      // Parse the URL to get its components
      const parsedUrl = new URL(decodedUrl);
      
      // Create a properly encoded URL by encoding each path segment separately
      const encodedPath = parsedUrl.pathname.split('/').map(segment => 
        encodeURIComponent(segment)
      ).join('/');
      
      // Reconstruct the URL with encoded path
      parsedUrl.pathname = encodedPath;
      return parsedUrl.toString();
    } catch (error) {
      console.error('Error processing URL:', error);
      return url; // Return original if something fails
    }
  };

  // Add function to toggle filter modal
  const toggleFilterModal = () => {
    setFilterModalVisible(!filterModalVisible);
  };

  // Render filter modal
  const renderFilterModal = () => {
    return (
      <Modal
        animationType="fade"
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
            <TouchableOpacity
              style={[styles.sortOption, sortBy === 'by_user' && styles.selectedSortOption]}
              onPress={() => setSortBy('by_user')}
            >
              <Text style={styles.sortOptionText}>Group by User</Text>
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

  // Function to handle downloading all photos
  const handleDownloadAllPhotos = async () => {
    try {
      // Request permissions if not already granted
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showToast('Please grant permission to save photos to your device.', 'error');
        return;
      }
      
      // Show confirmation alert
      Alert.alert(
        'Download All Photos',
        `Are you sure you want to download all ${filteredMedia.length} photos to your device?`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Download',
            onPress: async () => {
              setDownloadingAll(true);
              
              // Create a temporary directory to store all images
              const tempDir = FileSystem.cacheDirectory + 'event_photos/';
              await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true }).catch(() => {});
              
              // Show info toast for download start
              showToast(`Downloading ${filteredMedia.length} photos. This may take a while.`, 'info');
              
              // Download each photo
              const downloadPromises = filteredMedia.map(async (item, index) => {
                try {
                  // Use cached version if available
                  let fileUri = '';
                  
                  if (imageCache[item.id]) {
                    // Generate a filename
                    const fileName = `photo_${index + 1}.jpg`;
                    fileUri = tempDir + fileName;
                    
                    // Extract base64 data
                    const base64Data = imageCache[item.id].split('base64,')[1];
                    
                    // Save the file
                    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
                      encoding: FileSystem.EncodingType.Base64,
                    });
                  } else {
                    // Download directly
                    const fileName = `photo_${index + 1}.jpg`;
                    fileUri = tempDir + fileName;
                    const downloadResult = await FileSystem.downloadAsync(item.url, fileUri);
                    
                    if (downloadResult.status !== 200) {
                      console.error(`Download failed for item ${index} with status ${downloadResult.status}`);
                      return null;
                    }
                  }
                  
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
              
              // Show completion toast
              showToast(`Successfully downloaded ${successfulDownloads.length} of ${filteredMedia.length} photos to your device.`, 'success');
              
              setDownloadingAll(false);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error downloading all photos:', error);
      showToast('There was an error downloading the photos.', 'error');
      setDownloadingAll(false);
    }
  };

  // Add the renderDebugUrlButton function
  const renderDebugUrlButton = () => {
    return null; // Return null so no button is shown
  };

  // Find the convertToJpeg function and enhance it to standardize size
  const convertToJpeg = async (uri: string) => {
    try {
      // Calculate target dimensions to maintain aspect ratio
      // Always resize to a reasonable standard size
      // Get dimensions using Image.getSize
      return new Promise<string>((resolve, reject) => {
        Image.getSize(uri, (width, height) => {
          // Calculate target size to maintain aspect ratio
          let targetWidth = 1080;  // Standard width
          let targetHeight = 1350; // Standard height
          
          // Adjust to maintain aspect ratio
          const aspectRatio = width / height;
          if (aspectRatio > 1) {
            // Landscape image
            targetHeight = Math.round(targetWidth / aspectRatio);
          } else {
            // Portrait image
            targetWidth = Math.round(targetHeight * aspectRatio);
          }
          
          // Perform the actual resizing
          ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: targetWidth, height: targetHeight } }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
          ).then(result => {
            console.log(`Standardized image size to ${targetWidth}x${targetHeight}`);
            resolve(result.uri);
          }).catch(error => {
            console.error('Failed to resize image:', error);
            // If resize fails, return the original
            resolve(uri);
          });
        }, (error) => {
          console.error('Failed to get image dimensions:', error);
          // If we can't get dimensions, use ImageManipulator without specific dimensions
          ImageManipulator.manipulateAsync(
            uri,
            [],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
          ).then(result => {
            resolve(result.uri);
          }).catch(err => {
            console.error('Failed to convert image:', err);
            resolve(uri);
          });
        });
      });
    } catch (error) {
      console.error('Error in convertToJpeg:', error);
      return uri; // Return original URI if anything fails
    }
  };

  // Add these state variables
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add refresh handler function
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchEventMedia();
    setIsRefreshing(false);
  };

  // Add this state variable
  const [showLoadMorePhotos, setShowLoadMorePhotos] = useState(false);

  // Add a ref to track the scroll position
  const flatListRef = useRef<FlatList<any>>(null);
  const groupedFlatListRef = useRef<FlatList<any>>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Position fullscreen at root level
  return (
    <>
      <HeaderBar />
      
      <View style={{flex: 1}}>
        <SafeAreaView style={styles.container}>
          {/* Main gallery content */}
          {headerVisible && (
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
                
                {/* Restore the original header with download all button */}
                <View style={styles.headerActionsContainer}>
                  {!selectionMode ? (
                    <>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={toggleFilterModal}
                      >
                        <MaterialIcons name="filter-list" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleUploadImages}
                      >
                        <MaterialIcons name="upload-file" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleDownloadAllPhotos}
                      >
                        <MaterialIcons name="file-download" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                      
                      {isCreator && (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={toggleSelectionMode}
                        >
                          <MaterialIcons name="select-all" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          setSelectionMode(false);
                          setSelectedItems([]);
                        }}
                      >
                        <MaterialIcons name="close" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                      
                      {selectedItems.length > 0 && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.deleteButton]}
                          onPress={deleteSelectedItems}
                          disabled={multiDeleteInProgress}
                        >
                          {multiDeleteInProgress ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <MaterialIcons name="delete" size={24} color="#FFFFFF" />
                          )}
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>
            </View>
          )}
          
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
              <MaterialIcons name="photo-library" size={64} color="#8E8E93" />
              <Text style={styles.emptyText}>No photos or videos yet</Text>
              <Text style={styles.emptySubtext}>Take photos or upload from your gallery</Text>
              
              <View style={{flexDirection: 'column', marginTop: 20}}>
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={() => navigation.navigate('Camera', { eventId })}
                >
                  <MaterialIcons name="camera-alt" size={24} color="#FFFFFF" style={{marginRight: 8}} />
                  <Text style={styles.cameraButtonText}>Take Photos</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {isSectionList ? (
                <FlatList
                  key="groupedList"
                  data={Object.values(groupedMediaByUser)}
                  renderItem={({ item }) => (
                    <View>
                      <Text style={styles.sectionHeaderText}>{item.user}</Text>
                      <FlatList
                        data={item.data}
                        renderItem={renderMediaItem}
                        keyExtractor={(item) => item.id}
                        numColumns={numColumns}
                        scrollEnabled={false}
                        contentContainerStyle={styles.mediaGrid}
                      />
                    </View>
                  )}
                  keyExtractor={(item) => item.userId || 'unknown'}
                  contentContainerStyle={styles.mediaList}
                  refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                  }
                  ListFooterComponent={<View style={{ height: 90 }} />}
                />
              ) : (
                <FlatList
                  key="gridList"
                  data={filteredMedia}
                  renderItem={renderMediaItem}
                  keyExtractor={item => item.id}
                  numColumns={numColumns}
                  contentContainerStyle={styles.mediaList}
                  refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                  }
                  onEndReached={() => {
                    if (filteredMedia.length >= 20) {
                      setShowLoadMorePhotos(true);
                    }
                  }}
                  onEndReachedThreshold={0.8}
                  ListFooterComponent={<View style={{ height: 90 }} />}
                  onScroll={(e) => {
                    setScrollPosition(e.nativeEvent.contentOffset.y);
                  }}
                  scrollEventThrottle={16}
                />
              )}
            </>
          )}
          
          {renderFilterModal()}
          
          {uploadingImages && (
            <View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 100,
            }}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: 'bold',
                marginTop: 16,
              }}>
                Uploading Images ({Math.round(uploadProgress)}%)
              </Text>
            </View>
          )}
        </SafeAreaView>
      </View>
      
      {/* Fullscreen view - positioned outside everything */}
      {fullScreenVisible && renderFullScreenImage()}
      
      {/* Toast component moved outside so it's visible from fullscreen view */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        duration={2000}
        onClose={() => setToastVisible(false)}
      />
    </>
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
    resizeMode: 'cover',
    overflow: 'hidden'
  } as ImageStyle,
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
    marginLeft: spacing.sm,
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
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    resizeMode: 'contain',
    overflow: 'hidden'
  } as ImageStyle,
  fullScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  fullScreenHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    zIndex: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 22,
    padding: 8,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 30,
    padding: 8,
    zIndex: 100,
  },
  prevButton: {
    left: 20,
    top: '50%',
    transform: [{ translateY: -25 }],
  },
  nextButton: {
    right: 20,
    top: '50%',
    transform: [{ translateY: -25 }],
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  likesCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 2,
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
    justifyContent: 'flex-end',
    padding: spacing.sm,
    borderBottomWidth: 1,
  },
  modernHeader: {
    backgroundColor: colors.primary,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: 8,
  },
  emptyButtons: {
    flexDirection: 'column',
    marginTop: 20,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  uploadOverlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  
  // New styles for our updated renderMediaItem function
  mediaItemContainer: {
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
  selectedItem: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  likeButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeCount: {
    color: 'white',
    fontSize: 10,
    position: 'absolute',
    bottom: -16,
    right: 0,
  },
  selectionCheckmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaItemFooter: {
    padding: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  mediaItemUsername: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  actionBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  horizontalMediaItem: {
    width: 150,
    height: 150,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  sectionHeader: {
    padding: 8,
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginVertical: 8,
    marginHorizontal: 8,
  },
  sectionSubText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  simpleSectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    paddingHorizontal: 8, 
    paddingVertical: 4,
    marginBottom: 4,
  },
  closeButtonTopLeft: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 22,
    padding: 8,
  },
  navigationArrows: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 5,
  },
  navArrowLeft: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 30,
    padding: 8,
  },
  navArrowRight: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 30,
    padding: 8,
  },
  
  // Add these styles for fullscreen mode
  absoluteFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
    zIndex: 9999,
    elevation: 9999,
  },
  centeredImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trueFullscreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8, // Using 80% of screen height
    resizeMode: 'contain',
  },
  imageCounterContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    padding: 8,
    zIndex: 100,
  },
}); 