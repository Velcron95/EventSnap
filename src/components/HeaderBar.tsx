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
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../styles/theme';

interface HeaderBarProps {
  title?: string;
  rightComponent?: React.ReactNode;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ 
  title,
  rightComponent
}) => {
  const navigation = useNavigation();
  const { session } = useAuth();
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  
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
        console.error('Error fetching user profile:', error);
        return;
      }
      
      if (data) {
        setUserDisplayName(data.display_name);
      }
    } catch (error) {
      console.error('Unexpected error fetching user profile:', error);
    }
  };
  
  const handleProfilePress = () => {
    // @ts-ignore - Navigation typing is complex
    navigation.navigate('ProfileSettings');
  };
  
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={colors.primary} barStyle="light-content" />
      
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          {title ? (
            <>
              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
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
              <Text style={styles.appName} numberOfLines={1}>EventSnap</Text>
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
              <MaterialIcons name="account-circle" size={24} color="#FFFFFF" />
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
    paddingTop: Platform.OS === 'ios' ? 20 : (StatusBar.currentHeight || 0) * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
    height: Platform.OS === 'ios' ? 70 : (StatusBar.currentHeight || 0) + 50,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    height: 50,
    maxHeight: 50,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    maxHeight: 50,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    maxWidth: 32,
    maxHeight: 32,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  title: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
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
    fontSize: typography.sizes.sm,
    marginRight: spacing.sm,
  },
  profileButton: {
    padding: 4,
  },
  backButton: {
    padding: 4,
  },
  rightComponentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    maxHeight: 50,
  },
}); 