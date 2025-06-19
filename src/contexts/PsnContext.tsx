import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
} from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext'; // Assuming AuthContext is in the same directory
import { useToast } from '@/components/ui/use-toast'; // Assuming this path is correct

// 1. Interfaces
export interface PsnGame {
  // Core fields from TrophyTitle
  npCommunicationId: string;       // Game ID (e.g., "NPWR00123_00")
  trophyTitleName: string;         // Name of the game
  trophyTitleIconUrl: string;      // URL for the game's icon
  trophyTitlePlatform: string;     // Platform (e.g., "PS5", "PS4")

  // Optional but useful fields from TrophyTitle
  trophySetVersion?: string;       // Version of the trophy set
  lastUpdatedDateTime?: string;    // ISO date string of last trophy activity

  // Trophy counts
  definedTrophies?: {             // Total trophies defined for the title
    bronze: number;
    silver: number;
    gold: number;
    platinum: number; // Usually 0 or 1 for platinum
  };
  earnedTrophies?: {              // Trophies earned by the user for this title
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };

  // Additional fields you might find in TrophyTitle or want to add for consistency
  // hiddenFlag?: boolean;
  // progress?: number; // Overall progress percentage
}

export interface PsnProfile {
  accountId: string;
  onlineId: string;
  avatarUrl?: string; // Optional, based on what your backend returns
}

// 2. PsnContextType Interface
interface PsnContextType {
  psnGames: PsnGame[];
  psnProfile: PsnProfile | null;
  isLoadingGames: boolean;
  errorGames: string | null;
  isConnecting: boolean;
  errorConnect: string | null;
  isConnected: boolean;
  connectPsn: (npsso: string) => Promise<void>;
  fetchPsnGames: () => Promise<void>;
  disconnectPsn: () => void; // Basic disconnect, can be expanded
}

// 3. PsnContext
const PsnContext = createContext<PsnContextType | undefined>(undefined);

// 4. PsnProvider Component
interface PsnProviderProps {
  children: ReactNode;
}

