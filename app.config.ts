import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'EventSnap',
  slug: 'eventsnap',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/EventSnapLogo.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/Loading.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.eventsnap.app',
    newArchEnabled: true,
    infoPlist: {
      NSCameraUsageDescription: 'EventSnap needs access to your camera to take photos and videos for event sharing.',
      NSMicrophoneUsageDescription: 'EventSnap needs access to your microphone to record videos with sound for event sharing.'
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/EventSnapLogo.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.eventsnap.app',
    versionCode: 1,
    newArchEnabled: true,
    permissions: [
      'CAMERA', 
      'RECORD_AUDIO', 
      'READ_EXTERNAL_STORAGE', 
      'WRITE_EXTERNAL_STORAGE'
    ],
    softwareKeyboardLayoutMode: 'resize',
    allowBackup: true,
    blockedPermissions: [],
  },
  web: {
    favicon: './assets/favicon.png'
  },
  plugins: [
    [
      'expo-camera',
      {
        cameraPermission: 'EventSnap needs access to your camera to take photos and videos for event sharing.',
        microphonePermission: 'EventSnap needs access to your microphone to record videos with sound for event sharing.'
      }
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'EventSnap needs access to your photos to share images and videos in events.'
      }
    ],
    'expo-media-library'
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: "91f7c26c-4dd0-48e1-8472-81793f1fc78d"
    }
  },
  scheme: 'eventsnap',
  owner: "velcron", // Your Expo account username
};

export default config; 