import React, { createContext, useContext, useState, useEffect } from 'react';
import { Event } from '../types/database';
import { supabase } from '../lib/supabase';

type EventContextType = {
  currentEvent: Event | null;
  setCurrentEvent: (event: Event | null) => void;
  isCreator: boolean;
  refreshEvent: () => Promise<void>;
};

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    const checkIfCreator = async () => {
      if (!currentEvent) {
        setIsCreator(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsCreator(false);
          return;
        }

        setIsCreator(currentEvent.created_by === user.id);
      } catch (error) {
        console.error('Error checking if user is creator:', error);
        setIsCreator(false);
      }
    };

    checkIfCreator();
  }, [currentEvent]);

  const refreshEvent = async () => {
    if (!currentEvent) return;

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, participant_count:event_participants(count)')
        .eq('id', currentEvent.id)
        .single();

      if (error) {
        console.error('Error refreshing event:', error);
        return;
      }

      if (data) {
        setCurrentEvent({
          ...data,
          participant_count: data.participant_count?.[0]?.count || 0
        });
      }
    } catch (error) {
      console.error('Error refreshing event:', error);
    }
  };

  return (
    <EventContext.Provider value={{ 
      currentEvent, 
      setCurrentEvent, 
      isCreator,
      refreshEvent
    }}>
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = () => {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}; 