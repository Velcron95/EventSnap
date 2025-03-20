import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, typography } from '../styles/theme';
import { showErrorAlert, showSuccessAlert } from '../utils/alert';
import { RootStackParamList } from '../../types';

type ForgotPasswordScreenRouteProp = RouteProp<
  RootStackParamList,
  'ForgotPassword'
>;

export const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<ForgotPasswordScreenRouteProp>();
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  
  // Handle email passed from sign in screen
  useEffect(() => {
    if (route.params?.email) {
      setEmail(route.params.email);
      
      // If coming from profile, code is already requested
      if (route.params?.comingFromProfile) {
        setCodeSent(true);
      }
    }
  }, [route.params?.email, route.params?.comingFromProfile]);
  
  // Only force sign out when NOT coming from profile
  useEffect(() => {
    const signOut = async () => {
      // Don't sign out if coming from profile - user is already authenticated
      if (route.params?.comingFromProfile) {
        console.log('Keeping user signed in (coming from profile)');
        return;
      }
      
      try {
        await supabase.auth.signOut();
        console.log('Signed out on screen load');
      } catch (error) {
        console.error('Error signing out:', error);
      }
    };
    
    signOut();
  }, [route.params?.comingFromProfile]);
  
  const handleRequestReset = async () => {
    if (!email || !email.includes('@')) {
      showErrorAlert('Error', 'Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        showErrorAlert('Error', error.message);
      } else {
        showSuccessAlert(
          'Check Your Email',
          'We\'ve sent a verification code to your email. Enter it below along with your new password.'
        );
        setCodeSent(true);
      }
    } catch (err) {
      console.error('Password reset error:', err);
      showErrorAlert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const handleResetPassword = async () => {
    // Validate all fields
    if (!verificationCode || verificationCode.length < 6) {
      showErrorAlert('Error', 'Please enter the 6-digit verification code from your email');
      return;
    }
    
    if (!newPassword || newPassword.length < 8) {
      showErrorAlert('Error', 'Password must be at least 8 characters long');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showErrorAlert('Error', 'Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      // First verify the OTP code
      console.log('Verifying code and resetting password...');
      
      // Verify the OTP first - this will also sign the user in
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'recovery'
      });
      
      if (verifyError) {
        console.error('Verification error:', verifyError);
        showErrorAlert('Error', 'Invalid or expired verification code. Please try again.');
        setLoading(false);
        return;
      }
      
      // Now update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      // Sign out regardless of the result
      await supabase.auth.signOut();
      
      if (updateError) {
        showErrorAlert('Error', updateError.message);
      } else {
        showSuccessAlert(
          'Success',
          'Your password has been reset successfully. Please sign in with your new password.',
          () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'SignIn' as never }],
            });
          }
        );
      }
    } catch (err) {
      console.error('Password reset error:', err);
      showErrorAlert('Error', 'An unexpected error occurred');
      
      // Try to sign out if there was an error
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error('Error signing out:', e);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Handle back button
  const handleBack = () => {
    if (route.params?.comingFromProfile) {
      navigation.navigate('ProfileSettings' as never);
    } else {
      navigation.navigate('SignIn' as never);
    }
  };
  
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.content}>
          <Text style={styles.title}>Reset Your Password</Text>
          
          <View style={styles.formContainer}>
            {!codeSent ? (
              <>
                <Text style={styles.subtitle}>
                  Enter your email address and we'll send you a verification code to reset your password
                </Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                </View>
                
                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleRequestReset}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Send Verification Code</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  Enter the verification code from your email and set a new password
                </Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Verification Code</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>
                
                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.textButton}
                  onPress={handleRequestReset}
                >
                  <Text style={styles.textButtonText}>Resend Code</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
    fontWeight: 'bold',
  },
  textButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  textButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
  },
}); 