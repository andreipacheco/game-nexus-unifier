import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import logger from '@/utils/logger'; // Assuming a logger utility exists

// Interfaces
export interface PlaystationTrophyInfo {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

export interface PlaystationGame {
  // Fields based on what psn-api's getUserTitles might return and our model
  // Example from psn-api docs: userTitlesResponse.trophyTitles
  // Each title has: npCommunicationId, trophyTitleName, trophyTitleIconUrl, trophyTitlePlatform,
  // hasTrophyGroups, definedTrophies, progress, earnedTrophies, hiddenFlag, lastUpdatedDateTime
  npCommunicationId: string; // Unique ID for the title on a specific platform (e.g. "NPWR00132_00")
  titleId?: string; // Often part of npCommunicationId or a separate field, e.g. CUSAXXXXX. To be derived if needed.
  name: string; // trophyTitleName
  image: string; // trophyTitleIconUrl
  platform: string; // trophyTitlePlatform (e.g., "PS4", "PS5")
  trophySummary: {
    progress: number; // Overall progress percentage
    earnedTrophies: PlaystationTrophyInfo; // Trophies earned by the user
    definedTrophies: PlaystationTrophyInfo; // Total trophies defined for the game
  };
  hasTrophyGroups: boolean;
  lastUpdatedDateTime: string; // ISO Date string
  // Fields from our PlaystationGame model (if not directly from API, might be added/transformed)
  userId?: string; // Our internal user ID, not directly from PSN user titles
}

export interface PlaystationContextType {
  npssoToken: string | null;
  playstationGames: PlaystationGame[];
  isLoadingPlaystation: boolean;
  errorPlaystation: string | null;
  connectPlaystation: (token: string) => Promise<void>;
  disconnectPlaystation: () => void;
  fetchPlaystationGames: (token: string) => Promise<void>; // Keep this if direct fetching is also needed
}

const PlaystationContext = createContext<PlaystationContextType | undefined>(undefined);

interface PlaystationProviderProps {
  children: ReactNode;
}

export const PlaystationProvider: React.FC<PlaystationProviderProps> = ({ children }) => {
  const [npssoToken, setNpssoToken] = useState<string | null>(null);
  const [playstationGames, setPlaystationGames] = useState<PlaystationGame[]>([]);
  const [isLoadingPlaystation, setIsLoadingPlaystation] = useState<boolean>(false);
  const [errorPlaystation, setErrorPlaystation] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('npssoToken');
    if (storedToken) {
      logger.info('Found NPSSO token in localStorage.');
      setNpssoToken(storedToken);
      // Automatically fetch games if token exists.
      // Consider if this is desired or if fetching should only be explicit.
      // fetchPlaystationGames(storedToken); // Removed auto-fetch, let PlatformConnections decide
    }
  }, []);

  const fetchPlaystationGames = useCallback(async (token: string) => {
    if (!token) {
      setErrorPlaystation("NPSSO token is not available for fetching games.");
      return;
    }
    setIsLoadingPlaystation(true);
    setErrorPlaystation(null);
    logger.info('Fetching Playstation games with token...');

    try {
      const response = await fetch('/api/playstation/user/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ npsso: token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorDetail = errorData?.details || errorData?.error || `HTTP error ${response.status}`;
        logger.error(`Error fetching Playstation games: ${errorDetail}`);
        throw new Error(errorDetail);
      }

      const data = await response.json();
      // Adapt data structure from API (userTitlesResponse.trophyTitles) to PlaystationGame[]
      const games: PlaystationGame[] = (data.trophyTitles || []).map((title: any) => ({
        npCommunicationId: title.npCommunicationId,
        name: title.trophyTitleName,
        image: title.trophyTitleIconUrl,
        platform: title.trophyTitlePlatform,
        trophySummary: {
          progress: title.progress,
          earnedTrophies: title.earnedTrophies,
          definedTrophies: title.definedTrophies,
        },
        hasTrophyGroups: title.hasTrophyGroups,
        lastUpdatedDateTime: title.lastUpdatedDateTime,
      }));

      setPlaystationGames(games);
      logger.info(`Successfully fetched ${games.length} Playstation games.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Playstation fetch error: ${errorMessage}`);
      setErrorPlaystation(errorMessage);
      setPlaystationGames([]); // Clear games on error
    } finally {
      setIsLoadingPlaystation(false);
    }
  }, []);

  const connectPlaystation = useCallback(async (token: string) => {
    if (!token.trim()) {
      setErrorPlaystation("NPSSO token cannot be empty.");
      logger.warn("Attempted to connect Playstation with an empty NPSSO token.");
      return;
    }
    logger.info('Connecting Playstation with new NPSSO token.');
    localStorage.setItem('npssoToken', token);
    setNpssoToken(token);
    // Automatically fetch games upon connection
    await fetchPlaystationGames(token);
  }, [fetchPlaystationGames]);

  const disconnectPlaystation = useCallback(() => {
    logger.info('Disconnecting Playstation: clearing NPSSO token and games.');
    localStorage.removeItem('npssoToken');
    setNpssoToken(null);
    setPlaystationGames([]);
    setErrorPlaystation(null);
    setIsLoadingPlaystation(false); // Reset loading state
  }, []);

  // Optional: Effect to refetch games if token changes from an external source (e.g. another tab)
  // This might be overly complex for now, but good to keep in mind.
  // useEffect(() => {
  //   const handleStorageChange = (event: StorageEvent) => {
  //     if (event.key === 'npssoToken') {
  //       const newToken = event.newValue;
  //       setNpssoToken(newToken);
  //       if (newToken) {
  //         fetchPlaystationGames(newToken);
  //       } else {
  //         disconnectPlaystation(); // Or just clear games and set error if preferred
  //       }
  //     }
  //   };
  //   window.addEventListener('storage', handleStorageChange);
  //   return () => window.removeEventListener('storage', handleStorageChange);
  // }, [fetchPlaystationGames, disconnectPlaystation]);


  return (
    <PlaystationContext.Provider value={{
      npssoToken,
      playstationGames,
      isLoadingPlaystation,
      errorPlaystation,
      connectPlaystation,
      disconnectPlaystation,
      fetchPlaystationGames
    }}>
      {children}
    </PlaystationContext.Provider>
  );
};

export const usePlaystation = (): PlaystationContextType => {
  const context = useContext(PlaystationContext);
  if (context === undefined) {
    throw new Error('usePlaystation must be used within a PlaystationProvider');
  }
  return context;
};
