import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PlatformStats } from "@/components/dashboard/PlatformStats";
import { GameLibrary } from "@/components/dashboard/GameLibrary";
import { PlatformConnections } from "@/components/dashboard/PlatformConnections";
import { mockGameData, Game } from "@/data/mockGameData";
import { useSteam } from "@/context/SteamContext";
import { useGog } from "@/context/GogContext";
import { SteamGame, GogGame } from "@/types";

// Helper function to convert SteamGame to Game type
const steamGameToGameType = (steamGame: SteamGame): Game | null => {
  if (!steamGame || typeof steamGame !== 'object' || typeof steamGame.appid === 'undefined') {
    console.warn('Skipping invalid Steam game data:', steamGame);
    return null;
  }

  // Ensure achievements structure is valid, providing a default if not.
  // The backend (server/routes/steam.js) is expected to provide this structure.
  const achievements = (steamGame.achievements &&
                        typeof steamGame.achievements.unlocked === 'number' &&
                        typeof steamGame.achievements.total === 'number')
                       ? steamGame.achievements
                       : { unlocked: 0, total: 0 };

  return {
    id: `steam-${steamGame.appid}`,
    appId: steamGame.appid.toString(),
    title: steamGame.name || 'Unknown Steam Game',
    platform: 'steam',
    coverImage: `https://cdn.akamai.steamstatic.com/steam/apps/${steamGame.appid}/header.jpg`,
    playtime: typeof steamGame.playtime_forever === 'number' ? Math.round(steamGame.playtime_forever / 60) : 0,
    lastPlayed: steamGame.rtime_last_played && typeof steamGame.rtime_last_played === 'number' && steamGame.rtime_last_played > 0
                ? new Date(steamGame.rtime_last_played * 1000).toISOString()
                : new Date(0).toISOString(),
    achievements: achievements,
    status: 'not_installed', // Default as per instructions
    genre: ['Unknown Genre'], // Default as per instructions
    releaseYear: 0, // Default as per instructions
  };
};

// Helper function to convert GogGame to Game type
const gogGameToGameType = (gogGame: GogGame): Game | null => {
  if (!gogGame || typeof gogGame !== 'object' || typeof gogGame.id === 'undefined') {
    console.warn('Skipping invalid GOG game data:', gogGame);
    return null;
  }

  // Backend for GOG (server/routes/gog.js) might default achievements.
  // Ensure structure is valid here too.
  const achievements = (gogGame.achievements &&
                        typeof gogGame.achievements.unlocked === 'number' &&
                        typeof gogGame.achievements.total === 'number')
                       ? gogGame.achievements
                       : { unlocked: 0, total: 0 };

  let lastPlayedIso = new Date(0).toISOString();
  if (gogGame.lastPlayed) {
    // Check if it's a number (timestamp) or string (ISO)
    if (typeof gogGame.lastPlayed === 'number') {
      lastPlayedIso = new Date(gogGame.lastPlayed * 1000).toISOString(); // Assuming seconds timestamp
    } else if (typeof gogGame.lastPlayed === 'string' && !isNaN(Date.parse(gogGame.lastPlayed))) {
      lastPlayedIso = new Date(gogGame.lastPlayed).toISOString();
    }
  }


  return {
    id: `gog-${gogGame.id}`,
    appId: gogGame.id.toString(),
    title: gogGame.title || 'Unknown GOG Game',
    platform: 'gog',
    coverImage: gogGame.image || '/placeholder.svg', // Default as per instructions
    playtime: typeof gogGame.playtime === 'number' ? gogGame.playtime : 0,
    lastPlayed: lastPlayedIso,
    achievements: achievements,
    status: 'owned', // Default as per instructions
    genre: Array.isArray(gogGame.genres) && gogGame.genres.every(g => typeof g === 'string')
           ? gogGame.genres
           : ['Unknown Genre'], // Default as per instructions
    releaseYear: typeof gogGame.releaseYear === 'number' ? gogGame.releaseYear : 0, // Default as per instructions
  };
};


