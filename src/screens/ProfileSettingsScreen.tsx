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
  Linking,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import { HeaderBar } from '../components/HeaderBar';
import { updateUserDisplayNameEverywhere } from '../lib/displayNameUtils';
import { RootStackParamList } from '../../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Toast } from '../components/Toast';

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ProfileSettings'
>;

export const ProfileSettingsScreen = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { session, signOut } = useAuth();
  
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  
  // Add state for reset password modal
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [resetVerificationCode, setResetVerificationCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  
  // Add new state variables for password visibility
  const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [resetNewPasswordVisible, setResetNewPasswordVisible] = useState(false);
  const [resetConfirmPasswordVisible, setResetConfirmPasswordVisible] = useState(false);
  
  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  
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
      
      // Use the utility function to update display name everywhere
      if (session?.user?.id) {
        await updateUserDisplayNameEverywhere(session.user.id, displayName.trim());
      } else {
        throw new Error('No user session found');
      }
      
      // Show toast instead of alert
      setToastMessage('Profile updated successfully');
      setToastType('success');
      setToastVisible(true);
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
  
  // Handle back button
  const handleBack = () => {
    navigation.navigate('SignIn' as never);
  };

  const navigateToForgotPassword = async () => {
    // Present a simple dialog to confirm the password reset
    Alert.alert(
      'Reset Password',
      'We will send a verification code to your email. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Send Code',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Request password reset for the currently logged-in user
              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'eventsnap://auth/callback',
              });
              
              if (error) {
                console.error('Error requesting password reset:', error);
                Alert.alert('Error', 'Failed to request password reset. Please try again.');
                return;
              }
              
              // Show the reset password modal instead of just an alert
              Alert.alert(
                'Verification Code Sent',
                'A verification code has been sent to your email. Enter it along with your new password.',
                [{ text: 'OK', onPress: () => setResetPasswordModalVisible(true) }]
              );
            } catch (err) {
              console.error('Error in password reset flow:', err);
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleResetPassword = async () => {
    // Validate inputs
    if (!resetVerificationCode || resetVerificationCode.length < 6) {
      Alert.alert('Error', 'Please enter the 6-digit verification code from your email');
      return;
    }
    
    if (!resetNewPassword || resetNewPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }
    
    if (resetNewPassword !== resetConfirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    setResetPasswordLoading(true);
    
    try {
      // First verify the OTP code
      console.log('Verifying code and resetting password...');
      
      // Verify the OTP first
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: resetVerificationCode,
        type: 'recovery'
      });
      
      if (verifyError) {
        console.error('Verification error:', verifyError);
        Alert.alert('Error', 'Invalid or expired verification code. Please try again.');
        setResetPasswordLoading(false);
        return;
      }
      
      // Now update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: resetNewPassword
      });
      
      if (updateError) {
        Alert.alert('Error', updateError.message);
      } else {
        // First close the modal to prevent it reopening
        setResetPasswordModalVisible(false);
        
        // Then show success message
        setTimeout(() => {
          Alert.alert(
            'Success',
            'Your password has been reset successfully.'
          );
        }, 300);
        
        // Clear the fields
        setResetVerificationCode('');
        setResetNewPassword('');
        setResetConfirmPassword('');
      }
    } catch (err) {
      console.error('Error resetting password:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setResetPasswordLoading(false);
    }
  };
  
  const openUrl = async (url: string, errorMsg = 'Could not open URL') => {
    try {
      // First check if the URL can be opened
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
        console.log(`Opened URL: ${url}`);
      } else {
        console.error(`Cannot open URL: ${url}`);
        Alert.alert('Error', `This device cannot open the URL: ${url}`);
      }
    } catch (err) {
      console.error('Error opening URL:', err);
      Alert.alert('Error', errorMsg, [
        { text: 'OK' },
        { 
          text: 'Copy URL', 
          onPress: () => {
            // This would use clipboard functionality in a real app
            Alert.alert('URL Copied', url);
          }
        }
      ]);
    }
  };

  const openWebsite = () => {
    openUrl('https://codenova-eventsnap.vercel.app/', 'Could not open the website');
  };

  const openPrivacyPolicy = () => {
    openUrl('https://codenova-eventsnap.vercel.app/privacy', 'Could not open the privacy policy');
  };

  const openTermsOfService = () => {
    openUrl('https://codenova-eventsnap.vercel.app/terms', 'Could not open the terms of service');
  };

  const openDeleteAccountPage = () => {
    openUrl('https://codenova-eventsnap.vercel.app/delete-account', 'Could not open the account deletion page');
  };

  // Render the reset password modal
  const renderResetPasswordModal = () => {
    return (
      <Modal
        visible={resetPasswordModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity 
                onPress={() => setResetPasswordModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Enter the verification code from your email and set your new password
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="Enter 6-digit code"
                value={resetVerificationCode}
                onChangeText={setResetVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter new password"
                  value={resetNewPassword}
                  onChangeText={setResetNewPassword}
                  secureTextEntry={!resetNewPasswordVisible}
                />
                <TouchableOpacity onPress={() => setResetNewPasswordVisible(!resetNewPasswordVisible)}>
                  <MaterialIcons 
                    name={resetNewPasswordVisible ? "visibility" : "visibility-off"} 
                    size={20} 
                    color={colors.text.tertiary} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Confirm new password"
                  value={resetConfirmPassword}
                  onChangeText={setResetConfirmPassword}
                  secureTextEntry={!resetConfirmPasswordVisible}
                />
                <TouchableOpacity onPress={() => setResetConfirmPasswordVisible(!resetConfirmPasswordVisible)}>
                  <MaterialIcons 
                    name={resetConfirmPasswordVisible ? "visibility" : "visibility-off"} 
                    size={20} 
                    color={colors.text.tertiary} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.button, styles.resetPasswordButton]}
              onPress={handleResetPassword}
              disabled={resetPasswordLoading}
            >
              {resetPasswordLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
              <Text style={styles.helperText}>
                Your display name will be visible to other users in events, galleries, and participant lists.
              </Text>
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
                  secureTextEntry={!currentPasswordVisible}
                />
                <TouchableOpacity onPress={() => setCurrentPasswordVisible(!currentPasswordVisible)}>
                  <MaterialIcons 
                    name={currentPasswordVisible ? "visibility" : "visibility-off"} 
                    size={20} 
                    color={colors.text.tertiary} 
                  />
                </TouchableOpacity>
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
                  secureTextEntry={!newPasswordVisible}
                />
                <TouchableOpacity onPress={() => setNewPasswordVisible(!newPasswordVisible)}>
                  <MaterialIcons 
                    name={newPasswordVisible ? "visibility" : "visibility-off"} 
                    size={20} 
                    color={colors.text.tertiary} 
                  />
                </TouchableOpacity>
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
                  secureTextEntry={!confirmPasswordVisible}
                />
                <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
                  <MaterialIcons 
                    name={confirmPasswordVisible ? "visibility" : "visibility-off"} 
                    size={20} 
                    color={colors.text.tertiary} 
                  />
                </TouchableOpacity>
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
            
            <TouchableOpacity 
              style={styles.forgotPasswordLink}
              onPress={navigateToForgotPassword}
            >
              <Text style={styles.linkText}>Forgot your password? Reset it here</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="info" size={22} color={colors.primary} />
              <Text style={styles.cardTitle}>Account Management</Text>
            </View>
            
            <TouchableOpacity style={styles.linkRow} onPress={openWebsite}>
              <MaterialIcons name="public" size={20} color={colors.primary} />
              <Text style={styles.linkText}>Visit our website</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.linkRow} 
              onPress={openPrivacyPolicy}
            >
              <MaterialIcons name="privacy-tip" size={20} color={colors.primary} />
              <Text style={styles.linkText}>Privacy Policy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.linkRow}
              onPress={openTermsOfService}
            >
              <MaterialIcons name="description" size={20} color={colors.primary} />
              <Text style={styles.linkText}>Terms of Service</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.linkRow, styles.deleteAccountRow]}
              onPress={() => Alert.alert(
                'Delete Account',
                'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Continue', 
                    style: 'destructive',
                    onPress: openDeleteAccountPage 
                  }
                ]
              )}
            >
              <MaterialIcons name="delete" size={20} color="#FF3B30" />
              <Text style={[styles.linkText, styles.deleteAccountText]}>Delete Your Account</Text>
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
      
      {/* Add the password reset modal */}
      {renderResetPasswordModal()}
      
      {/* Add Toast component */}
      <Toast 
        visible={toastVisible} 
        message={toastMessage}
        type={toastType}
        onClose={() => setToastVisible(false)}
      />
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
  helperText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  forgotPasswordLink: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  linkText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    marginLeft: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  deleteAccountRow: {
    borderBottomWidth: 0,
  },
  deleteAccountText: {
    color: '#FF3B30',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 500,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 10,
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
  },
  resetPasswordButton: {
    backgroundColor: colors.primary,
    marginTop: spacing.lg,
  },
}); 