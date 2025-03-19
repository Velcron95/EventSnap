import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Alert } from 'react-native';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string, privacyPolicyAccepted: boolean, termsAccepted: boolean) => Promise<{ error: Error | null }>;
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
        // Add a timeout to ensure we don't get stuck on the loading screen
        const timeoutId = setTimeout(() => {
          setLoading(false);
        }, 5000); // 5 second timeout

        const rememberMe = await AsyncStorage.getItem('rememberMe');
        
        // If rememberMe is not set, sign out
        if (rememberMe !== 'true') {
          await supabase.auth.signOut();
        }
        
        // Check current session
        const { data } = await supabase.auth.getSession();
        
        // If we have a session, ensure profile exists
        if (data.session?.user) {
          await createProfileIfNeeded(
            data.session.user.id, 
            data.session.user.user_metadata?.display_name || '',
            data.session.user.user_metadata?.privacy_policy_accepted === true,
            data.session.user.user_metadata?.terms_of_service_accepted === true
          );
        }
        
        setSession(data.session);
        setLoading(false);
        clearTimeout(timeoutId); // Clear the timeout if everything completes successfully
      } catch (error) {
        setLoading(false);
      }
    };
    
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      
      // Create profile on sign in or token refresh
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        await createProfileIfNeeded(
          session.user.id, 
          session.user.user_metadata?.display_name || '',
          session.user.user_metadata?.privacy_policy_accepted === true,
          session.user.user_metadata?.terms_of_service_accepted === true
        );
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const createProfileIfNeeded = async (userId: string, displayName: string, privacyPolicyAccepted = false, termsAccepted = false) => {
    try {
      if (!userId) {
        return;
      }
      
      // Check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('user')
        .select('id, display_name, email, privacy_policy_accepted, terms_of_service_accepted')
        .eq('id', userId)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          // Continue anyway to try creating the profile
        }
      }

      // If no profile exists, create one
      if (!existingProfile) {
        const userEmail = session?.user?.email || '';
        const userDisplayName = displayName || session?.user?.user_metadata?.display_name || 'User';
        const currentTimestamp = new Date().toISOString();
        
        // First try to insert with returning
        const { data: newProfile, error: insertError } = await supabase
          .from('user')
          .insert({
            id: userId,
            display_name: userDisplayName,
            email: userEmail,
            privacy_policy_accepted: privacyPolicyAccepted,
            terms_of_service_accepted: termsAccepted,
            acceptance_timestamp: privacyPolicyAccepted && termsAccepted ? currentTimestamp : null
          })
          .select()
          .single();

        if (insertError) {
          // Try again without select in case that's causing issues
          const { error: simpleInsertError } = await supabase
            .from('user')
            .insert({
              id: userId,
              display_name: userDisplayName,
              email: userEmail,
              privacy_policy_accepted: privacyPolicyAccepted,
              terms_of_service_accepted: termsAccepted,
              acceptance_timestamp: privacyPolicyAccepted && termsAccepted ? currentTimestamp : null
            });
            
          if (simpleInsertError) {
            console.error('Profile Creation Error:', simpleInsertError.message);
          }
        }
      } else {
        // Update terms and privacy policy acceptance if needed
        if ((privacyPolicyAccepted && !existingProfile.privacy_policy_accepted) || 
            (termsAccepted && !existingProfile.terms_of_service_accepted)) {
          
          const updates = {
            privacy_policy_accepted: privacyPolicyAccepted || existingProfile.privacy_policy_accepted,
            terms_of_service_accepted: termsAccepted || existingProfile.terms_of_service_accepted,
          };
          
          // Add timestamp if both are now accepted
          if (updates.privacy_policy_accepted && updates.terms_of_service_accepted) {
            const currentTimestamp = new Date().toISOString();
            Object.assign(updates, { acceptance_timestamp: currentTimestamp });
          }
          
          const { error: updateError } = await supabase
            .from('user')
            .update(updates)
            .eq('id', userId);
        }
      }
    } catch (error) {
    }
  };

  const signUp = async (email: string, password: string, displayName: string, privacyPolicyAccepted: boolean, termsAccepted: boolean) => {
    try {
      // Verify that terms and privacy policy are accepted
      if (!privacyPolicyAccepted || !termsAccepted) {
        return { 
          error: new Error('You must accept both the Privacy Policy and Terms of Service to create an account.') 
        };
      }
      
      // Sign up with email confirmation
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            privacy_policy_accepted: privacyPolicyAccepted,
            terms_of_service_accepted: termsAccepted,
          },
          // Enable email confirmation
          emailRedirectTo: 'eventsnap://auth/callback',
        },
      });

      if (error) {
        return { error };
      } 
      
      // Store the acceptance data in the user profile
      if (data?.user?.id) {
        await createProfileIfNeeded(data.user.id, displayName, privacyPolicyAccepted, termsAccepted);
      }
      
      // Don't auto sign-in or create profile - wait for email confirmation
      return { 
        error: data?.user?.identities?.[0]?.identity_data?.email_confirmed_at ? 
          null : 
          new Error('Please check your email for a confirmation link before logging in. If you do not receive an email, you may need to check your spam folder.')
      };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string, rememberMe: boolean) => {
    try {
      if (rememberMe) {
        await AsyncStorage.setItem('rememberMe', 'true');
      } else {
        await AsyncStorage.removeItem('rememberMe');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('rememberMe');
      await supabase.auth.signOut();
    } catch (error) {
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