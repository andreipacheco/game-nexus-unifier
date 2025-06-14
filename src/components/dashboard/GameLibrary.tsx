
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Added CardHeader, CardTitle, CardDescription
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Game, platformInfo, PlatformInfo } from "@/data/mockGameData"; // Added PlatformInfo
import { Clock, Trophy, Play, Download, Search, AlertTriangle, Loader2 } from "lucide-react"; // Added AlertTriangle, Loader2
import { Input } from "@/components/ui/input";
import { GameCard } from "./GameCard";

// Basic interface for Steam games (adapt as needed based on actual API response)
interface SteamGame {
  appID: number;
  name: string;
  playtimeForever: number;
  imgIconURL: string;
  // Potentially add more fields like imgLogoURL for better display
}

interface GameLibraryProps {
  games: Game[]; // Existing games (e.g., from other platforms or manual entries)
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
  // steamId?: string; // Steam ID will now come from context
}

import { useSteam } from "@/contexts/SteamContext"; // Import useSteam

// Helper to convert SteamGame to Game for consistent display, or GameCard could be adapted
const steamGameToGameType = (steamGame: SteamGame): Game => ({
  id: `steam-${steamGame.appID}`,
  title: steamGame.name,
  platform: 'steam', // Special platform key for Steam games
  genre: 'Unknown', // Steam API doesn't typically provide genre directly in owned games list
  releaseDate: 'Unknown',
  imageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${steamGame.appID}/header.jpg`, // Construct image URL
  playtime: steamGame.playtimeForever / 60, // Convert minutes to hours
  achievements: { current: 0, total: 0 }, // Placeholder, as fetching achievements is a separate call
  rating: 0, // Placeholder
  status: 'owned',
});


export const GameLibrary = ({ games, selectedPlatform, onPlatformChange }: GameLibraryProps) => {
  const { steamId, steamUser } = useSteam(); // Get steamId and steamUser from context
  const [searchTerm, setSearchTerm] = useState("");
  const [steamGames, setSteamGames] = useState<SteamGame[]>([]);
  const [isLoadingSteamGames, setIsLoadingSteamGames] = useState<boolean>(false);
  const [steamGamesError, setSteamGamesError] = useState<string | null>(null);

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

  const allGames = [
    ...games,
    ...steamGames.map(steamGameToGameType)
  ];

  const currentPlatformInfo: PlatformInfo = { // Add steam to platformInfo if not already there for filtering
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
  ].filter(f => f.count > 0 || f.key === 'all' || (f.key === 'steam' && steamId && steamUser)); // Ensure Steam filter shows if steamId & User is present in context

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>

      {filteredGames.length === 0 && !isLoadingSteamGames && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No games found</h3>
            <p className="text-muted-foreground text-center">
              {selectedPlatform === 'steam' && steamId && !steamGamesError ? 'No Steam games to display or library is private.' : 'Try adjusting your search or platform filter.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
