import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Alert } from 'react-native';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session and rememberMe flag
    const checkSession = async () => {
      try {
        const rememberMe = await AsyncStorage.getItem('rememberMe');
        console.log('Remember me flag:', rememberMe);
        
        // If rememberMe is not set, sign out
        if (rememberMe !== 'true') {
          await supabase.auth.signOut();
          console.log('No remember me flag, signing out');
        }
        
        // Check current session
        const { data } = await supabase.auth.getSession();
        console.log('Session after check:', data.session?.user?.email || 'No session');
        
        // If we have a session, ensure profile exists
        if (data.session?.user) {
          await createProfileIfNeeded(
            data.session.user.id, 
            data.session.user.user_metadata?.display_name || ''
          );
        }
        
        setSession(data.session);
        setLoading(false);
      } catch (error) {
        console.error('Error checking session:', error);
        setLoading(false);
      }
    };
    
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      setSession(session);
      
      // Create profile on sign in or token refresh
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        await createProfileIfNeeded(
          session.user.id, 
          session.user.user_metadata?.display_name || ''
        );
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const createProfileIfNeeded = async (userId: string, displayName: string) => {
    try {
      console.log('Checking if profile exists for user:', userId);
      
      if (!userId) {
        console.error('Cannot create profile: userId is undefined or null');
        return;
      }
      
      // Check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('user')
        .select('id, display_name, email')
        .eq('id', userId)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          console.log('No profile found, will create one');
        } else {
          console.error('Error checking for existing profile:', checkError);
          // Continue anyway to try creating the profile
        }
      }

      // If no profile exists, create one
      if (!existingProfile) {
        const userEmail = session?.user?.email || '';
        const userDisplayName = displayName || session?.user?.user_metadata?.display_name || 'User';
        
        console.log('Creating new user profile:', {
          id: userId,
          display_name: userDisplayName,
          email: userEmail
        });
        
        // First try to insert with returning
        const { data: newProfile, error: insertError } = await supabase
          .from('user')
          .insert({
            id: userId,
            display_name: userDisplayName,
            email: userEmail,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating user profile with select:', insertError);
          
          // Try again without select in case that's causing issues
          const { error: simpleInsertError } = await supabase
            .from('user')
            .insert({
              id: userId,
              display_name: userDisplayName,
              email: userEmail,
            });
            
          if (simpleInsertError) {
            console.error('Error creating user profile (simple insert):', simpleInsertError);
            Alert.alert('Profile Creation Error', 'Could not create user profile. Please try signing out and back in.');
          } else {
            console.log('Successfully created user profile (simple insert)');
          }
        } else {
          console.log('Successfully created user profile:', newProfile);
        }
      } else {
        console.log('User profile already exists:', existingProfile);
      }
    } catch (error) {
      console.error('Unexpected error in createProfileIfNeeded:', error);
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      console.log('Signing up with email:', email);
      
      // Sign up with email confirmation
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
          // Enable email confirmation
          emailRedirectTo: 'eventsnap://auth/callback',
        },
      });

      if (error) {
        console.error('Sign up error:', error);
        return { error };
      } 
      
      console.log('Sign up successful, user:', data?.user?.id);
      console.log('Email confirmation status:', data?.user?.identities?.[0]?.identity_data?.email_confirmed_at ? 'confirmed' : 'pending');
      
      // Don't auto sign-in or create profile - wait for email confirmation
      return { 
        error: data?.user?.identities?.[0]?.identity_data?.email_confirmed_at ? 
          null : 
          new Error('Please check your email for a confirmation link before logging in. If you do not receive an email, you may need to check your spam folder.')
      };
    } catch (error) {
      console.error('Unexpected error in signUp:', error);
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string, rememberMe: boolean) => {
    try {
      console.log('Signing in with email:', email, 'Remember me:', rememberMe);
      if (rememberMe) {
        await AsyncStorage.setItem('rememberMe', 'true');
      } else {
        await AsyncStorage.removeItem('rememberMe');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
      } else {
        console.log('Sign in successful');
      }

      return { error };
    } catch (error) {
      console.error('Unexpected error in signIn:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out');
      await AsyncStorage.removeItem('rememberMe');
      await supabase.auth.signOut();
      console.log('Sign out successful');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 