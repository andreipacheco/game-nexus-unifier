import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

interface GogContextType {
  gogUserId: string | null;
  setGogUserIdState: (userId: string | null) => void; // Renamed to avoid conflict with state variable
  connectGogUser: (userId: string) => void;
  disconnectGogUser: () => void;
  isLoadingGogUserId: boolean;
  gogUserError: string | null;
}

const GogContext = createContext<GogContextType | undefined>(undefined);

interface GogProviderProps {
  children: ReactNode;
}

export const GogProvider: React.FC<GogProviderProps> = ({ children }) => {
  const [gogUserId, setGogUserId] = useState<string | null>(null);
  const [isLoadingGogUserId, setIsLoadingGogUserId] = useState<boolean>(true);
  const [gogUserError, setGogUserError] = useState<string | null>(null); // Basic error state

  useEffect(() => {
    try {
      const storedUserId = localStorage.getItem('gogUserId');
      if (storedUserId) {
        setGogUserId(storedUserId);
      }
    } catch (error) {
      console.error("Failed to load GOG User ID from localStorage:", error);
      setGogUserError("Failed to load GOG User ID from storage.");
    } finally {
      setIsLoadingGogUserId(false);
    }
  }, []);

  const connectGogUser = (userId: string) => {
    if (!userId || userId.trim() === "") {
      setGogUserError("GOG User ID cannot be empty.");
      return;
    }
    try {
      localStorage.setItem('gogUserId', userId);
      setGogUserId(userId);
      setGogUserError(null); // Clear any previous errors
      console.log(`GOG User ID ${userId} connected and saved.`);
    } catch (error) {
      console.error("Failed to save GOG User ID to localStorage:", error);
      setGogUserError("Failed to save GOG User ID to storage.");
    }
  };

  const disconnectGogUser = () => {
    try {
      localStorage.removeItem('gogUserId');
      setGogUserId(null);
      setGogUserError(null); // Clear any previous errors
      console.log("GOG User ID disconnected and removed from storage.");
    } catch (error) {
      console.error("Failed to remove GOG User ID from localStorage:", error);
      setGogUserError("Failed to remove GOG User ID from storage.");
    }
  };

  // This function will be passed as setGogUserIdState in the context
  // to allow direct state manipulation if ever needed, though connect/disconnect are preferred.
  const setGogUserIdState = (userId: string | null) => {
    setGogUserId(userId);
  };

  return (
    <GogContext.Provider value={{
        gogUserId,
        setGogUserIdState,
        connectGogUser,
        disconnectGogUser,
        isLoadingGogUserId,
        gogUserError
      }}>
      {children}
    </GogContext.Provider>
  );
};

export const useGog = (): GogContextType => {
  const context = useContext(GogContext);
  if (context === undefined) {
    throw new Error('useGog must be used within a GogProvider');
  }
  return context;
};
