import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
  Animated,
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
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
  
  // Use layout effect to manage CodeSent changes with animation
  useLayoutEffect(() => {
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true
    }).start(() => {
      // Fade in after state change is complete
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      }).start();
    });
  }, [codeSent, fadeAnim]);
  
  const handleRequestReset = async () => {
    if (!email || !email.includes('@')) {
      showErrorAlert('Error', 'Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        if (error.message.includes('rate limit exceeded')) {
          showErrorAlert(
            'Rate Limit Exceeded',
            'Too many attempts. Please wait a few minutes before trying again or check your email for the previous reset link.'
          );
        } else {
          showErrorAlert('Error', error.message);
        }
      } else {
        setCodeSent(true);
        showSuccessAlert(
          'Check Your Email',
          'We\'ve sent a verification code to your email. Enter it below along with your new password.'
        );
      }
    } catch (err) {
      console.error('Password reset error:', err);
      if (err instanceof Error) {
        if (err.message.includes('rate limit exceeded')) {
          showErrorAlert(
            'Rate Limit Exceeded',
            'Too many attempts. Please wait a few minutes before trying again or check your email for the previous reset link.'
          );
        } else if (err.message.includes('email rate succeeded')) {
          setCodeSent(true);
          showSuccessAlert(
            'Check Your Email',
            'We\'ve sent a verification code to your email. Enter it below along with your new password.'
          );
        } else {
          showErrorAlert('Error', 'An unexpected error occurred');
        }
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleResetPassword = async () => {
    if (!email || !newPassword || !confirmPassword || !verificationCode) {
      showErrorAlert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      showErrorAlert('Error', 'Passwords do not match');
      return;
    }

    // Password requirements check
    if (newPassword.length < 6 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      showErrorAlert('Error', 'Password must have at least 6 characters, one uppercase letter, and one number');
      return;
    }

    setLoading(true);
    
    try {
      // First verify the OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'recovery'
      });

      if (verifyError) {
        showErrorAlert('Error', 'Invalid or expired verification code. Please try again.');
        return;
      }

      // After successful OTP verification, update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (updateError) {
        // Only show error if it's not related to same password
        const errorMessage = updateError.message.toLowerCase();
        if (!errorMessage.includes('same password') && 
            !errorMessage.includes('new password should be different')) {
          showErrorAlert('Error', updateError.message);
          return;
        }
      }

      // Sign out and redirect
      await supabase.auth.signOut();
      showSuccessAlert(
        'Success',
        'Your password has been updated successfully. Please sign in with your password.',
        () => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'SignIn' as never }],
          });
        }
      );
    } catch (error) {
      console.error('Unexpected error during password reset:', error);
      showErrorAlert('Error', 'An unexpected error occurred while resetting your password.');
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.content}>
          <Text style={styles.title}>Reset Your Password</Text>
          
          <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
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
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowNewPassword(!showNewPassword)}
                    >
                      <MaterialIcons
                        name={showNewPassword ? "visibility-off" : "visibility"}
                        size={24}
                        color={colors.text.secondary}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.passwordCriteria}>
                    <Text style={styles.criteriaText}>Password must have:</Text>
                    <Text style={[
                      styles.criteriaItem,
                      newPassword.length >= 6 && styles.criteriaMet
                    ]}>• At least 6 characters</Text>
                    <Text style={[
                      styles.criteriaItem,
                      /[A-Z]/.test(newPassword) && styles.criteriaMet
                    ]}>• One uppercase letter</Text>
                    <Text style={[
                      styles.criteriaItem,
                      /[0-9]/.test(newPassword) && styles.criteriaMet
                    ]}>• One number</Text>
                    <Text style={[
                      styles.criteriaItem,
                      newPassword === confirmPassword && confirmPassword !== '' && styles.criteriaMet
                    ]}>• Passwords match</Text>
                  </View>
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <MaterialIcons
                        name={showConfirmPassword ? "visibility-off" : "visibility"}
                        size={24}
                        color={colors.text.secondary}
                      />
                    </TouchableOpacity>
                  </View>
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
          </Animated.View>
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
    minHeight: 450, // Ensure consistent minimum height
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
    letterSpacing: 10,
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
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  eyeIcon: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  passwordCriteria: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  criteriaText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  criteriaItem: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  criteriaMet: {
    color: colors.success,
  },
}); 