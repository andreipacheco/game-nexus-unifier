
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Added CardHeader, CardTitle, CardDescription
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Game } from "@/types/game"; // Added PlatformInfo
import { platformInfo, PlatformInfo } from "@/data/platformData"; // Added PlatformInfo
import { Clock, Trophy, Play, Download, Search, AlertTriangle, Loader2 } from "lucide-react"; // Added AlertTriangle, Loader2
import { Input } from "@/components/ui/input";
import { GameCard } from "./GameCard";

// Basic interface for Steam games (adapt as needed based on actual API response)
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
  appID: string; // GOG uses id, which is a string in the backend
  name: string;
  imgIconURL: string;
  playtimeForever: number; // Defaulted to 0 in backend
  achievements: {
    unlocked: number;
    total: number;
  };
}

interface GameLibraryProps {
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
  // steamId?: string; // Steam ID will now come from context
}

import { useSteam } from "@/contexts/SteamContext";
import { useGog } from "@/contexts/GogContext";
import { useXbox } from "@/contexts/XboxContext"; // Import useXbox
import type { XboxGame } from "@/contexts/XboxContext"; // Import XboxGame type

// Helper to convert SteamGame to Game for consistent display, or GameCard could be adapted
const steamGameToGameType = (steamGame: SteamGame): Game | null => {
  if (!steamGame || typeof steamGame.appID === 'undefined' || steamGame.appID === null) {
    console.warn('Skipping Steam game with missing or invalid appID:', steamGame);
    return null;
  }

  const gameTitle = steamGame.name || 'Unknown Steam Game';
  const playtimeHours = typeof steamGame.playtimeForever === 'number' ? Math.round(steamGame.playtimeForever / 60) : 0;

  // Construct image URL safely, using a placeholder if data is missing
  // The current GameCard uses coverImage. header.jpg is usually available.
  // imgIconURL is for smaller list icons, not usually for card headers.
  const coverImg = `https://cdn.akamai.steamstatic.com/steam/apps/${steamGame.appID}/header.jpg`;
  // If imgIconURL was needed for something else:
  // const iconUrl = steamGame.imgIconURL || '';
  // const smallImageUrl = iconUrl ? `https://media.steampowered.com/steamcommunity/public/images/apps/${steamGame.appID}/${iconUrl}.jpg` : 'placeholder_icon.svg';

  // Default values for fields not present in Steam's GetOwnedGames API response
  const defaultLastPlayed = new Date(0).toISOString(); // Epoch time as a placeholder
  // const defaultAchievements = { unlocked: 0, total: 0 }; // Removed, as backend provides it
  const defaultStatus = 'not_installed'; // Or 'owned' - 'not_installed' seems reasonable
  const defaultGenre: string[] = ['Unknown Genre']; // Default to an array with 'Unknown Genre'
  const defaultReleaseYear = 0; // Placeholder for unknown year

  return {
    id: `steam-${steamGame.appID.toString()}`, // Unique ID for React keys
    appId: steamGame.appID.toString(),
    title: gameTitle,
    platform: 'steam',
    coverImage: coverImg,
    // imageUrl: coverImg, // Redundant if GameCard uses coverImage, ensure Game uses one primary image prop
    playtime: playtimeHours,
    lastPlayed: defaultLastPlayed, // Steam API doesn't provide this in GetOwnedGames
    achievements: steamGame.achievements, // Use achievements data from backend
    status: defaultStatus, // Steam API GetOwnedGames doesn't provide installation status
    genre: defaultGenre, // Steam API GetOwnedGames doesn't provide genre
    releaseYear: defaultReleaseYear, // Steam API GetOwnedGames doesn't provide release year
    // Ensure any other fields from the 'Game' interface (from mockGameData.ts) are considered
  };
};

