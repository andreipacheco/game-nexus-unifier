import { useState } from "react"; // Removed useEffect
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Game, platformInfo, PlatformInfo } from "@/data/mockGameData";
import { Download, Search } from "lucide-react"; // Removed AlertTriangle, Loader2, Clock, Trophy, Play
import { Input } from "@/components/ui/input";
import { GameCard } from "./GameCard";
import { useSteam } from "@/contexts/SteamContext"; // Corrected path
import { useGog } from "@/contexts/GogContext";   // Corrected path

// Removed SteamGame and GogGame interfaces as fetching is handled in Index.tsx

interface GameLibraryProps {
  games: Game[]; // This prop will now contain all games (mock, Steam, GOG)
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
}

// Removed steamGameToGameType and gogGameToGameType helper functions

export const GameLibrary = ({ games, selectedPlatform, onPlatformChange }: GameLibraryProps) => {
  const { steamId, steamUser } = useSteam(); // Kept for steamUser and potentially steamId for UI elements
  const { gogUserId } = useGog(); // Kept for gogUserId for UI elements like platformFilters

  const [searchTerm, setSearchTerm] = useState("");

  // Removed state variables: steamGames, isLoadingSteamGames, steamGamesError
  // Removed state variables: gogGames, isLoadingGogGames, gogGamesError

  // Removed useEffect for fetching Steam games
  // Removed useEffect for fetching GOG games

  const allGames = games; // The games prop now contains all games

  const currentPlatformInfo: PlatformInfo = {
    ...platformInfo,
    steam: { name: 'Steam', color: '#1b2838', icon: () => <Download /> },
    gog: { name: 'GOG', color: '#8c5a93', icon: () => <Download /> } // Added GOG for consistency if needed
  };

  const SsearchTermLowerCase = searchTerm.toLowerCase();

  const filteredGames = allGames.filter(game => {
    const matchesPlatform = selectedPlatform === 'all' ||
                            (game.platform &&
                             typeof game.platform === 'string' &&
                             game.platform.toLowerCase() === selectedPlatform.toLowerCase());

    let matchesSearch = false;
    if (game.title && typeof game.title === 'string') {
      matchesSearch = matchesSearch || game.title.toLowerCase().includes(SsearchTermLowerCase);
    }
    if (game.platform && typeof game.platform === 'string') {
      matchesSearch = matchesSearch || game.platform.toLowerCase().includes(SsearchTermLowerCase);
    }
    if (Array.isArray(game.genre)) { // Ensure genre is an array before trying to join and search
      matchesSearch = matchesSearch || game.genre.join(" ").toLowerCase().includes(SsearchTermLowerCase);
    } else if (game.genre && typeof game.genre === 'string') { // Handle single string genre
        matchesSearch = matchesSearch || game.genre.toLowerCase().includes(SsearchTermLowerCase);
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
  ].filter(f =>
    f.count > 0 ||
    f.key === 'all' ||
    // Keep Steam filter visible if user is connected, even if 0 games (might be loading/error at parent)
    (f.key === 'steam' && steamId && steamUser) ||
    // Keep GOG filter visible if user is connected
    (f.key === 'gog' && gogUserId)
  );

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

      {/* Removed isLoadingSteamGames, steamGamesError, isLoadingGogGames, gogGamesError JSX */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>

      {filteredGames.length === 0 && ( // Simplified condition as loading states are handled by parent
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No games found</h3>
            <p className="text-muted-foreground text-center">
              Try adjusting your search or platform filter. If you've recently connected a new platform, data might still be loading.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
