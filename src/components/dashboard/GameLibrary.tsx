
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Added CardHeader, CardTitle, CardDescription
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Game, platformInfo, PlatformInfo, mockGameData } from "@/data/mockGameData"; // Imported mockGameData
import { Gamepad2, Search, AlertTriangle, Loader2 } from "lucide-react"; // Simpler imports for now
import { Input } from "@/components/ui/input";
import { GameCard } from "./GameCard";
// import PsnGameLibrary from '@/components/dashboard/PsnGameLibrary'; // REMOVED
import PsnTrophyData from '@/components/dashboard/PsnTrophyData';
import { useAuth } from '@/contexts/AuthContext'; // Added AuthContext

// Basic interface for Steam games (adapt as needed based on actual API response)
// REMOVED SteamGame, GogGame interfaces as data will come from consolidated endpoint
/*
interface SteamGame {
  appID: number;
  name: string;
  playtimeForever: number; // in minutes
  imgIconURL: string;
  imgLogoURL?: string; // Often available, good for a larger image if needed
  achievements: { // Added this field
    unlocked: number;
    total: number;
  };
}

// Basic interface for GOG games (adapt as needed based on actual API response)
interface GogGame {
}
*/
// interface GameLibraryProps {
//   games: Game[]; // REMOVED - games will be fetched from DB
//   selectedPlatform: string;
//   onPlatformChange: (platform: string) => void;
// }
interface GameLibraryProps {
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
}

import { useSteam } from "@/contexts/SteamContext"; // Still needed for platformFilters logic
import { useGog } from "@/contexts/GogContext";     // Still needed for platformFilters logic
import { useXbox } from "@/contexts/XboxContext";   // Reinstated for Xbox connection status
// import type { XboxGame } from "@/contexts/XboxContext"; // No longer needed here if not processing games

// REMOVED: steamGameToGameType, gogGameToGameType, mapXboxGameToGenericGame helpers


