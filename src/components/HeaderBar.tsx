import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  Platform,
  StatusBar
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../styles/theme';

interface HeaderBarProps {
  title?: string;
  rightComponent?: React.ReactNode;
  forceTitle?: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ 
  title,
  rightComponent,
  forceTitle
}) => {
  const navigation = useNavigation();
  const route = useRoute();
  const { session } = useAuth();
  const { currentEvent } = useEvent();
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  
  // Determine if this is the events screen (main screen)
  const isEventsScreen = route.name === 'Events';
  
  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
    }
  }, [session]);
  
  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user')
        .select('display_name')
        .eq('id', session?.user?.id)
        .single();
        
      if (error) {
        return;
      }
      
      if (data) {
        setUserDisplayName(data.display_name);
      }
    } catch (error) {
      // Handle silently
    }
  };
  
  const handleProfilePress = () => {
    // @ts-ignore - Navigation typing is complex
    navigation.navigate('ProfileSettings');
  };
  
  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          {title ? (
            <>
              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <MaterialIcons name="arrow-back" size={30} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </>
          ) : (
            <>
              <Image 
                source={require('../../assets/AppImage.jpg')} 
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.appName} numberOfLines={1}>
                {isEventsScreen 
                  ? 'EventSnap' 
                  : (forceTitle || currentEvent?.name || 'EventSnap')}
              </Text>
            </>
          )}
        </View>
        
        {rightComponent ? (
          <View style={styles.rightComponentContainer}>
            {rightComponent}
          </View>
        ) : (
          <View style={styles.userContainer}>
            {userDisplayName ? (
              <Text style={styles.userName} numberOfLines={1}>Hi, {userDisplayName}</Text>
            ) : null}
            
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={handleProfilePress}
            >
              <MaterialIcons name="account-circle" size={36} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 30 : (StatusBar.currentHeight || 0) * 0.75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
    height: Platform.OS === 'ios' ? 105 : (StatusBar.currentHeight || 0) + 75,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 75,
    maxHeight: 75,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    maxHeight: 75,
  },
  logo: {
    width: 40,
    height: 40,
    maxWidth: 40,
    maxHeight: 40,
    marginLeft: 4,
    borderRadius: 20,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  title: {
    color: '#FFFFFF',
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
    flexShrink: 1,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
    marginRight: spacing.sm,
  },
  profileButton: {
    padding: 8,
  },
  backButton: {
    padding: 8,
  },
  rightComponentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    maxHeight: 75,
  },
}); 