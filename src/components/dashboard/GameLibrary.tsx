import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Game, platformInfo as defaultPlatformInfo, PlatformInfo } from "@/data/mockGameData";
import { Download, Search, AlertTriangle, Loader2 } from "lucide-react"; // Removed unused icons like Clock, Trophy, Play
import { Input } from "@/components/ui/input";
import { GameCard } from "./GameCard";

// Contexts and Types
import { useSteam } from "@/contexts/SteamContext";
import { useGog } from "@/contexts/GogContext";
import { useXbox } from "@/contexts/XboxContext";
import type { XboxGame } from "@/contexts/XboxContext";
import { usePlaystation } from "../../../contexts/PlaystationContext"; // Adjusted path
import type { PlaystationGame } from "../../../contexts/PlaystationContext"; // Adjusted path

// Interfaces for fetched game data before mapping
interface SteamGame {
  appID: number;
  name: string;
  playtimeForever: number;
  imgIconURL: string;
  achievements: { unlocked: number; total: number; };
}

interface GogGame {
  appID: string;
  name: string;
  imgIconURL: string;
  playtimeForever: number;
  achievements: { unlocked: number; total: number; };
}

interface GameLibraryProps {
  games: Game[]; // Existing games (e.g., from other platforms or manual entries)
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
}

// --- Game Type Mapping Functions ---

const steamGameToGameType = (steamGame: SteamGame): Game | null => {
  if (!steamGame || typeof steamGame.appID === 'undefined' || steamGame.appID === null) return null;
  return {
    id: `steam-${steamGame.appID.toString()}`,
    appId: steamGame.appID.toString(),
    title: steamGame.name || 'Unknown Steam Game',
    platform: 'steam',
    coverImage: `https://cdn.akamai.steamstatic.com/steam/apps/${steamGame.appID}/header.jpg`,
    playtime: typeof steamGame.playtimeForever === 'number' ? Math.round(steamGame.playtimeForever / 60) : 0,
    lastPlayed: new Date(0).toISOString(), // Placeholder
    achievements: steamGame.achievements,
    status: 'not_installed', // Placeholder
    genre: ['Unknown Genre'],
    releaseYear: 0,
  };
};

const gogGameToGameType = (gogGame: GogGame): Game | null => {
  if (!gogGame || typeof gogGame.appID === 'undefined' || gogGame.appID === null) return null;
  return {
    id: `gog-${gogGame.appID}`,
    title: gogGame.name || 'Unknown GOG Game',
    platform: 'gog',
    coverImage: gogGame.imgIconURL || '/placeholder.svg',
    playtime: gogGame.playtimeForever,
    lastPlayed: new Date(0).toISOString(), // Placeholder
    achievements: gogGame.achievements,
    status: 'owned',
    genre: ['Unknown Genre'],
    releaseYear: 0,
  };
};

const mapXboxGameToGenericGame = (xboxGame: XboxGame): Game | null => {
  if (!xboxGame || !xboxGame.titleId) return null;
  return {
    id: `xbox-${xboxGame.titleId}`,
    title: xboxGame.name || 'Unknown Xbox Game',
    platform: 'xbox',
    coverImage: xboxGame.displayImage || '/placeholder.svg',
    playtime: 0,
    lastPlayed: xboxGame.lastUpdated || new Date(0).toISOString(),
    achievements: {
      unlocked: xboxGame.achievements.currentAchievements,
      total: xboxGame.achievements.totalAchievements,
      currentGamerscore: xboxGame.achievements.currentGamerscore,
      totalGamerscore: xboxGame.achievements.totalGamerscore,
    },
    status: 'owned',
    genre: ['Unknown Genre'],
    releaseYear: 0,
  };
};

const mapPlaystationGameToGenericGame = (psGame: PlaystationGame): Game | null => {
  if (!psGame || !psGame.npCommunicationId) return null;
  const gameTitle = psGame.name || 'Unknown Playstation Game';
  const earnedTrophiesCount = (psGame.trophySummary?.earnedTrophies?.bronze || 0) +
                              (psGame.trophySummary?.earnedTrophies?.silver || 0) +
                              (psGame.trophySummary?.earnedTrophies?.gold || 0) +
                              (psGame.trophySummary?.earnedTrophies?.platinum || 0);
  const definedTrophiesCount = (psGame.trophySummary?.definedTrophies?.bronze || 0) +
                               (psGame.trophySummary?.definedTrophies?.silver || 0) +
                               (psGame.trophySummary?.definedTrophies?.gold || 0) +
                               (psGame.trophySummary?.definedTrophies?.platinum || 0);
  return {
    id: `playstation-${psGame.npCommunicationId}`,
    appId: psGame.npCommunicationId,
    title: gameTitle,
    platform: 'playstation',
    coverImage: psGame.image || '/placeholder.svg',
    playtime: 0,
    lastPlayed: psGame.lastUpdatedDateTime, // Trophy data last update time
    achievements: { unlocked: earnedTrophiesCount, total: definedTrophiesCount },
    status: 'owned',
    genre: ['Unknown Genre'],
    releaseYear: 0,
  };
};