export const PsnProvider = ({ children }: PsnProviderProps) => {
  const [psnGames, setPsnGames] = useState<PsnGame[]>([]);
  const [psnProfile, setPsnProfile] = useState<PsnProfile | null>(null);
  const [isLoadingGames, setIsLoadingGames] = useState<boolean>(false);
  const [errorGames, setErrorGames] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorConnect, setErrorConnect] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const authContext = useAuth();
  const { toast } = useToast();

  // Effect to check initial connection status and set profile from AuthContext
  useEffect(() => {
    if (authContext.user?.psnAccountId && authContext.user?.psnOnlineId) {
      setPsnProfile({
        accountId: authContext.user.psnAccountId,
        onlineId: authContext.user.psnOnlineId,
        // avatarUrl: authContext.user.psnAvatarUrl, // If you add avatar to User model & it's passed
      });
      setIsConnected(true);
      // Optionally fetch games if user is already connected
      // fetchPsnGames(); // Consider if this should be automatic or user-triggered
    } else {
      // Ensure local state is clear if user logs out or has no PSN info
      setPsnProfile(null);
      setIsConnected(false);
      setPsnGames([]);
    }
  }, [authContext.user]); // Re-run when user object in AuthContext changes


  const fetchPsnGames = useCallback(async () => {
    if (!isConnected && !authContext.user?.psnAccountId) {
      // This check is more of a safeguard, primary check should be in UI
      // or rely on the initial useEffect to set `isConnected`.
      // If called programmatically when not connected, it might try if `authContext.user.psnAccountId` is stale.
      // However, the backend will reject if NPSSO is missing or invalid.
      toast({
        title: 'PSN Not Connected',
        description: 'Please connect your PSN account first.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingGames(true);
    setErrorGames(null);
    try {
      const response = await axios.get<PsnGame[]>('/api/psn/games'); // Expecting a direct array of PsnGame
      setPsnGames(response.data || []); // Process data as a direct array
      // toast({
      //   title: 'PSN Games Fetched',
      //   description: `Successfully retrieved ${response.data?.length || 0} PSN games.`, // Adjusted toast
      // });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch PSN games.';
      setErrorGames(errorMessage);
      toast({
        title: 'Error Fetching PSN Games',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingGames(false);
    }
  }, [isConnected, authContext.user?.psnAccountId, toast]); // Add fetchPsnGames to useEffect dependency array if called there

   // Effect to fetch games when isConnected becomes true and profile is set, or when fetchPsnGames itself is updated
   useEffect(() => {
    if (isConnected && psnProfile?.accountId) {
      fetchPsnGames();
    }
  }, [isConnected, psnProfile?.accountId, fetchPsnGames]); // Added fetchPsnGames

  const connectPsn = useCallback(async (npsso: string) => {
    setIsConnecting(true);
    setErrorConnect(null);
    try {
      const response = await axios.post<{ message: string; psnProfile: PsnProfile; user: any }>('/api/psn/connect', { npsso });
      setPsnProfile(response.data.psnProfile);
      setIsConnected(true);

      // Refresh user data in AuthContext to get updated psnAccountId, etc.
      if (authContext.refreshUser) {
        await authContext.refreshUser();
      } else {
        // Fallback or warning if refreshUser is not available
        console.warn("AuthContext.refreshUser() is not available. User data might be stale.");
        // Potentially update authContext.user directly if absolutely necessary and possible,
        // but this is generally not recommended as AuthContext should manage its own state.
        // Example: authContext.setUser(response.data.user); // If setUser is exposed and updates context correctly
      }

      toast({
        title: 'PSN Connected',
        description: response.data.message || `Successfully connected as ${response.data.psnProfile.onlineId}.`,
      });
      // Optionally fetch games immediately after connecting
      // await fetchPsnGames(); // Already handled by useEffect on isConnected change
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to connect PSN account.';
      setErrorConnect(errorMessage);
      setIsConnected(false); // Ensure isConnected is false on error
      setPsnProfile(null); // Clear profile on error
      toast({
        title: 'PSN Connection Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  }, [authContext, toast]); // Removed fetchPsnGames from here

  const disconnectPsn = useCallback(async () => {
    // Future: Implement backend call to clear NPSSO and PSN details from User model
    // try {
    //   await axios.post('/api/psn/disconnect'); // Example endpoint
    //   toast({ title: 'PSN Disconnected', description: 'Your PSN account has been disconnected from the server.' });
    // } catch (error) {
    //   toast({ title: 'Error Disconnecting', description: 'Could not disconnect from server. Please try again.', variant: 'destructive' });
    //   // Optionally, proceed with client-side disconnect anyway or handle error more gracefully
    // }

    setPsnGames([]);
    setPsnProfile(null);
    setIsConnected(false);
    setErrorGames(null);
    setErrorConnect(null);

    // Refresh user data in AuthContext to reflect the disconnection
    // This assumes the backend would have cleared psnAccountId etc. if a disconnect call was made.
    // If disconnect is purely client-side for now, refreshUser might not change PSN fields in DB.
    if (authContext.refreshUser) {
      await authContext.refreshUser();
    }
     toast({
        title: 'PSN Disconnected (Client-side)',
        description: 'Your PSN session has been cleared locally.',
      });
  }, [authContext, toast]);


  const contextValue: PsnContextType = {
    psnGames,
    psnProfile,
    isLoadingGames,
    errorGames,
    isConnecting,
    errorConnect,
    isConnected,
    connectPsn,
    fetchPsnGames,
    disconnectPsn,
  };

  return <PsnContext.Provider value={contextValue}>{children}</PsnContext.Provider>;
};

// 5. usePsn Hook
export const usePsn = (): PsnContextType => {
  const context = useContext(PsnContext);
  if (context === undefined) {
    throw new Error('usePsn must be used within a PsnProvider');
  }
  return context;
};
