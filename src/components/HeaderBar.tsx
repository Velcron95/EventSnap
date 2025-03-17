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
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ title }) => {
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
                <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.title}>{title}</Text>
            </>
          ) : (
            <>
              <Image 
                source={require('../../assets/AppImage.jpg')} 
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.appName}>EventSnap</Text>
            </>
          )}
        </View>
        
        <View style={styles.userContainer}>
          {userDisplayName ? (
            <Text style={styles.userName}>Hi, {userDisplayName}</Text>
          ) : null}
          
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={handleProfilePress}
          >
            <MaterialIcons name="account-circle" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 28 : (StatusBar.currentHeight || 0) * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    height: 45,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
}); 