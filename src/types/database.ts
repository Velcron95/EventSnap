export type User = {
  id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  email: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  name: string;
  password: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  background_image?: string;
  participant_count?: number;
};

export type EventParticipant = {
  id: string;
  event_id: string;
  user_id: string;
  joined_at: string;
};

export type Media = {
  id: string;
  event_id: string;
  user_id: string;
  url: string;
  type: 'photo' | 'video';
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      user: {
        Row: User;
        Insert: Omit<User, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;
      };
      events: {
        Row: Event;
        Insert: Omit<Event, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Event, 'id' | 'created_at' | 'updated_at'>>;
      };
      event_participants: {
        Row: EventParticipant;
        Insert: Omit<EventParticipant, 'id' | 'joined_at'>;
        Update: Partial<Omit<EventParticipant, 'id' | 'joined_at'>>;
      };
      media: {
        Row: Media;
        Insert: Omit<Media, 'id' | 'created_at'>;
        Update: Partial<Omit<Media, 'id' | 'created_at'>>;
      };
    };
  };
}; 