// Helper to convert GogGame to Game for consistent display
const gogGameToGameType = (gogGame: GogGame): Game | null => {
  if (!gogGame || typeof gogGame.appID === 'undefined' || gogGame.appID === null) {
    console.warn('Skipping GOG game with missing or invalid appID:', gogGame);
    return null;
  }

  const gameTitle = gogGame.name || 'Unknown GOG Game';
  // playtimeForever is already a number (defaulted to 0 in backend)
  const playtimeHours = gogGame.playtimeForever;


  // Default values for fields not present or different in GOG's API response
  const defaultLastPlayed = new Date(0).toISOString(); // Epoch time as a placeholder
  const defaultStatus = 'owned'; // GOG games are owned
  const defaultGenre: string[] = ['Unknown Genre'];
  const defaultReleaseYear = 0; // Placeholder for unknown year

  return {
    id: `gog-${gogGame.appID}`, // Unique ID for React keys
    title: gameTitle,
    platform: 'gog',
    coverImage: gogGame.imgIconURL || 'placeholder_cover.svg', // Use imgIconURL as cover, or a placeholder
    playtime: playtimeHours,
    lastPlayed: defaultLastPlayed,
    achievements: gogGame.achievements, // Use achievements data from backend (defaulted)
    status: defaultStatus,
    genre: defaultGenre,
    releaseYear: defaultReleaseYear,
  };
};


export const GameLibrary = ({ selectedPlatform, onPlatformChange }: GameLibraryProps) => {
  const { steamId, steamUser } = useSteam();
  const { gogUserId } = useGog();
  const { xboxGames: xboxGamesFromContext, isLoading: isLoadingXbox, error: errorXbox } = useXbox(); // Get Xbox data

  const [searchTerm, setSearchTerm] = useState("");
  const [steamGames, setSteamGames] = useState<SteamGame[]>([]);
  const [isLoadingSteamGames, setIsLoadingSteamGames] = useState<boolean>(false);
  const [steamGamesError, setSteamGamesError] = useState<string | null>(null);

  // GOG state variables
  const [gogGames, setGogGames] = useState<GogGame[]>([]);
  const [isLoadingGogGames, setIsLoadingGogGames] = useState<boolean>(false);
  const [gogGamesError, setGogGamesError] = useState<string | null>(null);

  // No local state for xboxGamesData needed, will map directly from xboxGamesFromContext

  useEffect(() => {
    if (steamId) {
      const fetchSteamGames = async () => {
        setIsLoadingSteamGames(true);
        setSteamGamesError(null);
        setSteamGames([]);
        try {
          const response = await fetch(`/api/steam/user/${steamId}/games`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error: ${response.status}`);
          }
          const data: SteamGame[] = await response.json();
          setSteamGames(data);
        } catch (err) {
          setSteamGamesError(err instanceof Error ? err.message : 'Failed to fetch Steam games');
          console.error(err);
        } finally {
          setIsLoadingSteamGames(false);
        }
      };
      fetchSteamGames();
    } else {
      // Clear Steam games if steamId from context is removed or null
      setSteamGames([]);
      setSteamGamesError(null);
    }
  }, [steamId]); // Effect now depends on steamId from context

  // useEffect to fetch GOG games
  useEffect(() => {
    // Using gogUserId from context now
    if (gogUserId) {
      const fetchGogGames = async () => {
        setIsLoadingGogGames(true);
        setGogGamesError(null);
        setGogGames([]);
        try {
          // Ensure the gogUserId from context is used in the API call URL
          const response = await fetch(`/api/gog/user/${gogUserId}/games`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error: ${response.status}`);
          }
          const data: GogGame[] = await response.json();
          setGogGames(data);
        } catch (err) {
          setGogGamesError(err instanceof Error ? err.message : 'Failed to fetch GOG games');
          console.error("Error fetching GOG games:", err);
        } finally {
          setIsLoadingGogGames(false);
        }
      };
      fetchGogGames();
    } else {
      // Clear GOG games if gogUserId is removed or null
      setGogGames([]);
      setGogGamesError(null);
    }
  }, [gogUserId]); // Dependency is now the gogUserId from context

