import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { Linking } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CustomAlert } from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [privacyPolicyAccepted, setPrivacyPolicyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signUp } = useAuth();
  const { alertProps, showAlert } = useCustomAlert();

  // Password requirements
  const passwordRequirements = {
    minLength: 6,
    hasUpperCase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    passwordsMatch: password === confirmPassword && password !== '',
  };

  const checkEmailExists = async (email: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: 'dummy-password-for-check'
    });

    // If we get a specific error about invalid credentials, the email exists
    return error?.message.includes('Invalid login credentials');
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword || !displayName) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Please fill in all fields'
      });
      return;
    }

    if (password !== confirmPassword) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Passwords do not match'
      });
      return;
    }

    if (!privacyPolicyAccepted || !termsAccepted) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'You must accept the Privacy Policy and Terms of Service to create an account'
      });
      return;
    }

    setLoading(true);
    
    try {
      // First check if email exists
      const emailExists = await checkEmailExists(email);
      
      if (emailExists) {
        showAlert({
          type: 'error',
          title: 'Email Already in Use',
          message: 'This email address is already registered. Please try signing in or use a different email address.',
          confirmText: 'Sign In',
          onConfirm: () => {
            navigation.navigate('SignIn');
          },
          cancelText: 'Try Again',
          onCancel: () => {
            setEmail('');
            setPassword('');
            setConfirmPassword('');
          }
        });
        setLoading(false);
        return;
      }

      // If email doesn't exist, proceed with signup
      const { error: signUpError } = await signUp(
        email, 
        password, 
        displayName, 
        privacyPolicyAccepted, 
        termsAccepted
      );
      
      if (signUpError) {
        console.log('Sign up error message:', signUpError.message);
        
        if (signUpError.message.includes('profile') && signUpError.message.includes('error')) {
          console.log('Profile creation error:', signUpError.message);
        }
        else if (signUpError.message.includes('check your email for a confirmation link')) {
          showAlert({
            type: 'success',
            title: 'Email Verification Required',
            message: 'Your account has been created! Please check your email for a verification link. If you do not receive an email within a few minutes, check your spam folder or try a different email address.',
            confirmText: 'OK',
            onConfirm: () => {
              navigation.navigate('SignIn');
            },
            cancelText: 'I didn\'t get the email',
            onCancel: () => {
              showAlert({
                type: 'info',
                title: 'Email Troubleshooting',
                message: 'If you didn\'t receive the email:\n\n1. Check your spam folder\n2. Try a different email address\n3. Contact support at codenova.studios@gmail.com'
              });
            }
          });
        } else {
          console.log('Sign up error:', signUpError.message);
        }
      } else {
        showAlert({
          type: 'success',
          title: 'Account Created',
          message: 'Your account has been created successfully. You can now sign in.',
          onConfirm: () => {
            navigation.navigate('SignIn');
          }
        });
      }
    } catch (error) {
      console.error('Unexpected error during sign up:', error);
    } finally {
      setLoading(false);
    }
  };

  const openUrl = async (url: string, errorMsg = 'Could not open URL') => {
    try {
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert({
          type: 'error',
          title: 'Error',
          message: `This device cannot open the URL: ${url}`
        });
      }
    } catch (err) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: errorMsg
      });
    }
  };

  const openPrivacyPolicy = () => {
    openUrl('https://codenova-eventsnap.vercel.app/privacy', 'Could not open Privacy Policy');
  };

  const openTermsOfService = () => {
    openUrl('https://codenova-eventsnap.vercel.app/terms', 'Could not open Terms of Service');
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Create Account</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Display Name"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity 
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <MaterialIcons 
              name={showPassword ? "visibility" : "visibility-off"} 
              size={24} 
              color="#666"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity 
            style={styles.eyeIcon}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <MaterialIcons 
              name={showConfirmPassword ? "visibility" : "visibility-off"} 
              size={24} 
              color="#666"
            />
          </TouchableOpacity>
        </View>

        {/* Password Requirements */}
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Password Requirements:</Text>
          <View style={styles.requirementItem}>
            <MaterialIcons 
              name={password.length >= passwordRequirements.minLength ? "check-circle" : "radio-button-unchecked"} 
              size={16} 
              color={password.length >= passwordRequirements.minLength ? "#4CAF50" : "#666"} 
            />
            <Text style={styles.requirementText}>At least 6 characters</Text>
          </View>
          <View style={styles.requirementItem}>
            <MaterialIcons 
              name={passwordRequirements.hasUpperCase ? "check-circle" : "radio-button-unchecked"} 
              size={16} 
              color={passwordRequirements.hasUpperCase ? "#4CAF50" : "#666"} 
            />
            <Text style={styles.requirementText}>One uppercase letter</Text>
          </View>
          <View style={styles.requirementItem}>
            <MaterialIcons 
              name={passwordRequirements.hasNumber ? "check-circle" : "radio-button-unchecked"} 
              size={16} 
              color={passwordRequirements.hasNumber ? "#4CAF50" : "#666"} 
            />
            <Text style={styles.requirementText}>One number</Text>
          </View>
          <View style={styles.requirementItem}>
            <MaterialIcons 
              name={passwordRequirements.passwordsMatch ? "check-circle" : "radio-button-unchecked"} 
              size={16} 
              color={passwordRequirements.passwordsMatch ? "#4CAF50" : "#666"} 
            />
            <Text style={styles.requirementText}>Passwords match</Text>
          </View>
        </View>

        <View style={styles.checkboxContainer}>
          <TouchableOpacity 
            style={styles.checkbox}
            onPress={() => setPrivacyPolicyAccepted(!privacyPolicyAccepted)}
          >
            <View style={[
              styles.checkboxBox, 
              privacyPolicyAccepted && styles.checkboxChecked
            ]}>
              {privacyPolicyAccepted && (
                <MaterialIcons name="check" size={16} color="#fff" />
              )}
            </View>
            <View style={styles.checkboxTextContainer}>
              <Text style={styles.checkboxText}>
                I have read and accept the{' '}
                <Text style={styles.link} onPress={openPrivacyPolicy}>
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.checkboxContainer}>
          <TouchableOpacity 
            style={styles.checkbox}
            onPress={() => setTermsAccepted(!termsAccepted)}
          >
            <View style={[
              styles.checkboxBox, 
              termsAccepted && styles.checkboxChecked
            ]}>
              {termsAccepted && (
                <MaterialIcons name="check" size={16} color="#fff" />
              )}
            </View>
            <View style={styles.checkboxTextContainer}>
              <Text style={styles.checkboxText}>
                I have read and accept the{' '}
                <Text style={styles.link} onPress={openTermsOfService}>
                  Terms of Service
                </Text>
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.button, 
            (!email || !password || !confirmPassword || !displayName || !privacyPolicyAccepted || !termsAccepted) && 
            styles.buttonDisabled
          ]}
          onPress={handleSignUp}
          disabled={loading || !email || !password || !confirmPassword || !displayName || !privacyPolicyAccepted || !termsAccepted}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('SignIn')}
        >
          <Text style={styles.linkText}>
            Already have an account? Sign In
          </Text>
        </TouchableOpacity>

        <CustomAlert {...alertProps} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  checkboxContainer: {
    marginBottom: 15,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#444',
  },
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  requirementsContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
  },
}); 