// --- Component Definition ---
export const GameLibrary = ({ games: manualGames, selectedPlatform, onPlatformChange }: GameLibraryProps) => {
  // Context Hooks
  const { steamId, steamUser } = useSteam();
  const { gogUserId } = useGog();
  const { xboxGames: xboxGamesFromContext, isLoading: isLoadingXbox, error: errorXbox } = useXbox();
  const {
    playstationGames: playstationGamesFromContext,
    isLoadingPlaystation,
    errorPlaystation,
    npssoToken
  } = usePlaystation();

  // Local State for fetched games & UI
  const [searchTerm, setSearchTerm] = useState("");
  const [steamGamesLocal, setSteamGamesLocal] = useState<SteamGame[]>([]);
  const [isLoadingSteamGames, setIsLoadingSteamGames] = useState<boolean>(false);
  const [steamGamesError, setSteamGamesError] = useState<string | null>(null);
  const [gogGamesLocal, setGogGamesLocal] = useState<GogGame[]>([]);
  const [isLoadingGogGames, setIsLoadingGogGames] = useState<boolean>(false);
  const [gogGamesError, setGogGamesError] = useState<string | null>(null);

  // Effect for Steam Games
  useEffect(() => {
    if (steamId) {
      const fetchSteamGames = async () => {
        setIsLoadingSteamGames(true);
        setSteamGamesError(null);
        setSteamGamesLocal([]);
        try {
          const response = await fetch(`/api/steam/user/${steamId}/games`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error: ${response.status}`);
          }
          const data: SteamGame[] = await response.json();
          setSteamGamesLocal(data);
        } catch (err) {
          setSteamGamesError(err instanceof Error ? err.message : 'Failed to fetch Steam games');
        } finally {
          setIsLoadingSteamGames(false);
        }
      };
      fetchSteamGames();
    } else {
      setSteamGamesLocal([]);
      setSteamGamesError(null);
    }
  }, [steamId]);

  // Effect for GOG Games
  useEffect(() => {
    if (gogUserId) {
      const fetchGogGames = async () => {
        setIsLoadingGogGames(true);
        setGogGamesError(null);
        setGogGamesLocal([]);
        try {
          const response = await fetch(`/api/gog/user/${gogUserId}/games`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error: ${response.status}`);
          }
          const data: GogGame[] = await response.json();
          setGogGamesLocal(data);
        } catch (err) {
          setGogGamesError(err instanceof Error ? err.message : 'Failed to fetch GOG games');
        } finally {
          setIsLoadingGogGames(false);
        }
      };
      fetchGogGames();
    } else {
      setGogGamesLocal([]);
      setGogGamesError(null);
    }
  }, [gogUserId]);

  // Consolidate all games
  const allGames: Game[] = [
    ...manualGames,
    ...(steamGamesLocal.map(steamGameToGameType).filter(Boolean) as Game[]),
    ...(gogGamesLocal.map(gogGameToGameType).filter(Boolean) as Game[]),
    ...(xboxGamesFromContext.map(mapXboxGameToGenericGame).filter(Boolean) as Game[]),
    ...(playstationGamesFromContext.map(mapPlaystationGameToGenericGame).filter(Boolean) as Game[])
  ];

  // Platform info for filters - extendable
  const currentPlatformInfo: PlatformInfo = {
    ...defaultPlatformInfo, // Includes any defaults from mockGameData
    steam: { name: 'Steam', color: '#1b2838', icon: () => <Download /> },
    gog: { name: 'GOG', color: '#7b2f9c', icon: () => <Download /> },
    xbox: { name: 'Xbox', color: '#107c10', icon: () => <Download /> },
    playstation: { name: 'Playstation', color: '#0070d1', icon: () => <Download /> }
  };

  const SsearchTermLowerCase = searchTerm.toLowerCase();
  const filteredGames = allGames.filter(game => {
    const matchesPlatform = selectedPlatform === 'all' ||
                            (game.platform && game.platform.toLowerCase() === selectedPlatform.toLowerCase());
    let matchesSearch = true;
    if (SsearchTermLowerCase) {
      matchesSearch = (game.title?.toLowerCase() || '').includes(SsearchTermLowerCase) ||
                      (game.platform?.toLowerCase() || '').includes(SsearchTermLowerCase) ||
                      (game.genre?.some(g => g.toLowerCase().includes(SsearchTermLowerCase))) || false;
    }
    return matchesPlatform && matchesSearch;
  });

  const platformFilters = [
    { key: 'all', name: 'All Platforms', count: allGames.length },
    ...Object.entries(currentPlatformInfo)
      .map(([key, info]) => ({
        key,
        name: info.name,
        count: allGames.filter(game => game.platform === key).length
      }))
      .filter(f => {
        if (f.key === 'all') return true; // Should already be handled, but for clarity
        if (f.count > 0) return true;
        // Show filter if user is "connected" to the platform, even if count is 0
        if (f.key === 'steam' && steamId) return true;
        if (f.key === 'gog' && gogUserId) return true;
        // For Xbox, show if games are loaded or no error (implies connection attempt)
        if (f.key === 'xbox' && (xboxGamesFromContext?.length > 0 || (!isLoadingXbox && !errorXbox && selectedPlatform === 'xbox'))) return true;
        if (f.key === 'playstation' && npssoToken) return true;
        return false;
      })
  ];
  // Ensure 'all' is always first if it got filtered out by mistake by above logic
  if (!platformFilters.find(pf => pf.key === 'all') && allGames.length > 0) {
      platformFilters.unshift({ key: 'all', name: 'All Platforms', count: allGames.length });
  } else if (platformFilters.length > 1 && platformFilters[0].key !== 'all') {
      // If 'all' is not first and there are other filters, move 'all' to front
      const allFilterIndex = platformFilters.findIndex(pf => pf.key === 'all');
      if (allFilterIndex > 0) {
          const [allFilter] = platformFilters.splice(allFilterIndex, 1);
          platformFilters.unshift(allFilter);
      }
  }


  // --- JSX Rendering ---
  return (
    <div className="space-y-6">
      {/* Filters and Search Bar */}
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
              <Badge variant="secondary" className="ml-1">{filter.count}</Badge>
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

      {/* Loading States */}
      {isLoadingSteamGames && <LoadingIndicator message="Loading Steam games..." />}
      {isLoadingGogGames && <LoadingIndicator message="Loading GOG games..." />}
      {isLoadingXbox && <LoadingIndicator message="Loading Xbox games..." />}
      {isLoadingPlaystation && <LoadingIndicator message="Loading Playstation games..." />}

      {/* Error States */}
      {steamGamesError && <ErrorDisplay platformName="Steam" error={steamGamesError} advice="Ensure Steam ID is correct and profile public." />}
      {gogGamesError && <ErrorDisplay platformName="GOG" error={gogGamesError} advice="GOG integration is experimental. Try again later." />}
      {errorXbox && <ErrorDisplay platformName="Xbox" error={errorXbox} advice="Ensure XUID is correct and profile privacy allows access." />}
      {errorPlaystation && <ErrorDisplay platformName="Playstation" error={errorPlaystation} advice="Ensure NPSSO token is correct/valid. Re-enter in Platform Connections." />}

      {/* Game Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>

      {/* No Games Found Message */}
      {filteredGames.length === 0 && !isLoadingSteamGames && !isLoadingGogGames && !isLoadingXbox && !isLoadingPlaystation && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No games found</h3>
            <p className="text-muted-foreground text-center">
              {getNoGamesMessage()}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Helper for loading indicator
  function LoadingIndicator({ message }: { message: string }) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
          <p className="text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    );
  }

  // Helper for error display
  function ErrorDisplay({ platformName, error, advice }: { platformName: string; error: string; advice: string; }) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Error Loading {platformName} Games
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
          <p className="text-sm text-muted-foreground mt-1">{advice}</p>
        </CardContent>
      </Card>
    );
  }

  // Helper for "No Games" message
  function getNoGamesMessage() {
    if (selectedPlatform === 'all' && allGames.length === 0 && !searchTerm) return 'No games found across any connected platform. Connect a platform to see your games.';
    if (searchTerm && filteredGames.length === 0) return 'No games match your current search or filters.';
    if (selectedPlatform === 'steam' && steamId && !steamGamesError && steamGamesLocal.length === 0) return 'No Steam games to display or library is private.';
    if (selectedPlatform === 'gog' && gogUserId && !gogGamesError && gogGamesLocal.length === 0) return 'No GOG games to display.';
    if (selectedPlatform === 'xbox' && !errorXbox && xboxGamesFromContext.length === 0) return 'No Xbox games to display or profile is private/XUID invalid.';
    if (selectedPlatform === 'playstation' && npssoToken && !errorPlaystation && playstationGamesFromContext.length === 0) return 'No Playstation games to display or NPSSO token is invalid/no games with trophies.';
    if (selectedPlatform !== 'all' && !searchTerm) return `No ${selectedPlatform} games found. Ensure the platform is connected and games are synced.`;
    return 'Try adjusting your search or platform filter.';
  }
};
