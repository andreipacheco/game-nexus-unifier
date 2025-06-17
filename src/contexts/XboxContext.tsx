import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext'; // Assuming AuthContext provides user info including xuid
import { toast } from '@/components/ui/use-toast'; // Or your preferred toast library

interface XboxGameAchievement {
  currentAchievements: number;
  totalAchievements: number;
  currentGamerscore: number;
  totalGamerscore: number;
}

interface XboxGame {
  _id?: string; // From MongoDB
  xuid: string;
  titleId: string;
  name: string;
  displayImage?: string;
  achievements: XboxGameAchievement;
  lastUpdated?: string;
  // Add any other relevant fields from your XboxGame model
}

export interface XboxDetailedAchievement {
  id: string; // Typically the achievement name or a unique ID from the API
  name: string;
  description: string;
  isUnlocked: boolean;
  iconUrl?: string;
  gamerscore: number;
  rarityPercent?: number;
  unlockedTime?: string; // ISO date string
  // Fields from xbl.io that might be useful to keep if not mapped directly:
  howToUnlock?: string; // Often same as description for locked achievements
  progressState?: 'Achieved' | 'NotAchieved' | string; // Raw state
  rewards?: any[]; // Raw rewards array
  mediaAssets?: any[]; // Raw media assets
  rarity?: any; // Raw rarity object
}

interface XboxContextType {
  xboxGames: XboxGame[];
  isLoading: boolean; // For the main game list
  error: string | null; // For the main game list
  fetchXboxGames: (xuid: string) => Promise<void>;

  detailedAchievements: { [titleId: string]: XboxDetailedAchievement[] };
  isLoadingDetailedAchievements: { [titleId: string]: boolean };
  errorDetailedAchievements: { [titleId: string]: string | null };
  fetchDetailedXboxAchievements: (xuid: string, titleId: string) => Promise<XboxDetailedAchievement[] | null>;
  currentXuid: string | null; // Added to store the XUID used for fetching games
  // clearXboxData: () => void;
}

const XboxContext = createContext<XboxContextType | undefined>(undefined);