const Index = () => {
  const [activeView, setActiveView] = useState<'library' | 'connections'>('library');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  const nonSteamMockGames = mockGameData.filter(game => game.platform !== 'steam' && game.platform !== 'gog');
  const [allGames, setAllGames] = useState<Game[]>(nonSteamMockGames);

  const [steamGamesFetched, setSteamGamesFetched] = useState<SteamGame[]>([]);
  const [gogGamesFetched, setGogGamesFetched] = useState<GogGame[]>([]);

  const [isLoadingSteam, setIsLoadingSteam] = useState<boolean>(false);
  const [steamError, setSteamError] = useState<string | null>(null);
  const [isLoadingGog, setIsLoadingGog] = useState<boolean>(false);
  const [gogError, setGogError] = useState<string | null>(null);

  const { steamId } = useSteam();
  const { gogUserId } = useGog();

  // Fetch Steam games
  useEffect(() => {
    if (steamId) {
      setIsLoadingSteam(true);
      setSteamError(null);
      fetch(`/api/steam/user/${steamId}/games`)
        .then(res => {
          if (!res.ok) {
            return res.json().then(errData => { // Try to parse error body
              throw new Error(errData.error || `Failed to fetch Steam games: ${res.statusText}`);
            });
          }
          return res.json();
        })
        .then(data => {
          setSteamGamesFetched(data.response?.games || []);
        })
        .catch(err => {
          setSteamError(err.message);
          setSteamGamesFetched([]);
        })
        .finally(() => {
          setIsLoadingSteam(false);
        });
    } else {
      setSteamGamesFetched([]);
      setSteamError(null); // Clear error when steamId is not present
    }
  }, [steamId]);

  // Fetch GOG games
  useEffect(() => {
    if (gogUserId) {
      setIsLoadingGog(true);
      setGogError(null);
      fetch(`/api/gog/user/${gogUserId}/games`)
        .then(res => {
          if (!res.ok) {
            return res.json().then(errData => { // Try to parse error body
              throw new Error(errData.message || `Failed to fetch GOG games: ${res.statusText}`);
            });
          }
          return res.json();
        })
        .then(data => {
          // Assuming the GOG API returns an object with a 'games' array (like the Steam one does with 'response.games')
          // Or if it returns the array directly, it would be `data || []`
          setGogGamesFetched(data.games || (Array.isArray(data) ? data : []) );
        })
        .catch(err => {
          setGogError(err.message);
          setGogGamesFetched([]);
        })
        .finally(() => {
          setIsLoadingGog(false);
        });
    } else {
      setGogGamesFetched([]);
      setGogError(null); // Clear error when gogUserId is not present
    }
  }, [gogUserId]);

  // Merge games from all sources
  useEffect(() => {
    const mappedSteamGames = steamGamesFetched
      .map(steamGameToGameType)
      .filter((game): game is Game => game !== null);

    const mappedGogGames = gogGamesFetched
      .map(gogGameToGameType)
      .filter((game): game is Game => game !== null);

    setAllGames([...nonSteamMockGames, ...mappedSteamGames, ...mappedGogGames]);
  }, [steamGamesFetched, gogGamesFetched, nonSteamMockGames]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader 
        activeView={activeView} 
        onViewChange={setActiveView}
      />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        {activeView === 'library' ? (
          <>
            {isLoadingSteam && <p>Loading Steam games...</p>}
            {steamError && <p className="text-red-500">Error loading Steam games: {steamError}</p>}
            {isLoadingGog && <p>Loading GOG games...</p>}
            {gogError && <p className="text-red-500">Error loading GOG games: {gogError}</p>}

            <PlatformStats games={allGames} />
            <GameLibrary 
              games={allGames}
              selectedPlatform={selectedPlatform}
              onPlatformChange={setSelectedPlatform}
            />
          </>
        ) : (
          <PlatformConnections />
        )}
      </main>
    </div>
  );
};

export default Index;
