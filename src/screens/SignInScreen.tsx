import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export const SignInScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(email, password, rememberMe);
      
      if (error) {
        console.error('Sign in error:', error);
        
        // Provide more helpful error messages
        if (error.message.includes('Invalid login credentials')) {
          Alert.alert(
            'Login Failed', 
            'Invalid email or password. Please check your credentials and try again.'
          );
        } else if (error.message.includes('Email not confirmed') || error.message.includes('not confirmed')) {
          Alert.alert(
            'Email Not Verified', 
            'Please check your email for a verification link and click it before logging in. If you did not receive an email, you can request a new verification email.',
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Resend Verification',
                onPress: () => handleResendVerification()
              }
            ]
          );
        } else {
          Alert.alert('Error', error.message);
        }
      }
    } catch (error) {
      console.error('Unexpected error during sign in:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
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
        Alert.alert('Error', error.message);
      } else {
        Alert.alert(
          'Verification Email Sent',
          'Please check your email for a new verification link. Be sure to check your spam folder if you don\'t see it in your inbox.'
        );
      }
    } catch (error) {
      setLoading(false);
      console.error('Error sending verification email:', error);
      Alert.alert('Error', 'Failed to send verification email');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'eventsnap://auth/reset-password',
      });

      setLoading(false);
      
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert(
          'Password Reset Email Sent',
          'Please check your email for instructions to reset your password.'
        );
      }
    } catch (error) {
      setLoading(false);
      console.error('Error sending reset password email:', error);
      Alert.alert('Error', 'Failed to send password reset email');
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

      <View style={styles.linksContainer}>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.linkText}>
            Don't have an account? Sign Up
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={handleForgotPassword}
        >
          <Text style={styles.linkText}>
            Forgot Password?
          </Text>
        </TouchableOpacity>
      </View>
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
}); 