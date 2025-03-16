console.log('App.tsx loaded - TEST LOG');

import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EventsScreen } from './src/screens/EventsScreen';
import { CameraScreen } from './src/screens/CameraScreen';
import { GalleryScreen } from './src/screens/GalleryScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { PermissionsScreen } from './src/screens/PermissionsScreen';
import { EventConnectionScreen } from './src/screens/EventConnectionScreen';
import { CreateEventScreen } from './src/screens/CreateEventScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { EventProvider } from './src/context/EventContext';
import { TabParamList, RootStackParamList, EventTabParamList } from './types';
import { ActivityIndicator, View, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ParticipantsScreen } from './src/screens/ParticipantsScreen';

const MainTab = createBottomTabNavigator<TabParamList>();
const EventTab = createBottomTabNavigator<EventTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Main tab navigator - only contains Events screen
const MainTabNavigator = () => {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E5E5EA',
          paddingVertical: 5,
        },
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTitleStyle: {
          color: '#000',
          fontSize: 17,
          fontWeight: '600',
        },
      }}
    >
      <MainTab.Screen
        name="Events"
        component={EventsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="event" size={size} color={color} />
          ),
        }}
      />
    </MainTab.Navigator>
  );
};

// Event tab navigator - contains Camera, Gallery, and Participants screens for a specific event
const EventTabNavigator = ({ route }: any) => {
  const { eventName, eventId } = route.params;
  console.log('EventTabNavigator params:', { eventName, eventId });
  
  return (
    <EventTab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E5E5EA',
          paddingVertical: 5,
        },
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTitleStyle: {
          color: '#000',
          fontSize: 17,
          fontWeight: '600',
        },
      }}
    >
      <EventTab.Screen
        name="Camera"
        component={CameraScreen}
        initialParams={{ eventId }}
        options={{
          title: `${eventName} - Camera`,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="camera-alt" size={size} color={color} />
          ),
        }}
      />
      <EventTab.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{
          title: `${eventName} - Gallery`,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="photo-library" size={size} color={color} />
          ),
        }}
      />
      <EventTab.Screen
        name="Participants"
        component={ParticipantsScreen}
        options={{
          title: `${eventName} - Participants`,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="people" size={size} color={color} />
          ),
        }}
      />
    </EventTab.Navigator>
  );
};

const NavigationContent = () => {
  const { session, loading } = useAuth();
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Image 
          source={require('./assets/Loading.png')} 
          style={{ width: 200, height: 200, resizeMode: 'contain' }}
        />
      </View>
    );
  }

  if (session && !permissionsGranted) {
    return (
      <PermissionsScreen
        onPermissionsGranted={() => setPermissionsGranted(true)}
      />
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen 
            name="EventTabs" 
            component={EventTabNavigator}
            options={({ route }: any) => ({
              headerShown: true,
              title: route.params.eventName,
              headerTintColor: '#007AFF',
              headerBackTitle: 'Events',
            })}
          />
          <Stack.Screen 
            name="EventConnection" 
            component={EventConnectionScreen}
            options={{
              headerShown: true,
              title: 'Connect to Event',
              headerTintColor: '#007AFF',
              headerStyle: {
                backgroundColor: '#fff',
              },
              headerTitleStyle: {
                color: '#000',
                fontSize: 17,
                fontWeight: '600',
              },
            }}
          />
          <Stack.Screen 
            name="CreateEvent" 
            component={CreateEventScreen}
            options={{
              headerShown: true,
              title: 'Create Event',
              headerTintColor: '#007AFF',
              headerStyle: {
                backgroundColor: '#fff',
              },
              headerTitleStyle: {
                color: '#000',
                fontSize: 17,
                fontWeight: '600',
              },
            }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <EventProvider>
          <NavigationContainer>
            <NavigationContent />
          </NavigationContainer>
        </EventProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App; 