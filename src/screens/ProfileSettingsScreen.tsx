import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import { HeaderBar } from '../components/HeaderBar';

export const ProfileSettingsScreen = () => {
  const navigation = useNavigation();
  const { session, signOut } = useAuth();
  
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  
  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
    }
  }, [session]);
  
  const fetchUserProfile = async () => {
    try {
      setProfileLoading(true);
      
      const { data, error } = await supabase
        .from('user')
        .select('display_name, email')
        .eq('id', session?.user?.id)
        .single();
        
      if (error) {
        console.error('Error fetching user profile:', error);
        Alert.alert('Error', 'Failed to load profile information');
        return;
      }
      
      if (data) {
        setDisplayName(data.display_name || '');
        setEmail(data.email || session?.user?.email || '');
      }
    } catch (error) {
      console.error('Unexpected error fetching user profile:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setProfileLoading(false);
    }
  };
  
  const updateProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }
    
    try {
      setLoading(true);
      
      // Update display name in user table
      const { error: profileError } = await supabase
        .from('user')
        .update({ display_name: displayName.trim() })
        .eq('id', session?.user?.id);
        
      if (profileError) {
        console.error('Error updating profile:', profileError);
        Alert.alert('Error', 'Failed to update profile');
        return;
      }
      
      // Update user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() }
      });
      
      if (metadataError) {
        console.error('Error updating user metadata:', metadataError);
        // Continue anyway since the database was updated
      }
      
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Unexpected error updating profile:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const changePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }
    
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    
    try {
      setLoading(true);
      
      // First verify the current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPassword,
      });
      
      if (signInError) {
        console.error('Current password verification failed:', signInError);
        Alert.alert('Error', 'Current password is incorrect');
        return;
      }
      
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (updateError) {
        console.error('Error updating password:', updateError);
        Alert.alert('Error', 'Failed to update password');
        return;
      }
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      Alert.alert('Success', 'Password updated successfully');
    } catch (error) {
      console.error('Unexpected error changing password:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSignOut = () => {
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
          style: 'destructive',
          onPress: signOut
        }
      ]
    );
  };
  
  if (profileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.mainContainer}>
      <HeaderBar title="Profile" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
            </View>
            <Text style={styles.profileName}>{displayName || 'User'}</Text>
            <Text style={styles.profileEmail}>{email}</Text>
          </View>
          
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="person" size={22} color={colors.primary} />
              <Text style={styles.cardTitle}>Profile Information</Text>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your display name"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={email}
                editable={false}
              />
            </View>
            
            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={updateProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="save" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Update Profile</Text>
                </>
              )}
            </TouchableOpacity>
            
            {updateSuccess && (
              <View style={styles.successContainer}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.successText}>Profile updated successfully!</Text>
              </View>
            )}
          </View>
          
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="lock" size={22} color={colors.primary} />
              <Text style={styles.cardTitle}>Security</Text>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Current Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  secureTextEntry
                />
                <MaterialIcons name="visibility-off" size={20} color={colors.text.tertiary} />
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  secureTextEntry
                />
                <MaterialIcons name="visibility-off" size={20} color={colors.text.tertiary} />
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry
                />
                <MaterialIcons name="visibility-off" size={20} color={colors.text.tertiary} />
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.button, styles.passwordButton]}
              onPress={changePassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="vpn-key" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Change Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[styles.button, styles.signOutButton]}
            onPress={handleSignOut}
            disabled={loading}
          >
            <MaterialIcons name="logout" size={18} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>EventSnap v1.0.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  contentContainer: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: typography.sizes.xl,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingRight: spacing.sm,
  },
  passwordInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  disabledInput: {
    backgroundColor: '#F0F0F0',
    color: colors.text.secondary,
  },
  button: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  buttonIcon: {
    marginRight: spacing.xs,
  },
  updateButton: {
    backgroundColor: colors.primary,
  },
  passwordButton: {
    backgroundColor: '#4CAF50',
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
    fontWeight: 'bold',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  successText: {
    color: '#4CAF50',
    fontSize: typography.sizes.sm,
    marginLeft: spacing.xs,
  },
  footer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  footerText: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
}); 