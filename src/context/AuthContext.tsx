import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  permissionsGranted: boolean | null;
  signUp: (email: string, password: string, displayName: string, privacyPolicyAccepted: boolean, termsAccepted: boolean) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setPermissionsGranted: (granted: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionsGranted, setPermissionsGrantedState] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSessionAndPermissions = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        setSession(currentSession);

        // Check permissions status
        if (currentSession) {
          const storedPermissions = await AsyncStorage.getItem('permissionsGranted');
          setPermissionsGrantedState(storedPermissions === 'true');
        }
      } catch (error) {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    };

    checkSessionAndPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (!session) {
        // Clear permissions when signing out
        await AsyncStorage.removeItem('permissionsGranted');
        setPermissionsGrantedState(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setPermissionsGranted = async (granted: boolean) => {
    await AsyncStorage.setItem('permissionsGranted', granted.toString());
    setPermissionsGrantedState(granted);
  };

  const createProfileIfNeeded = async (userId: string, displayName: string, privacyPolicyAccepted = false, termsAccepted = false) => {
    if (!userId) return;

    try {
      const { data: existingProfile } = await supabase
        .from('user')
        .select('id')
        .eq('id', userId)
        .single();

      if (!existingProfile) {
        const userEmail = session?.user?.email || '';
        const userDisplayName = displayName || session?.user?.user_metadata?.display_name || 'User';
        const currentTimestamp = new Date().toISOString();
        
        await supabase
          .from('user')
          .insert({
            id: userId,
            display_name: userDisplayName,
            email: userEmail,
            privacy_policy_accepted: privacyPolicyAccepted,
            terms_of_service_accepted: termsAccepted,
            acceptance_timestamp: privacyPolicyAccepted && termsAccepted ? currentTimestamp : null
          });
      }
    } catch (error) {
      // Handle error silently
    }
  };

  const signUp = async (email: string, password: string, displayName: string, privacyPolicyAccepted: boolean, termsAccepted: boolean) => {
    try {
      if (!privacyPolicyAccepted || !termsAccepted) {
        return { 
          error: new Error('You must accept both the Privacy Policy and Terms of Service to create an account.') 
        };
      }
      
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            privacy_policy_accepted: privacyPolicyAccepted,
            terms_of_service_accepted: termsAccepted,
          },
          emailRedirectTo: 'eventsnap://auth/callback',
        },
      });

      if (error) return { error };
      
      if (data?.user?.id) {
        await createProfileIfNeeded(data.user.id, displayName, privacyPolicyAccepted, termsAccepted);
      }
      
      return { 
        error: data?.user?.identities?.[0]?.identity_data?.email_confirmed_at ? 
          null : 
          new Error('Please check your email for a confirmation link before logging in.')
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

      if (!error) {
        // After successful sign-in, check if permissions exist
        const storedPermissions = await AsyncStorage.getItem('permissionsGranted');
        // If permissions haven't been granted before, set to false to trigger the permissions screen
        if (!storedPermissions) {
          await setPermissionsGranted(false);
        } else {
          setPermissionsGrantedState(storedPermissions === 'true');
        }
      }

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
      // Handle error silently
    }
  };

  return (
    <AuthContext.Provider value={{
      session,
      loading,
      permissionsGranted,
      signUp,
      signIn,
      signOut,
      setPermissionsGranted,
    }}>
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