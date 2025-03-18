import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { supabase } from '../lib/supabase';
import { CustomAlert } from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export const SignInScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { alertProps, showAlert } = useCustomAlert();

  const openUrl = async (url: string, errorMsg = 'Could not open URL') => {
    try {
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
            Alert.alert('URL Copied', url);
          }
        }
      ]);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Please fill in all fields'
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(email, password, rememberMe);
      
      if (error) {
        console.error('Sign in error:', error);
        
        // Provide more helpful error messages
        if (error.message.includes('Invalid login credentials')) {
          showAlert({
            type: 'error',
            title: 'Login Failed',
            message: 'Invalid email or password. Please check your credentials and try again.'
          });
        } else if (error.message.includes('Email not confirmed') || error.message.includes('not confirmed')) {
          showAlert({
            type: 'warning',
            title: 'Email Not Verified',
            message: 'Please check your email for a verification link and click it before logging in. If you did not receive an email, you can request a new verification email.',
            confirmText: 'Resend Verification',
            cancelText: 'Cancel',
            onConfirm: handleResendVerification
          });
        } else {
          showAlert({
            type: 'error',
            title: 'Error',
            message: error.message
          });
        }
      }
    } catch (error) {
      console.error('Unexpected error during sign in:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Please enter your email address'
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: 'eventsnap://auth/callback',
        }
      });

      setLoading(false);
      
      if (error) {
        showAlert({
          type: 'error',
          title: 'Error',
          message: error.message
        });
      } else {
        showAlert({
          type: 'success',
          title: 'Verification Email Sent',
          message: 'Please check your email for a new verification link. Be sure to check your spam folder if you don\'t see it in your inbox.'
        });
      }
    } catch (error) {
      setLoading(false);
      console.error('Error sending verification email:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to send verification email'
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      
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
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <View style={styles.rememberMeContainer}>
        <Text>Keep me logged in</Text>
        <Switch
          value={rememberMe}
          onValueChange={setRememberMe}
        />
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleSignIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.forgotPasswordButton}
        onPress={() => {
          console.log('Navigation to ForgotPassword screen triggered');
          navigation.navigate('ForgotPassword', { email } as never);
        }}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>

      <View style={styles.linksContainer}>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.linkText}>
            Don't have an account? Sign Up
          </Text>
        </TouchableOpacity>
        
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By using this app, you agree to our{' '}
          </Text>
          <TouchableOpacity 
            onPress={() => openUrl('https://codenova-eventsnap.vercel.app/terms', 'Could not open Terms of Service')}
          >
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={styles.termsText}> and </Text>
          <TouchableOpacity 
            onPress={() => openUrl('https://codenova-eventsnap.vercel.app/privacy', 'Could not open Privacy Policy')}
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CustomAlert component */}
      <CustomAlert {...alertProps} />
    </View>
  );
};

const styles = StyleSheet.create({
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
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linksContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkButton: {
    marginTop: 10,
    marginBottom: 10,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 16,
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginVertical: 10,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 16,
  },
  termsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  termsText: {
    fontSize: 14,
    color: '#666',
  },
}); 