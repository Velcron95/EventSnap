import React, { createContext, useContext } from 'react';

// Only light colors
export const lightColors = {
  primary: '#6A5ACD', // Festive purple
  secondary: '#FF69B4', // Hot pink for festive accents
  success: '#00CED1', // Bright turquoise
  danger: '#FF4500', // Bright orange-red
  warning: '#FFD700', // Gold
  background: '#FFFFFF',
  card: '#FFFFFF',
  surface: '#F0F8FF', // Light blue background
  text: {
    primary: '#333333',
    secondary: '#6C6C6C',
    tertiary: '#8E8E93',
    inverse: '#FFFFFF',
  },
  border: '#E5E5EA',
  input: {
    background: '#F2F2F7',
    border: '#E5E5EA',
    placeholder: '#8E8E93',
  }
};

interface ThemeContextType {
  colors: typeof lightColors;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: lightColors,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always use light colors
  const colors = lightColors;
  
  return (
    <ThemeContext.Provider value={{ colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext); 