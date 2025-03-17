import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, borderRadius, spacing, shadows } from '../styles/theme';

interface EventCardProps {
  title: string;
  date?: string;
  location?: string;
  imageUrl?: string;
  participantCount: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  isCreator?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({
  title,
  participantCount,
  imageUrl,
  onPress,
  style,
  isCreator = false,
}) => {
  console.log('EventCard rendering with imageUrl:', imageUrl);
  
  return (
    <TouchableOpacity
      style={[styles.container, shadows.md, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <ImageBackground 
        source={imageUrl ? { uri: imageUrl } : undefined}
        style={styles.backgroundImage}
        imageStyle={{ opacity: 0.9 }}
        onError={(error) => console.error('Image loading error:', error.nativeEvent.error)}
      >
        <View style={[styles.overlay, !imageUrl && styles.placeholderBackground]}>
          {isCreator && (
            <View style={styles.creatorBadge}>
              <Text style={styles.creatorBadgeText}>Creator</Text>
            </View>
          )}
          
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          </View>
          
          <View style={styles.detailsContainer}>
            <View style={styles.detail}>
              <MaterialIcons name="people" size={16} color="#FFFFFF" />
              <Text style={styles.detailText}>
                {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
              </Text>
            </View>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 180,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  detailsContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: '#FFFFFF',
  },
  creatorBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  creatorBadgeText: {
    color: 'white',
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  placeholderBackground: {
    backgroundColor: '#3498db',
  },
}); 