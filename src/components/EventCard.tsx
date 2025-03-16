import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, borderRadius, spacing, shadows } from '../styles/theme';

interface EventCardProps {
  title: string;
  date: string;
  location: string;
  imageUrl?: string;
  participantCount: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  isCreator?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({
  title,
  date,
  location,
  imageUrl,
  participantCount,
  onPress,
  style,
  isCreator = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, shadows.md, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} />
      ) : (
        <View style={styles.placeholderImage}>
          <MaterialIcons name="event" size={32} color={colors.text.tertiary} />
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {isCreator && (
            <View style={styles.creatorBadge}>
              <Text style={styles.creatorBadgeText}>Creator</Text>
            </View>
          )}
        </View>
        <View style={styles.detailsContainer}>
          <View style={styles.detail}>
            <MaterialIcons name="event" size={16} color={colors.text.secondary} />
            <Text style={styles.detailText}>{date}</Text>
          </View>
          <View style={styles.detail}>
            <MaterialIcons name="location-on" size={16} color={colors.text.secondary} />
            <Text style={styles.detailText} numberOfLines={1}>
              {location}
            </Text>
          </View>
          <View style={styles.detail}>
            <MaterialIcons name="people" size={16} color={colors.text.secondary} />
            <Text style={styles.detailText}>
              {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  image: {
    width: '100%',
    height: 150,
    backgroundColor: colors.surface,
  },
  placeholderImage: {
    width: '100%',
    height: 150,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  detailsContainer: {
    gap: spacing.xs,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  creatorBadge: {
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
}); 