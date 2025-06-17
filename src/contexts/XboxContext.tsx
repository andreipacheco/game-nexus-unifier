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

interface XboxContextType {
  xboxGames: XboxGame[];
  isLoading: boolean;
  error: string | null;
  fetchXboxGames: (xuid: string) => Promise<void>;
  // Potentially add a function here to link/update XUID if not directly in AuthContext
  // clearXboxData: () => void;
}

const XboxContext = createContext<XboxContextType | undefined>(undefined);

export const XboxProvider = ({ children }: { children: ReactNode }) => {
  const [xboxGames, setXboxGames] = useState<XboxGame[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth(); // Get user from AuthContext

  // TODO: Need a way to get/set the user's XUID.
  // This might come from user.platformProfiles.xbox.xuid or similar once User model is updated.
  // For now, fetchXboxGames will require it as a parameter.

  const fetchXboxGames = useCallback(async (xuid: string) => {
    if (!xuid) {
      setError("Xbox User ID (XUID) is not available.");
      setXboxGames([]);
      return;
    }

    setIsLoading(true);
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

  // Potential: Auto-fetch if XUID is available and changes
  // useEffect(() => {
  //   const xboxXuid = user?.platformProfiles?.xbox?.xuid; // Example path to XUID
  //   if (xboxXuid) {
  //     fetchXboxGames(xboxXuid);
  //   } else {
  //     setXboxGames([]); // Clear games if no XUID
  //   }
  // }, [user, fetchXboxGames]);

  // const clearXboxData = () => {
  //   setXboxGames([]);
  //   setError(null);
  //   setIsLoading(false);
  // };

  return (
    <XboxContext.Provider value={{ xboxGames, isLoading, error, fetchXboxGames }}>
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
