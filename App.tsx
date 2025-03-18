import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
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
import { View, Image, Text, TouchableOpacity, BackHandler, Linking, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ParticipantsScreen } from './src/screens/ParticipantsScreen';
import { ProfileSettingsScreen } from './src/screens/ProfileSettingsScreen';
import { HeaderBar } from './src/components/HeaderBar';
import { GlobalAlert } from './src/components/GlobalAlert';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { supabase } from './src/lib/supabase';

const EventTab = createBottomTabNavigator<EventTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Event tab navigator - contains Camera, Gallery, and Participants screens for a specific event
const EventTabNavigator = ({ route, navigation }: any) => {
  const { eventName, eventId } = route.params;
  
  // Add a back handler to navigate to Events screen when back button is pressed
  React.useEffect(() => {
    // This handles the navigation back gesture and UI back button
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      // If we're navigating back, redirect to Events screen
      if (e.data.action.type === 'GO_BACK') {
        e.preventDefault();
        navigation.navigate('Events');
      }
    });

    // Add hardware back button handler for Android
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Navigate to Events screen
      navigation.navigate('Events');
      return true; // Prevent default behavior
    });

    return () => {
      unsubscribe();
      backHandler.remove();
    };
  }, [navigation]);
  
  return (
    <View style={{ flex: 1 }}>
      <HeaderBar title="" />
      <EventTab.Navigator
        screenOptions={{
          headerShown: false, // Hide the default header since we're using HeaderBar
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#E5E5EA',
            paddingVertical: 5,
          },
        }}
        // Disable swipe between tabs to prevent accidental navigation
        backBehavior="none"
        detachInactiveScreens={false} // Keep all screens mounted to maintain back handler
      >
        <EventTab.Screen
          name="Gallery"
          component={GalleryScreen}
          initialParams={{ eventId, eventName }}
          options={{
            tabBarLabel: "Gallery",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="photo-library" size={size} color={color} />
            ),
          }}
        />
        <EventTab.Screen
          name="Camera"
          component={CameraScreen}
          initialParams={{ eventId }}
          options={{
            tabBarLabel: "Camera",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="camera-alt" size={size} color={color} />
            ),
          }}
        />
        <EventTab.Screen
          name="Participants"
          component={ParticipantsScreen}
          initialParams={{ eventId, eventName }}
          options={{
            tabBarLabel: "Participants",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="people" size={size} color={color} />
            ),
          }}
        />
      </EventTab.Navigator>
    </View>
  );
};

const App = () => {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  
  return (
    <SafeAreaProvider>
      <StatusBar hidden={true} />
      <AuthProvider>
        <EventProvider>
          <NavigationContainer ref={navigationRef}>
            <NavigationContent navigationRef={navigationRef} />
          </NavigationContainer>
          <GlobalAlert />
        </EventProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

const NavigationContent = ({ navigationRef }: { navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList>> }) => {
  const { session, loading } = useAuth();
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [forceRender, setForceRender] = useState(false);

  // Add a timeout to force render if loading takes too long
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        setForceRender(true);
      }
    }, 8000); // 8 second timeout

    return () => clearTimeout(timeoutId);
  }, [loading]);

  // Handle deep links
  useEffect(() => {
    // Function to handle URL
    const handleDeepLink = async (url: string) => {
      // Handle authentication links (email verification, password reset)
      if (url.includes('auth/callback') || url.includes('auth/reset-callback')) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: url.split('access_token=')[1]?.split('&')[0] || '',
            refresh_token: url.split('refresh_token=')[1]?.split('&')[0] || '',
          });
          
          if (error) {
            return;
          }
          
          if (data.session) {
            // Session will be handled by onAuthStateChange
          }
          
          // If this is a password reset link, navigate to reset password screen
          if (url.includes('auth/reset-callback') && navigationRef.current) {
            navigationRef.current.navigate('ForgotPassword', { step: 'reset' } as never);
          }
        } catch (error) {
        }
      }
    };

    // Add event listener for deep links when the app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Handle the case where the app is opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [navigationRef]);

  if (loading && !forceRender) {
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
          <Stack.Screen 
            name="Events" 
            component={EventsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="EventTabs" 
            component={EventTabNavigator}
            options={({ route }: any) => ({
              headerShown: false,
              title: route.params.eventName,
              headerTintColor: '#007AFF',
              headerBackTitle: 'Events',
            })}
          />
          <Stack.Screen 
            name="EventConnection" 
            component={EventConnectionScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="CreateEvent" 
            component={CreateEventScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="ProfileSettings" 
            component={ProfileSettingsScreen}
            options={{
              headerShown: false,
            }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default App; 