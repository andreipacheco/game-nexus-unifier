import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';

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
  isAuthenticated: boolean; // Added isAuthenticated
  isLoadingSteamProfile: boolean;
  steamProfileError: string | null;
  // setSteamConnection: (steamId: string | null, userProfile?: SteamUserProfile | null) => void; // Potentially re-evaluate need
  fetchSteamProfile: (steamId: string) => Promise<void>; // Kept for now, might be used by OpenID callback before full /api/me refresh
  clearSteamConnection: () => void;
  // New function to explicitly trigger a refresh from /api/me
  checkUserSession: () => Promise<void>;
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false); // Added
  const [isLoadingSteamProfile, setIsLoadingSteamProfile] = useState<boolean>(true); // Start true on initial load
  const [steamProfileError, setSteamProfileError] = useState<string | null>(null);

  // Function to clear steam connection details (logout or session expiry)
  const clearSteamConnection = useCallback(() => { // Wrapped in useCallback
    setSteamId(null);
    setSteamUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('steamId');
    localStorage.removeItem('steamUser');
    // console.log("Steam connection cleared from context.");
  }, []); // No dependencies, this function is stable

  // Function to fetch current user session from backend /api/me
  const checkUserSession = useCallback(async () => {
    setIsLoadingSteamProfile(true);
    setSteamProfileError(null);
    try {
      const response = await fetch('/api/me'); // No steamId needed, uses session cookie
      if (response.ok) {
        const data: SteamUserProfile & { steamId: string } = await response.json();
        setSteamId(data.steamId);
        setSteamUser({
          personaName: data.personaName,
          avatarFull: data.avatarFull, // Ensure backend sends avatarFull
          profileUrl: data.profileUrl,
        });
        setIsAuthenticated(true);
        localStorage.setItem('steamId', data.steamId); // Persist for quick UI hints
        localStorage.setItem('steamUser', JSON.stringify(data));
      } else if (response.status === 401) { // Not authenticated
        clearSteamConnection();
      } else { // Other errors
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check user session';
      setSteamProfileError(errorMessage);
      console.error("Error checking user session:", errorMessage);
      clearSteamConnection(); // Clear session on error
    } finally {
      setIsLoadingSteamProfile(false);
    }
  }, [clearSteamConnection]); // Added clearSteamConnection as dependency

  // Function to fetch steam profile data if only steamId is known (e.g. after OpenID redirect if needed)
  // This might be less used if /api/me is the primary source after login.
  // However, PlatformConnections might call this to optimistically load UI with fresh Steam data.
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

  // Initial load: check user session
  useEffect(() => {
    checkUserSession();
  }, [checkUserSession]); // checkUserSession is memoized with useCallback


  return (
    <SteamContext.Provider value={{
        steamId,
        steamUser,
        isAuthenticated, // Added
        isLoadingSteamProfile,
        steamProfileError,
        // setSteamConnection, // Removed as checkUserSession and fetchSteamProfile handle updates
        fetchSteamProfile,
        clearSteamConnection,
        checkUserSession // Exposed for manual refresh if needed
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
