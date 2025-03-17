import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'EventSnap',
  slug: 'eventsnap',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
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
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.eventsnap.app',
    newArchEnabled: true,
    permissions: ['CAMERA', 'RECORD_AUDIO']
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
    ]
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default config; 