// Helper to convert XboxGame to Game for consistent display
const mapXboxGameToGenericGame = (xboxGame: XboxGame): Game | null => {
  if (!xboxGame || !xboxGame.titleId) {
    console.warn('Skipping Xbox game with missing or invalid titleId:', xboxGame);
    return null;
  }

  const gameTitle = xboxGame.name || 'Unknown Xbox Game';

  return {
    id: `xbox-${xboxGame.titleId}`, // Unique ID for React keys
    title: gameTitle,
    platform: 'xbox',
    coverImage: xboxGame.displayImage || '/placeholder.svg', // Ensure placeholder.svg is in public
    playtime: 0, // Playtime not available from this Xbox API
    lastPlayed: xboxGame.lastUpdated || new Date(0).toISOString(), // Use lastUpdated from API, or epoch
    achievements: {
      unlocked: xboxGame.achievements.currentAchievements,
      total: xboxGame.achievements.totalAchievements,
      currentGamerscore: xboxGame.achievements.currentGamerscore,
      totalGamerscore: xboxGame.achievements.totalGamerscore,
    },
    status: 'owned', // Assume 'owned', can be 'not_installed' if preferred
    genre: ['Unknown Genre'], // Xbox API (titles) doesn't provide genre
    releaseYear: 0, // Xbox API (titles) doesn't provide release year
  };
};

  const allGames = [
    ...(steamGames.map(steamGameToGameType).filter(Boolean) as Game[]),
    ...(gogGames.map(gogGameToGameType).filter(Boolean) as Game[]),
    ...(xboxGamesFromContext.map(mapXboxGameToGenericGame).filter(Boolean) as Game[])
  ];

  const currentPlatformInfo: PlatformInfo = {
    ...platformInfo,
    steam: { name: 'Steam', color: '#1b2838', icon: () => <Download /> } // Example, adjust as needed
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
      if (f.key === 'xbox' && !errorXbox) return true; // Show if no error, implies an attempt was made or is possible
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

      {isLoadingSteamGames && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <p className="text-muted-foreground">Loading Steam games...</p>
          </CardContent>
        </Card>
      )}
      {steamGamesError && !isLoadingSteamGames && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Error Loading Steam Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{steamGamesError}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please ensure your Steam ID is correct and your profile is public. You can reconfigure the Steam connection in Platform Connections.
            </p>
          </CardContent>
        </Card>
      )}

      {/* GOG Games Loading State */}
      {isLoadingGogGames && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <p className="text-muted-foreground">Loading GOG games...</p>
          </CardContent>
        </Card>
      )}
      {/* GOG Games Error State */}
      {gogGamesError && !isLoadingGogGames && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Error Loading GOG Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{gogGamesError}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Could not fetch your GOG games. The GOG integration is experimental. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Xbox Games Loading State */}
      {isLoadingXbox && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <p className="text-muted-foreground">Loading Xbox games...</p>
          </CardContent>
        </Card>
      )}
      {/* Xbox Games Error State */}
      {errorXbox && !isLoadingXbox && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Error Loading Xbox Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{errorXbox}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Could not fetch your Xbox games. Ensure your XUID is correct and your profile privacy settings allow access.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>

      {filteredGames.length === 0 && !isLoadingSteamGames && !isLoadingGogGames && !isLoadingXbox && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No games found</h3>
            <p className="text-muted-foreground text-center">
              {selectedPlatform === 'steam' && steamId && !steamGamesError && steamGames.length === 0 ? 'No Steam games to display or library is private.' :
               selectedPlatform === 'gog' && gogUserId && !gogGamesError && gogGames.length === 0 ? 'No GOG games to display.' :
               selectedPlatform === 'xbox' && !errorXbox && xboxGamesFromContext.length === 0 ? 'No Xbox games to display or profile is private.' :
               'Try adjusting your search or platform filter.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