export const GameLibrary = ({ selectedPlatform, onPlatformChange }: GameLibraryProps) => {
  const { user } = useAuth();
  const userId = user?.id;

  const { steamId, steamUser } = useSteam(); // For platformFilters status
  const { gogUserId } = useGog();         // For platformFilters status
  const { xuid: xboxXuid, errorXbox, isLoadingXbox } = useXbox(); // Get Xbox connection status from context

  const [searchTerm, setSearchTerm] = useState("");
  const [allGamesFromDb, setAllGamesFromDb] = useState<Game[]>([]);
  const [isLoadingAllGames, setIsLoadingAllGames] = useState<boolean>(false);
  const [allGamesError, setAllGamesError] = useState<string | null>(null);

  // REMOVED: steamGames, isLoadingSteamGames, steamGamesError states
  // REMOVED: gogGames, isLoadingGogGames, gogGamesError states
  // REMOVED: useEffect for fetchSteamGames
  // REMOVED: useEffect for fetchGogGames

  useEffect(() => {
    if (userId) {
      setIsLoadingAllGames(true);
      setAllGamesError(null);
      fetch(`/api/user/${userId}/games`, { credentials: 'include' })
        .then(res => {
          if (!res.ok) {
            return res.json().then(err => { throw new Error(err.message || `HTTP error! status: ${res.status}`) });
          }
          return res.json();
        })
        .then((data: Game[] | { message: string }) => { // Type check for error message from API
          if (Array.isArray(data)) {
            const gamesFromApi = data;
            const nonPsnMockGames = mockGameData.filter(game => game.platform !== 'psn');

            // Deduplication: Prioritize API games.
            // Assumes game.id is a reliable unique identifier across sources for this deduplication.
            const gamesMap = new Map<string, Game>();
            nonPsnMockGames.forEach(game => gamesMap.set(game.id, game)); // Add non-PSN mock games first
            gamesFromApi.forEach(game => gamesMap.set(game.id, game));    // Then add/overwrite with API games

            const finalCombinedGames = Array.from(gamesMap.values());
            setAllGamesFromDb(finalCombinedGames);
            setAllGamesError(null); // Clear any previous error state if API call succeeded

          } else if (data && typeof data.message === 'string') {
            // Handle cases where API returns a message (e.g., "Forbidden", "No games found")
            // This typically means the API call was successful but there's no data or a specific condition.
            console.warn("Message from /api/user/:userId/games:", data.message);
            setAllGamesFromDb([]); // Set to empty array if a message (like "No games found") is received
            setAllGamesError(null); // Not an error, but a state like "no games"
          } else {
            // Handle unexpected response structure
            console.error("Unexpected data structure from /api/user/:userId/games:", data);
            setAllGamesError("Failed to load your games due to unexpected data. Displaying sample data.");
            setAllGamesFromDb(mockGameData); // Fallback to mockData
          }
        })
        .catch(err => {
          console.error("Failed to fetch all games:", err);
          // Use a more user-friendly message and provide mock data
          setAllGamesError("Failed to load your games. Displaying sample data.");
          setAllGamesFromDb(mockGameData); // Fallback to mockData
        })
        .finally(() => {
          setIsLoadingAllGames(false);
        });
    } else {
      setAllGamesFromDb([]); // Clear games if no user ID
    }
  }, [userId]);

  const allGames = allGamesFromDb; // Use data fetched from the database

  const currentPlatformInfo: PlatformInfo = {
    ...platformInfo,
    // Ensure platformInfo from mockGameData.ts provides the necessary icons and names
    // For example, if platformInfo.steam.icon is a string, it needs to be handled appropriately
    // or mockGameData.ts needs to provide JSX elements for icons if that's what GameCard expects.
    // For now, assuming platformInfo provides compatible structures or this component adapts.
  };

  const SsearchTermLowerCase = searchTerm.toLowerCase(); // Pre-calculate for efficiency

  const filteredGames = allGames.filter(game => {
    // Defensive check for game.platform matching selectedPlatform
    const matchesPlatform = selectedPlatform === 'all' ||
                            (game.platform &&
                             typeof game.platform === 'string' &&
                             game.platform.toLowerCase() === selectedPlatform.toLowerCase());

    // Defensive check for game.title and game.platform in search term
    let matchesSearch = false;
    if (game.title && typeof game.title === 'string') {
      matchesSearch = matchesSearch || game.title.toLowerCase().includes(SsearchTermLowerCase);
    }
    // Add platform to search criteria
    if (game.platform && typeof game.platform === 'string') {
      matchesSearch = matchesSearch || game.platform.toLowerCase().includes(SsearchTermLowerCase);
    }
    // Add genre to search criteria (as an example of expanding search)
    if (game.genre && typeof game.genre === 'string') {
        matchesSearch = matchesSearch || game.genre.toLowerCase().includes(SsearchTermLowerCase);
    }


    return matchesPlatform && matchesSearch;
  });

  const platformFilters = [
    { key: 'all', name: 'All Platforms', count: allGames.length },
    ...Object.entries(currentPlatformInfo).map(([key, info]) => ({
      key,
      name: info.name,
      icon: info.icon, // Pass the icon function
      count: allGames.filter(game => game.platform === key).length
    }))
  ].filter(f => {
      if (f.key === 'all') return true;
      // Show filter if the user is connected to the platform, even if count is 0 initially
      if (f.key === 'steam' && steamId && steamUser) return true;
      if (f.key === 'gog' && gogUserId) return true;
      // For Xbox, show if connected (xuid exists and no error) or if there are Xbox games already loaded
      if (f.key === 'xbox' && ((xboxXuid && !errorXbox) || allGames.some(game => game.platform?.toLowerCase() === 'xbox'))) return true;
      // For PSN, show if connected (localStorage token exists) or if there are PSN games already loaded
      if (f.key === 'psn' && (!!localStorage.getItem('psnAuthToken') || allGames.some(game => game.platform?.toLowerCase() === 'psn'))) return true;
      // Fallback: only show if games exist for the platform (count > 0)
      if (f.count > 0) return true;
      return false;
    }
  );
 // Simplified filter display logic: always show if platform is known, count will reflect games
 // The filter for platformFilters to only show if count > 0 or 'all' or connected is fine.
 // Let's ensure Xbox filter shows up if context indicates a connection attempt (even if 0 games)
 // The existing filter logic is: platformFilters.filter(f => f.count > 0 || f.key === 'all' || (isConnectedToPlatform_logic_here))
 // For Xbox, isConnected might mean xboxGamesFromContext is populated, or errorXbox is null after a fetch.

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {platformFilters.map((filter) => (
            <Button
              key={filter.key}
              variant={selectedPlatform === filter.key ? 'default' : 'outline'}
              onClick={() => onPlatformChange(filter.key)}
              className="flex items-center space-x-2"
            >
              {/* Render the icon component if it exists. Default h-4 w-4 is in mockGameData.ts */}
              {filter.icon && <filter.icon />}
              <span>{filter.name}</span>
              <Badge variant="secondary" className="ml-1">
                {filter.count}
              </Badge>
            </Button>
          ))}
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search games..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Unified Loading State */}
      {isLoadingAllGames && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <p className="text-muted-foreground">Loading all games from database...</p>
          </CardContent>
        </Card>
      )}
      {/* Unified Error State */}
      {allGamesError && !isLoadingAllGames && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Error Loading Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{allGamesError}</p>
            {/* No longer showing the generic "Could not fetch" message here if we are showing mock data.
                The error message itself in allGamesError should indicate that sample data is shown. */}
            { allGamesError && allGamesError.includes("sample data") ?
              <p className="text-sm text-muted-foreground mt-1">
                We encountered an issue loading your live game data. In the meantime, you can explore the app with sample games.
              </p>
              :
              <p className="text-sm text-muted-foreground mt-1">
                Could not fetch your games from the database. Please try again later or check your connections.
              </p>
            }
          </CardContent>
        </Card>
      )}

      {/* REMOVED individual platform loading/error states (Steam, GOG, Xbox) */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>

      {filteredGames.length === 0 && !isLoadingAllGames && !allGamesError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No games found</h3>
            <p className="text-muted-foreground text-center">
              {selectedPlatform === 'steam' && steamId && allGames.filter(g=>g.platform === 'steam').length === 0 ? 'No Steam games to display or library is private.' :
               selectedPlatform === 'gog' && gogUserId && allGames.filter(g=>g.platform === 'gog').length === 0 ? 'No GOG games to display.' :
               selectedPlatform === 'xbox' && xboxXuid && !errorXbox && allGames.filter(g=>g.platform === 'xbox').length === 0 ? 'No Xbox games to display or profile is private.' :
               selectedPlatform === 'psn' && !!localStorage.getItem('psnAuthToken') && allGames.filter(g=>g.platform === 'psn').length === 0 ? 'No PSN games to display or library is private.' :
               'Try adjusting your search or platform filter.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* PSN Trophy Data */}
      <div className="mt-8">
        <PsnTrophyData />
      </div>

      {/* PSN Game Library - REMOVED */}
    </div>
  );
};
