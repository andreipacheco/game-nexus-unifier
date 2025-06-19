
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Added CardHeader, CardTitle, CardDescription
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Game } from "@/types/gameTypes";
import { platformInfo } from "@/config/platformConfig";
type PlatformInfo = typeof platformInfo;
import { Clock, Trophy, Play, Download, Search, AlertTriangle, Loader2 } from "lucide-react"; // Added AlertTriangle, Loader2
import { Input } from "@/components/ui/input";
import { GameCard } from "./GameCard";

// SteamGame and GogGame interfaces are now in src/lib/gameUtils.ts

interface GameLibraryProps {
  games: Game[]; // Existing games (e.g., from other platforms or manual entries)
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
  // steamId?: string; // Steam ID will now come from context
}

import { useSteam } from "@/contexts/SteamContext";
import { useGog } from "@/contexts/GogContext";
import { useXbox } from "@/contexts/XboxContext"; // Import useXbox
import type { XboxGame } from "@/contexts/XboxContext"; // Import XboxGame type
import { usePsn } from '@/contexts/PsnContext'; // Import usePsn
import type { PsnGame } from '@/contexts/PsnContext'; // Import PsnGame type

// Transformation functions (steamGameToGameType, gogGameToGameType, mapXboxGameToGenericGame, psnGameToGameType)
// are now in src/lib/gameUtils.ts

export const GameLibrary = (props: GameLibraryProps & {
  isLoadingSteam?: boolean;
  steamError?: Error | null;
  isLoadingGog?: boolean;
  gogError?: Error | null;
  isLoadingXbox?: boolean;
  xboxError?: Error | null; // Changed from string to Error | null
  isLoadingPsn?: boolean;
  psnError?: Error | null;
}) => {
  const {
    games, // Renamed back from gamesFromProps
    selectedPlatform,
    onPlatformChange,
    isLoadingSteam,
    steamError,
    isLoadingGog,
    gogError,
    isLoadingXbox,
    xboxError,
    isLoadingPsn,
    psnError
  } = props;

  const { steamId, steamUser } = useSteam();
  const { gogUserId } = useGog();
  // Xbox and PSN contexts are used for connection status/profile data, not game lists.
  const { /* games: xboxGamesFromContext, */ /* isLoading: isLoadingXbox, error: errorXbox */ xuid } = useXbox();
  const { /* games: psnGamesFromContext, */ /* isLoadingGames: isLoadingPsnGames, errorGames: errorPsnGames, */ isConnected: isPsnConnected, psnProfile } = usePsn();

  const [searchTerm, setSearchTerm] = useState("");

  // Game data is now received directly via the `games` prop.
  // No local state or effects needed for fetching or combining game lists here.
  const allGames = games; // Use the `games` prop directly

  const currentPlatformInfo: PlatformInfo = { // This might be simplified if platformInfo from config is sufficient
    ...platformInfo,
    // Specific overrides if necessary, otherwise platformInfo from config should be used.
    // For example, if icons or colors need to be dynamically determined here.
    // If not, this could be simplified to just use platformInfo directly.
    steam: { ...platformInfo.steam, icon: () => <Download /> },
    gog: { ...platformInfo.gog, icon: () => <Play /> },
    xbox: { ...platformInfo.xbox, icon: () => <Play /> },
    psn: { ...platformInfo.psn, icon: () => <Play /> },
  };

  const SsearchTermLowerCase = searchTerm.toLowerCase();

  const filteredGames = allGames.filter(game => { // `allGames` is now directly from `props.games`
    const gamePlatform = game.platform?.toLowerCase() || '';
    const gameTitle = game.title?.toLowerCase() || '';
    // Assuming game.genre is an array of strings
    const gameGenres = Array.isArray(game.genre) ? game.genre.map(g => g.toLowerCase()) : [];

    const matchesPlatform = selectedPlatform === 'all' || gamePlatform === selectedPlatform.toLowerCase();

    let matchesSearch = false;
    if (SsearchTermLowerCase === '') {
      matchesSearch = true; // Show all if search term is empty
    } else {
      matchesSearch = gameTitle.includes(SsearchTermLowerCase) ||
                      gamePlatform.includes(SsearchTermLowerCase) ||
                      gameGenres.some(genre => genre.includes(SsearchTermLowerCase));
    }
    return matchesPlatform && matchesSearch;
  });

  const platformFilters = [
    { key: 'all', name: 'All Platforms', count: allGames.length },
    ...Object.keys(platformInfo).map((key) => {
      const platformGames = allGames.filter(game => game.platform === key);
      return {
        key,
        name: platformInfo[key as keyof typeof platformInfo].name,
        count: platformGames.length,
      };
    })
  ].filter(f => {
    if (f.key === 'all') return true;
    // Show filter if games exist for this platform
    if (f.count > 0) return true;
    // Or if the user is connected to the platform (even if 0 games yet)
    if (f.key === 'steam' && steamId) return true;
    if (f.key === 'gog' && gogUserId) return true;
    // Check for Xbox connection via xuid from useXbox() or if games for xbox are present (even if 0 after filtering)
    if (f.key === 'xbox' && (xuid || allGames.some(g => g.platform === 'xbox'))) return true;
    if (f.key === 'psn' && (isPsnConnected || allGames.some(g => g.platform === 'psn'))) return true;
    return false;
  });

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

      {/* Display loading/error states based on props from Index.tsx */}
      {isLoadingSteam && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <p className="text-muted-foreground">Loading Steam games...</p>
          </CardContent>
        </Card>
      )}
      {steamError && !isLoadingSteam && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Error Loading Steam Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{steamError.message}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please ensure your Steam ID is correct and your profile is public. You can reconfigure the Steam connection in Platform Connections.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoadingGog && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <p className="text-muted-foreground">Loading GOG games...</p>
          </CardContent>
        </Card>
      )}
      {gogError && !isLoadingGog && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Error Loading GOG Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{gogError.message}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Could not fetch your GOG games. The GOG integration is experimental. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoadingXbox && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <p className="text-muted-foreground">Loading Xbox games...</p>
          </CardContent>
        </Card>
      )}
      {xboxError && !isLoadingXbox && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Error Loading Xbox Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{xboxError.message}</p> {/* Use .message for Error objects */}
            <p className="text-sm text-muted-foreground mt-1">
              Could not fetch your Xbox games. Ensure your XUID is correct and your profile privacy settings allow access.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoadingPsn && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <p className="text-muted-foreground">Loading PSN games...</p>
          </CardContent>
        </Card>
      )}
      {psnError && !isLoadingPsn && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Error Loading PSN Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{psnError.message}</p> {/* Use .message for Error objects */}
            <p className="text-sm text-muted-foreground mt-1">
              Could not fetch your PSN games. Please ensure your account is connected and try again later.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>

      {filteredGames.length === 0 && !isLoadingSteam && !isLoadingGog && !isLoadingXbox && !isLoadingPsn && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No games found</h3>
            <p className="text-muted-foreground text-center">
              {selectedPlatform === 'all' && allGames.length === 0 && 'No games found for any platform. Connect your accounts or check again later.'}
              {selectedPlatform !== 'all' && allGames.length === 0 && `No ${selectedPlatform} games found or account not connected.`}
              {allGames.length > 0 && 'Try adjusting your search or platform filter.'}

            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Transformation functions are no longer defined or needed in this file.