export const XboxProvider = ({ children }: { children: ReactNode }) => {
  const [xboxGames, setXboxGames] = useState<XboxGame[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false); // For fetching game list
  const [error, setError] = useState<string | null>(null); // For fetching game list
  const { user } = useAuth();

  const [detailedAchievements, setDetailedAchievements] = useState<{ [titleId: string]: XboxDetailedAchievement[] }>({});
  const [isLoadingDetailedAchievements, setIsLoadingDetailedAchievements] = useState<{ [titleId: string]: boolean }>({});
  const [errorDetailedAchievements, setErrorDetailedAchievements] = useState<{ [titleId: string]: string | null }>({});
  const [currentXuid, setCurrentXuid] = useState<string | null>(null); // State for current XUID

  // TODO: User model update could make XUID available via useAuth() directly.
  // For now, fetchXboxGames takes xuid as a parameter and we store it.

  const fetchXboxGames = useCallback(async (xuid: string) => {
    if (!xuid) {
      setError("Xbox User ID (XUID) is not available.");
      setXboxGames([]);
      setCurrentXuid(null); // Clear XUID if fetch is invalid
      return;
    }

    setIsLoading(true);
    setCurrentXuid(xuid); // Set current XUID when fetching games
    setError(null);
    try {
      const response = await axios.get<{ _id: string }[] & XboxGame[]>(`/api/xbox/user/${xuid}/games`);
      // Sort games by name, or any other preferred criteria
      const sortedGames = response.data.sort((a, b) => a.name.localeCompare(b.name));
      setXboxGames(sortedGames);
      toast({
        title: "Xbox games loaded",
        description: `Successfully fetched ${sortedGames.length} Xbox games.`,
      });
    } catch (err: any) {
      let errorMessage = "Failed to fetch Xbox games.";
      if (axios.isAxiosError(err) && err.response) {
        errorMessage = err.response.data.error || err.message;
        if (err.response.status === 404) {
          errorMessage = "No Xbox games found or profile is private.";
          setXboxGames([]); // Clear games if profile not found or no games
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setXboxGames([]); // Clear games on error
      toast({
        title: "Error fetching Xbox games",
        description: errorMessage,
        variant: "destructive",
      });
      console.error("Error fetching Xbox games:", errorMessage, err);
    } finally {
      setIsLoading(false);
    }
  }, []); // Removed user from dependencies for now, fetchXboxGames takes xuid

  // Potential: Auto-fetch for fetchXboxGames if XUID is available and changes
  // useEffect(() => {
  //   const xboxXuid = user?.platformProfiles?.xbox?.xuid;
  //   if (xboxXuid) {
  //     fetchXboxGames(xboxXuid);
  //   } else {
  //     setXboxGames([]); // Clear games if no XUID
  //   }
  // }, [user, fetchXboxGames]);

  // const clearXboxData = () => {
  //   setXboxGames([]);
  //   setError(null);
  //   setIsLoading(false); // This was for main game list, keep separate
  // };

  const fetchDetailedXboxAchievements = useCallback(async (xuid: string, titleId: string): Promise<XboxDetailedAchievement[] | null> => {
    if (!xuid || !titleId) {
      const msg = "XUID and Title ID are required to fetch detailed achievements.";
      setErrorDetailedAchievements(prev => ({ ...prev, [titleId]: msg }));
      // Do not toast here as this is a programmatic error, not a user-facing fetch error
      console.error(msg);
      return null;
    }

    setIsLoadingDetailedAchievements(prev => ({ ...prev, [titleId]: true }));
    setErrorDetailedAchievements(prev => ({ ...prev, [titleId]: null }));

    try {
      const response = await axios.get<any[]>(`/api/xbox/user/${xuid}/game/${titleId}/achievements`);
      const rawAchievements = response.data;

      const mappedAchievements: XboxDetailedAchievement[] = rawAchievements.map((ach: any) => {
        // Determine if unlocked based on various possible fields
        let unlockedStatus = false;
        if (typeof ach.isUnlocked === 'boolean') {
          unlockedStatus = ach.isUnlocked;
        } else if (ach.progressState) {
          unlockedStatus = ach.progressState === 'Achieved';
        } else if (ach.state) {
          unlockedStatus = ach.state === 'Achieved';
        }

        // Try to get description, prioritizing unlocked if available
        let achDescription = ach.description;
        if (unlockedStatus && ach.unlockedDescription) {
            achDescription = ach.unlockedDescription;
        } else if (!unlockedStatus && ach.lockedDescription) {
            achDescription = ach.lockedDescription;
        }


        return {
          id: ach.id || ach.name, // Use 'id' if available, fallback to 'name'
          name: ach.name || 'Unknown Achievement',
          description: achDescription || ach.howToUnlock || '',
          isUnlocked: unlockedStatus,
          // Prefer specific media asset if structure is known, else fallback
          iconUrl: ach.mediaAssets?.[0]?.url || ach.url || ach.icon_url || ach.image_url,
          gamerscore: ach.rewards?.find((r: any) => r.type === 'Gamerscore')?.value || ach.gamerscore || ach.value || 0,
          rarityPercent: ach.rarity?.currentProgress || ach.rarity?.percentage, // xbl.io v1 used currentProgress, v2 might use percentage
          unlockedTime: ach.progression?.timeUnlocked || ach.timeUnlocked || ach.earned_at,
          // Keep raw fields for debugging or future use if needed
          progressState: ach.progressState,
          rewards: ach.rewards,
          mediaAssets: ach.mediaAssets,
          rarity: ach.rarity,
        };
      });

      setDetailedAchievements(prev => ({ ...prev, [titleId]: mappedAchievements }));
      setIsLoadingDetailedAchievements(prev => ({ ...prev, [titleId]: false }));
      toast({
        title: `Achievements for ${titleId}`, // Consider fetching game name to make this friendlier
        description: `Successfully fetched ${mappedAchievements.length} achievements.`,
      });
      return mappedAchievements;

    } catch (err: any) {
      let errorMessage = "Failed to fetch detailed Xbox achievements.";
      if (axios.isAxiosError(err) && err.response) {
        errorMessage = err.response.data.error || err.message || errorMessage;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setErrorDetailedAchievements(prev => ({ ...prev, [titleId]: errorMessage }));
      setIsLoadingDetailedAchievements(prev => ({ ...prev, [titleId]: false }));
      toast({
        title: "Error fetching detailed achievements",
        description: errorMessage,
        variant: "destructive",
      });
      console.error(`Error fetching detailed Xbox achievements for ${titleId}:`, errorMessage, err);
      return null;
    }
  }, []); // No user dependency here, xuid is passed in

  return (
    <XboxContext.Provider value={{
      xboxGames,
      isLoading,
      error,
      fetchXboxGames,
      detailedAchievements,
      isLoadingDetailedAchievements,
      errorDetailedAchievements,
      fetchDetailedXboxAchievements,
      currentXuid
    }}>
      {children}
    </XboxContext.Provider>
  );
};

export const useXbox = (): XboxContextType => {
  const context = useContext(XboxContext);
  if (context === undefined) {
    throw new Error('useXbox must be used within an XboxProvider');
  }
  return context;
};
