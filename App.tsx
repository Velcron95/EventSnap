import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EventsScreen } from './src/screens/EventsScreen';
import { CameraScreen } from './src/screens/CameraScreen';
import { GalleryScreen } from './src/screens/GalleryScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { EventConnectionScreen } from './src/screens/EventConnectionScreen';
import { CreateEventScreen } from './src/screens/CreateEventScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { EventProvider } from './src/context/EventContext';
import { TabParamList, RootStackParamList, EventTabParamList } from './types';
import { View, BackHandler, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ParticipantsScreen } from './src/screens/ParticipantsScreen';
import { ProfileSettingsScreen } from './src/screens/ProfileSettingsScreen';
import { HeaderBar } from './src/components/HeaderBar';
import { GlobalAlert } from './src/components/GlobalAlert';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import * as SplashScreen from 'expo-splash-screen';
import { PermissionsScreen } from './src/screens/PermissionsScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync();

const EventTab = createBottomTabNavigator<EventTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const EventTabNavigator = ({ route, navigation }: any) => {
  const { eventName, eventId } = route.params;
  
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (e.data.action.type === 'GO_BACK') {
        e.preventDefault();
        navigation.navigate('Events');
      }
    });

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('Events');
      return true;
    });

    return () => {
      unsubscribe();
      backHandler.remove();
    };
  }, [navigation]);

  return (
    <View style={{ flex: 1 }}>
      <EventTab.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: '#fff' },
          tabBarActiveTintColor: '#6A5ACD',
          tabBarInactiveTintColor: '#999',
          headerShown: false,
        }}
      >
        <EventTab.Screen 
          name="Camera" 
          component={CameraScreen}
          initialParams={{ eventId }} 
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="camera-alt" size={size} color={color} />
            ),
          }}
        />
        <EventTab.Screen 
          name="Gallery" 
          component={GalleryScreen} 
          initialParams={{ eventId, eventName }}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="photo-library" size={size} color={color} />
            ),
          }}
        />
        <EventTab.Screen 
          name="Participants" 
          component={ParticipantsScreen} 
          initialParams={{ eventId, eventName }}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="people" size={size} color={color} />
            ),
          }}
        />
      </EventTab.Navigator>
    </View>
  );
};

const NavigationContent = () => {
  const { session, loading, permissionsGranted, setPermissionsGranted } = useAuth();

  if (loading) {
    return null;
  }

  // Show permissions screen for authenticated users without explicit permission granted
  if (session && permissionsGranted !== true) {
    return <PermissionsScreen onPermissionsGranted={() => setPermissionsGranted(true)} />;
  }

  return (
    <Stack.Navigator>
      {session && permissionsGranted === true ? (
        // Authenticated and permissions explicitly granted
        <>
          <Stack.Screen 
            name="Events" 
            component={EventsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="EventTabs" 
            component={EventTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="CreateEvent" 
            component={CreateEventScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="EventConnection" 
            component={EventConnectionScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ProfileSettings" 
            component={ProfileSettingsScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        // Non-authenticated stack
        <>
          <Stack.Screen 
            name="SignIn" 
            component={SignInScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="SignUp" 
            component={SignUpScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ForgotPassword" 
            component={ForgotPasswordScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const App = () => {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        // Handle error
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AuthProvider>
        <EventProvider>
          <NavigationContainer>
            <NavigationContent />
            <GlobalAlert />
          </NavigationContainer>
        </EventProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App; 