import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

interface FallbackImageProps {
  url: string;
  style: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  fixUrl?: (url: string) => string;
}

export const FallbackImage: React.FC<FallbackImageProps> = ({ 
  url, 
  style, 
  resizeMode = 'contain',
  fixUrl = (url) => url, // Default pass-through function if not provided
}) => {
  const [fallbackLevel, setFallbackLevel] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Generate different URL formats to try
  const getUrlForLevel = (level: number): string => {
    // Try our custom fix function first if provided
    const fixedUrl = fixUrl(url);
    
    switch(level) {
      case 0: // Fixed URL
        return fixedUrl;
      case 1: // Original URL
        return url;
      case 2: // URL with special characters encoded
        return encodeURI(url);
      case 3: // Try removing query parameters if any
        try {
          const urlObj = new URL(url);
          return urlObj.origin + urlObj.pathname;
        } catch (e) {
          return url;
        }
      default:
        // As a last resort, show a placeholder
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }
  };
  
  const currentUrl = getUrlForLevel(fallbackLevel);
  
  // If we've tried all fallback levels, show an error message
  if (fallbackLevel >= 4) {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: 'white', textAlign: 'center', padding: 20 }}>
          Unable to load image{'\n'}
          (Tap to retry)
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: 'rgba(0, 122, 255, 0.8)',
            padding: 10,
            borderRadius: 4,
            marginTop: 10
          }}
          onPress={() => setFallbackLevel(0)}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <>
      {loading && (
        <ActivityIndicator 
          size="large" 
          color="#fff" 
          style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20 }}
        />
      )}
      <Image
        source={{ uri: currentUrl }}
        style={style}
        resizeMode={resizeMode}
        onLoad={() => {
          console.log(`Image loaded successfully with URL level ${fallbackLevel}: ${currentUrl.substring(0, 100)}...`);
          setLoading(false);
        }}
        onError={(error) => {
          console.error(`Image load failed at level ${fallbackLevel}:`, error.nativeEvent);
          setFallbackLevel(prev => prev + 1);
          setLoading(true);
        }}
      />
    </>
  );
}; 