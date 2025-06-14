import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

// Define the shape of the Steam user data
interface SteamUserProfile {
  personaName: string;
  avatarFull: string; // Matches the field from SteamAPI summary
  profileUrl: string;
  // Add any other fields you might want to store
}

// Define the shape of the context value
interface SteamContextType {
  steamId: string | null;
  steamUser: SteamUserProfile | null;
  isLoadingSteamProfile: boolean;
  steamProfileError: string | null;
  setSteamConnection: (steamId: string | null, userProfile?: SteamUserProfile | null) => void;
  fetchSteamProfile: (steamId: string) => Promise<void>;
  clearSteamConnection: () => void;
}

// Create the context with a default undefined value initially, will be provided by provider
const SteamContext = createContext<SteamContextType | undefined>(undefined);

// Define the props for the provider
interface SteamProviderProps {
  children: ReactNode;
}

export const SteamProvider: React.FC<SteamProviderProps> = ({ children }) => {
  const [steamId, setSteamId] = useState<string | null>(null);
  const [steamUser, setSteamUser] = useState<SteamUserProfile | null>(null);
  const [isLoadingSteamProfile, setIsLoadingSteamProfile] = useState<boolean>(false);
  const [steamProfileError, setSteamProfileError] = useState<string | null>(null);

  // Function to set steam connection details manually (e.g., after OpenID callback)
  const setSteamConnection = (newSteamId: string | null, userProfile: SteamUserProfile | null = null) => {
    setSteamId(newSteamId);
    setSteamUser(userProfile);
    if (!newSteamId) {
        localStorage.removeItem('steamId');
        localStorage.removeItem('steamUser');
    } else {
        localStorage.setItem('steamId', newSteamId);
        if (userProfile) {
            localStorage.setItem('steamUser', JSON.stringify(userProfile));
        }
    }
  };

  // Function to clear steam connection details (logout)
  const clearSteamConnection = () => {
    setSteamId(null);
    setSteamUser(null);
    localStorage.removeItem('steamId');
    localStorage.removeItem('steamUser');
    // Potentially call a backend logout endpoint if necessary
    console.log("Steam connection cleared.");
  };

  // Function to fetch steam profile data if only steamId is known
  const fetchSteamProfile = async (sId: string) => {
    if (!sId) return;
    setIsLoadingSteamProfile(true);
    setSteamProfileError(null);
    try {
      const response = await fetch(`/api/steam/user/${sId}`); // Assuming backend is on same domain
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }
      const data: SteamUserProfile = await response.json();
      setSteamUser(data);
      localStorage.setItem('steamUser', JSON.stringify(data)); // Update localStorage
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch Steam user profile';
      setSteamProfileError(errorMessage);
      console.error("Error fetching Steam profile:", errorMessage);
      // Optionally clear steamId if profile fetch fails critically
      // clearSteamConnection();
    } finally {
      setIsLoadingSteamProfile(false);
    }
  };

  // Load initial state from localStorage and verify with backend
  useEffect(() => {
    const storedSteamId = localStorage.getItem('steamId');
    if (storedSteamId) {
      setIsLoadingSteamProfile(true);
      setSteamProfileError(null);
      // Verify storedSteamId with backend and fetch profile
      fetch(`/api/user/steam_profile?steamid=${storedSteamId}`)
        .then(async (response) => {
          if (!response.ok) {
            // If user not found in DB (404) or other error, clear local state
            if (response.status === 404) {
              console.log('Stored SteamID not found in DB, clearing local session.');
            } else {
              const errorData = await response.json().catch(() => ({})); // Try to parse error, default if not JSON
              console.error(`Error verifying SteamID with backend: ${response.status}`, errorData.error || response.statusText);
            }
            clearSteamConnection(); // Clears context and localStorage
            return;
          }
          return response.json();
        })
        .then((data) => {
          if (data) {
            // Data here should be { steamId, personaName, avatarFull, profileUrl }
            setSteamId(data.steamId); // Set from verified data
            setSteamUser({
              personaName: data.personaName,
              avatarFull: data.avatarFull,
              profileUrl: data.profileUrl,
            });
            // Update localStorage with potentially fresher data from DB (though it should match if DB is source of truth)
            localStorage.setItem('steamId', data.steamId);
            localStorage.setItem('steamUser', JSON.stringify({
              personaName: data.personaName,
              avatarFull: data.avatarFull,
              profileUrl: data.profileUrl,
            }));
          }
        })
        .catch(err => {
          console.error('Network error or other issue verifying SteamID with backend:', err);
          // Clear local state on any critical fetch error too
          clearSteamConnection();
        })
        .finally(() => {
          setIsLoadingSteamProfile(false);
        });
    }
  }, []); // Note: `clearSteamConnection` is stable and not needed in deps here.


  return (
    <SteamContext.Provider value={{
        steamId,
        steamUser,
        isLoadingSteamProfile,
        steamProfileError,
        setSteamConnection,
        fetchSteamProfile, // This function is still used by PlatformConnections for post-OpenID fetch
        clearSteamConnection
    }}>
      {children}
    </SteamContext.Provider>
  );
};

// Custom hook to use the SteamContext
export const useSteam = (): SteamContextType => {
  const context = useContext(SteamContext);
  if (context === undefined) {
    throw new Error('useSteam must be used within a SteamProvider');
  }
  return context;
};
