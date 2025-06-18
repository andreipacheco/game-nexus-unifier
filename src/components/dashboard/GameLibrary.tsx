
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Added CardHeader, CardTitle, CardDescription
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Game, platformInfo, PlatformInfo } from "@/data/mockGameData";
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
// import { useXbox } from "@/contexts/XboxContext"; // Xbox data will come from unified endpoint
// import type { XboxGame } from "@/contexts/XboxContext"; // No longer needed here

// REMOVED: steamGameToGameType, gogGameToGameType, mapXboxGameToGenericGame helpers


export const GameLibrary = ({ selectedPlatform, onPlatformChange }: GameLibraryProps) => {
  const { user } = useAuth();
  const userId = user?.id;

  const { steamId, steamUser } = useSteam(); // For platformFilters status
  const { gogUserId } = useGog();         // For platformFilters status
  // const { xboxGames: xboxGamesFromContext, isLoading: isLoadingXbox, error: errorXbox } = useXbox(); // Data now from DB

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
      fetch(`/api/user/${userId}/games`)
        .then(res => {
          if (!res.ok) {
            return res.json().then(err => { throw new Error(err.message || `HTTP error! status: ${res.status}`) });
          }
          return res.json();
        })
        .then((data: Game[] | { message: string }) => { // Type check for error message from API
          if (Array.isArray(data)) {
            setAllGamesFromDb(data);
          } else if (data && typeof data.message === 'string') {
            // Handle cases where API returns a message (e.g., "Forbidden", "No games found")
            console.warn("Message from /api/user/:userId/games:", data.message);
            setAllGamesFromDb([]); // Set to empty array if a message is received
            // Optionally set a specific error message for the user
            // setAllGamesError(`Note: ${data.message}`);
          } else {
            // Handle unexpected response structure
            console.error("Unexpected data structure from /api/user/:userId/games:", data);
            setAllGamesFromDb([]);
            setAllGamesError("Received unexpected data from server.");
          }
        })
        .catch(err => {
          console.error("Failed to fetch all games:", err);
          setAllGamesError(err.message || "Failed to load games from database.");
          setAllGamesFromDb([]); // Clear games on error
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
    ...platformInfo, // This should ideally include Steam, GOG, Xbox, PSN with icons
    steam: { name: 'Steam', color: '#1b2838', icon: () => <Gamepad2 /> }, // Placeholder icon
    gog: { name: 'GOG', color: '#7b2f8a', icon: () => <Gamepad2 /> },     // Placeholder icon
    xbox: { name: 'Xbox', color: '#107c10', icon: () => <Gamepad2 /> },    // Placeholder icon
    psn: { name: 'PlayStation', color: '#003087', icon: () => <Gamepad2 /> }
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
      count: allGames.filter(game => game.platform === key).length
    }))
  ].filter(f => {
      if (f.key === 'all') return true;
      if (f.count > 0) return true;
      // Show filter if the user is connected to the platform, even if count is 0 initially
      if (f.key === 'steam' && steamId && steamUser) return true;
      if (f.key === 'gog' && gogUserId) return true;
      if (f.key === 'xbox' && xboxGamesFromContext.length > 0) return true; // Show if connected, even if 0 games after filter
      // Or, more simply, always show if platform is in platformInfo and user is "connected"
      // For Xbox, "connected" means xboxGamesFromContext exists and no error, handled by context
      if (f.key === 'xbox' /* && xbox connected status from context/localStorage if available */) {
        // Check if there's any Xbox game in allGames, or rely on PlatformConnections for actual connection status display
        return allGames.some(game => game.platform?.toLowerCase() === 'xbox') || !!localStorage.getItem('xboxToken'); // Example for Xbox token
      }
      if (f.key === 'psn' && !!localStorage.getItem('psnAuthToken')) return true;
      // Fallback: only show if games exist for the platform or it's 'all'
      // This might hide platforms user is connected to but has 0 games synced yet.
      // A better approach might be to get connection statuses from contexts or a dedicated API endpoint.
      // For now, we'll show if games for that platform exist in the loaded list.
      return allGames.some(game => game.platform?.toLowerCase() === f.key);
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
            <p className="text-sm text-muted-foreground mt-1">
              Could not fetch your games from the database. Please try again later or check your connections.
            </p>
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
              {selectedPlatform === 'steam' && steamId && !steamGamesError && steamGames.length === 0 ? 'No Steam games to display or library is private.' :
               selectedPlatform === 'gog' && gogUserId && !gogGamesError && gogGames.length === 0 ? 'No GOG games to display.' :
               selectedPlatform === 'xbox' && !errorXbox && xboxGamesFromContext.length === 0 ? 'No Xbox games to display or profile is private.' :
               selectedPlatform === 'psn' && !!localStorage.getItem('psnAuthToken') /* && psnGames.length === 0 (when integrated) */ ? 'No PSN games to display or library is private.' :
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
