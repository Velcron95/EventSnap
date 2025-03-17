import { supabase } from './supabase';

/**
 * Updates a user's display name across all relevant tables in the database
 * @param userId The user ID to update
 * @param displayName The new display name
 * @returns A promise that resolves when all updates are complete
 */
export const updateUserDisplayNameEverywhere = async (userId: string, displayName: string): Promise<void> => {
  try {
    console.log(`Updating display name for user ${userId} to "${displayName}" in all tables`);
    
    // Update in user table
    const { error: userError } = await supabase
      .from('user')
      .update({ display_name: displayName })
      .eq('id', userId);
      
    if (userError) {
      console.error('Error updating user table:', userError);
    }
    
    // Update in event_participants table
    const { error: participantsError } = await supabase
      .from('event_participants')
      .update({ display_name: displayName })
      .eq('user_id', userId);
      
    if (participantsError) {
      console.error('Error updating event_participants table:', participantsError);
    }
    
    // Update in events table
    const { error: eventsError } = await supabase
      .from('events')
      .update({ creator_display_name: displayName })
      .eq('created_by', userId);
      
    if (eventsError) {
      console.error('Error updating events table:', eventsError);
    }
    
    // Update user metadata
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { display_name: displayName }
    });
    
    if (metadataError) {
      console.error('Error updating user metadata:', metadataError);
    }
    
    console.log('Display name update completed');
  } catch (error) {
    console.error('Error in updateUserDisplayNameEverywhere:', error);
    throw error;
  }
};

/**
 * Refreshes the current user's display name in all tables
 * @returns A promise that resolves when the refresh is complete
 */
export const refreshCurrentUserDisplayName = async (): Promise<void> => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No user logged in');
      return;
    }
    
    // Get current display name from user table
    const { data: userData, error: userError } = await supabase
      .from('user')
      .select('display_name')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      console.error('Error fetching user data:', userError);
      return;
    }
    
    if (!userData?.display_name) {
      console.error('No display name found for user');
      return;
    }
    
    // Update display name everywhere
    await updateUserDisplayNameEverywhere(user.id, userData.display_name);
    
  } catch (error) {
    console.error('Error in refreshCurrentUserDisplayName:', error);
    throw error;
  }
}; 