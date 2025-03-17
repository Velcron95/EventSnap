import { supabase } from '../lib/supabase';

/**
 * Auth utility functions for the application
 * Add any authentication-related functions here
 */

// Example function for future use
export async function checkUserExists(email: string) {
  try {
    const { data, error } = await supabase
      .from('user')
      .select('id')
      .eq('email', email)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking if user exists:', error);
      return { exists: false, error: 'Failed to check user' };
    }
    
    return { exists: !!data, error: null };
  } catch (error) {
    console.error('Unexpected error in checkUserExists:', error);
    return { exists: false, error: 'An unexpected error occurred' };
  }
} 