import React, { createContext, useContext, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserContextType = {
  userName: string | null;
  setUserName: (name: string) => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userName, setUserNameState] = useState<string | null>(null);

  const setUserName = async (name: string) => {
    await AsyncStorage.setItem('userName', name);
    setUserNameState(name);
  };

  // Load saved username on mount
  React.useEffect(() => {
    AsyncStorage.getItem('userName').then((name) => {
      if (name) setUserNameState(name);
    });
  }, []);

  return (
    <UserContext.Provider value={{ userName, setUserName }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}; 