import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Animated, PanResponder, StatusBar, Share } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { EventTabParamList, RootStackParamList } from '../../types';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Media } from '../types/database';
import { MaterialIcons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors, spacing } from '../styles/theme';
import { HeaderBar } from '../components/HeaderBar';
import { LoadingOverlay } from '../components/LoadingOverlay';

type GalleryScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<EventTabParamList, 'Gallery'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type GalleryScreenRouteProp = RouteProp<RootStackParamList, 'EventTabs'>;

type MediaWithUser = Media & {
  user: {
    display_name: string;
  };
};

const { width, height } = Dimensions.get('window');
const numColumns = 3;
const tileSize = width / numColumns;

export const GalleryScreen = () => {
  const navigation = useNavigation<GalleryScreenNavigationProp>();
  const route = useRoute<GalleryScreenRouteProp>();
  const { currentEvent, isCreator } = useEvent();
  const [media, setMedia] = useState<MediaWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaWithUser | null>(null);
  
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

  // Get event ID from route params or context
  const eventId = route.params?.eventId || currentEvent?.id;
  const eventName = route.params?.eventName || currentEvent?.name;

  // Add custom back button handler
  useLayoutEffect(() => {
    // We don't need to set a custom back button since we're using a custom header in App.tsx
    // that already has a back button to the Events screen
  }, [navigation]);

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

    return () => {
      console.log('Unsubscribing from media-channel');
      mediaSubscription.unsubscribe();
    };
  }, [eventId]);

  const fetchEventMedia = async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      console.log('Fetching media for event:', eventId);
      
      // Get media for the current event with user info
      const { data, error } = await supabase
        .from('media')
        .select(`
          *,
          user:user_id(display_name)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`Fetched ${data?.length || 0} media items`);
      setMedia(data as MediaWithUser[]);
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

    Alert.alert(
      'Delete Selected Media',
      `Are you sure you want to delete ${selectedItems.length} selected item(s)? This action cannot be undone.`,
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
              console.log('Starting batch deletion for', selectedItems.length, 'items');
              
              // Remove selected items from local state immediately
              setMedia(prevMedia => prevMedia.filter(m => !selectedItems.includes(m.id)));
              
              // Process each deletion in sequence
              for (const itemId of selectedItems) {
                const mediaItem = media.find(m => m.id === itemId);
                if (!mediaItem) continue;
                
                console.log('Deleting item:', itemId);
                
                // Delete from database
                const { error: dbError } = await supabase
                  .from('media')
                  .delete()
                  .eq('id', itemId);
                
                if (dbError) {
                  console.log('Database deletion error for item', itemId, ':', dbError);
                }
                
                // Try to delete from storage
                try {
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
                    await supabase.storage
                      .from('media')
                      .remove([storagePath]);
                  }
                } catch (storageError) {
                  console.log('Storage deletion error for item', itemId, ':', storageError);
                }
              }
              
              // Exit selection mode
              setSelectionMode(false);
              setSelectedItems([]);
              
              // Show success message
              Alert.alert('Success', `${selectedItems.length} item(s) removed from gallery`);
              
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

  const navigateToNextImage = () => {
    if (!selectedMedia || media.length <= 1) return;
    
    const currentIdx = media.findIndex(m => m.id === selectedMedia.id);
    if (currentIdx < media.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIndex(nextIdx);
      setSelectedMedia(media[nextIdx]);
    }
  };

  const navigateToPreviousImage = () => {
    if (!selectedMedia || media.length <= 1) return;
    
    const currentIdx = media.findIndex(m => m.id === selectedMedia.id);
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentIndex(prevIdx);
      setSelectedMedia(media[prevIdx]);
    }
  };

  // Update the selectedMedia setter to also hide the header
  const showFullScreenImage = (item: MediaWithUser) => {
    setSelectedMedia(item);
    setHeaderVisible(false);
  };
  
  // Update the close function to show the header again
  const closeFullScreenImage = () => {
    setSelectedMedia(null);
    setHeaderVisible(true);
  };

  // Update the renderMediaItem function to use the new showFullScreenImage function
  const renderMediaItem = ({ item }: { item: MediaWithUser }) => {
    if (selectionMode) {
      const isSelected = selectedItems.includes(item.id);
      return (
        <TouchableOpacity 
          style={[styles.mediaItem, isSelected && styles.selectedMediaItem]}
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
        </TouchableOpacity>
      );
    }
    
    return (
      <TouchableOpacity 
        style={styles.mediaItem}
        onPress={() => showFullScreenImage(item)}
        onLongPress={() => {
          if (isCreator) {
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
      </TouchableOpacity>
    );
  };

  // Update the renderFullScreenImage function to use the closeFullScreenImage function
  const renderFullScreenImage = () => {
    if (!selectedMedia) return null;
    
    const currentIdx = media.findIndex(m => m.id === selectedMedia.id);
    const hasPrevious = currentIdx > 0;
    const hasNext = currentIdx < media.length - 1;
    
    return (
      <View style={styles.fullScreenContainer}>
        <StatusBar hidden />
        
        <View style={styles.fullScreenImageContainer}>
          <Image 
            source={{ uri: selectedMedia.url }} 
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
        </View>
        
        <View style={styles.fullScreenOverlay}>
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={closeFullScreenImage}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            <Text style={styles.imageCounter}>
              {currentIdx + 1} / {media.length}
            </Text>
          </View>
          
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
              
              {isCreator && (
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
            >
              <MaterialIcons name="chevron-left" size={40} color="#fff" />
            </TouchableOpacity>
          )}
          
          {hasNext && (
            <TouchableOpacity 
              style={[styles.navButton, styles.nextButton]}
              onPress={navigateToNextImage}
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
        `Downloading ${media.length} photos. This may take a while.`,
        [{ text: 'OK' }]
      );
      
      // Download each photo
      const downloadPromises = media.map(async (item, index) => {
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
        `Successfully downloaded ${successfulDownloads.length} of ${media.length} photos to your device.`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Error downloading all photos:', error);
      Alert.alert('Download Failed', 'There was an error downloading the photos.');
    } finally {
      setDownloadingAll(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingOverlay isVisible={true} message="Loading gallery..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
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

  if (media.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
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

  return (
    <View style={styles.container}>
      {headerVisible && eventName && (
        <View style={styles.eventBanner}>
          {selectionMode ? (
            <>
              <Text style={styles.eventName}>
                {selectedItems.length} selected
              </Text>
              <View style={styles.selectionModeActions}>
                <TouchableOpacity 
                  style={styles.selectionModeAction}
                  onPress={toggleSelectionMode}
                >
                  <Text style={styles.selectionModeActionText}>Cancel</Text>
                </TouchableOpacity>
                {isCreator && selectedItems.length > 0 && (
                  <TouchableOpacity 
                    style={[styles.selectionModeAction, styles.deleteAction]}
                    onPress={deleteSelectedItems}
                    disabled={multiDeleteInProgress}
                  >
                    {multiDeleteInProgress ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.selectionModeActionText}>Delete</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <>
              <View style={styles.eventNameContainer}>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Events')}
                  style={{ marginRight: 10 }}
                >
                  <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.eventName} numberOfLines={1} ellipsizeMode="tail">
                  Event: {eventName}
                </Text>
              </View>
              <View style={styles.eventActions}>
                {isCreator && (
                  <Text style={styles.creatorBadge}>Creator</Text>
                )}
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={handleDownloadAllPhotos}
                  disabled={downloadingAll || media.length === 0}
                >
                  {downloadingAll ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcons 
                      name="file-download" 
                      size={24} 
                      color="#FFFFFF" 
                    />
                  )}
                </TouchableOpacity>
                {isCreator && (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={toggleSelectionMode}
                  >
                    <MaterialIcons name="select-all" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      )}
      
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
          ) : media.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="photo-library" size={64} color="#CCCCCC" />
              <Text style={styles.emptyText}>No photos yet</Text>
              <Text style={styles.emptySubtext}>Take some photos to get started!</Text>
            </View>
          ) : (
            <FlatList
              data={media}
              renderItem={renderMediaItem}
              keyExtractor={(item) => item.id}
              numColumns={numColumns}
              contentContainerStyle={styles.mediaGrid}
              refreshing={loading}
              onRefresh={fetchEventMedia}
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
    </View>
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
    padding: spacing.sm,
  },
  mediaItem: {
    width: tileSize - spacing.sm * 2,
    height: tileSize - spacing.sm * 2,
    margin: spacing.xs,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text.secondary,
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
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.secondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 8,
  },
  cameraButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  cameraButtonText: {
    color: '#fff',
    fontWeight: 'bold',
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
    marginHorizontal: 8,
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
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCounter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  fullScreenFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
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
}); 