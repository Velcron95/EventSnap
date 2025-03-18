import { NavigatorScreenParams } from '@react-navigation/native';

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
}

export interface EventParticipant {
  eventId: string;
  userId: string;
  status: 'going' | 'maybe' | 'not_going';
}

// Tab navigator inside an event
export type EventTabParamList = {
  Camera: { eventId?: string };
  Gallery: { eventId?: string; eventName?: string };
  Participants: { eventId?: string; eventName?: string };
};

// Main tab navigator
export type TabParamList = {
  Events: undefined;
};

// Root stack navigator
export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList>;
  Events: undefined;
  EventTabs: NavigatorScreenParams<EventTabParamList> & { eventId: string; eventName: string };
  SignIn: undefined;
  SignUp: undefined;
  EventConnection: undefined;
  CreateEvent: undefined;
  ProfileSettings: undefined;
  ForgotPassword: { step?: string; email?: string; comingFromProfile?: boolean };
}; 