
import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PlatformStats } from "@/components/dashboard/PlatformStats";
import { GameLibrary } from "@/components/dashboard/GameLibrary";
import { PlatformConnections } from "@/components/dashboard/PlatformConnections";
import { useSteam } from "@/contexts/SteamContext";
import { useXbox, XboxGame } from "@/contexts/XboxContext";
import { usePsn, PsnGame } from "@/contexts/PsnContext";
import { useGog } from "@/contexts/GogContext";
import { Game } from "@/types/gameTypes";
import {
  steamGameToGameType,
  gogGameToGameType,
  mapXboxGameToGenericGame,
  psnGameToGameType
} from "@/lib/gameUtils";

const Index = () => {
  const [activeView, setActiveView] = useState<'library' | 'connections'>('library');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  // Steam state
  const [steamGames, setSteamGames] = useState<any[]>([]);
  const [steamGamesError, setSteamGamesError] = useState<Error | null>(null);
  const [isLoadingSteamGames, setIsLoadingSteamGames] = useState<boolean>(false);

  // GOG state
  const [gogGames, setGogGames] = useState<any[]>([]);
  const [gogGamesError, setGogGamesError] = useState<Error | null>(null);
  const [isLoadingGogGames, setIsLoadingGogGames] = useState<boolean>(false);

  // Xbox state (from context)
  const { games: xboxGamesFromContext, isLoading: isLoadingXboxGames, error: xboxGamesError } = useXbox();

  // PSN state (from context)
  const { games: psnGames, isLoading: isLoadingPsnGames, error: psnGamesError } = usePsn();

  const { steamId } = useSteam(); // Removed fetchSteamGames from destructuring
  const { gogUserId } = useGog(); // Removed fetchGogGames from destructuring

  // useCallback for fetching Steam games
  const fetchSteamGames = useCallback(async () => {
    if (!steamId) {
      setSteamGames([]);
      setSteamGamesError(null); // Clear error if no steamId
      setIsLoadingSteamGames(false); // Not loading if no steamId
      return;
    }

    setIsLoadingSteamGames(true);
    setSteamGamesError(null); // Clear previous errors
    try {
      const response = await fetch(`/api/steam/user/${steamId}/games`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Try to parse error, default if not parsable
        throw new Error(errorData.error || `Error fetching Steam games: ${response.status}`);
      }
      const data = await response.json();
      setSteamGames(data || []); // Process data as a direct array
    } catch (err) {
      console.error("Error fetching Steam games:", err);
      setSteamGamesError(err instanceof Error ? err : new Error('Failed to fetch Steam games'));
      setSteamGames([]); // Clear games on error
    } finally {
      setIsLoadingSteamGames(false);
    }
  }, [steamId]);

  // useCallback for fetching GOG games
  const fetchGogGames = useCallback(async () => {
    if (!gogUserId) {
      setGogGames([]);
      setGogGamesError(null);
      setIsLoadingGogGames(false);
      return;
    }

    setIsLoadingGogGames(true);
    setGogGamesError(null);
    try {
      const response = await fetch(`/api/gog/user/${gogUserId}/games`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error fetching GOG games: ${response.status}`);
      }
      const data = await response.json();
      setGogGames(data || []); // GOG backend directly returns the array
    } catch (err) {
      console.error("Error fetching GOG games:", err);
      setGogGamesError(err instanceof Error ? err : new Error('Failed to fetch GOG games'));
      setGogGames([]);
    } finally {
      setIsLoadingGogGames(false);
    }
  }, [gogUserId]);

  // Effect for fetching Steam games
  useEffect(() => {
    if (steamId) { // Condition to run fetch
      fetchSteamGames();
    } else {
      // Clear games if steamId is removed (e.g., user disconnects)
      setSteamGames([]);
      setSteamGamesError(null);
      setIsLoadingSteamGames(false);
    }
  }, [steamId, fetchSteamGames]); // fetchSteamGames is now a dependency

  // Effect for fetching GOG games
  useEffect(() => {
    if (gogUserId) {
      fetchGogGames();
    } else {
      setGogGames([]);
      setGogGamesError(null);
      setIsLoadingGogGames(false);
    }
  }, [gogUserId, fetchGogGames]); // fetchGogGames is now a dependency

  const [allGames, setAllGames] = useState<Game[]>([]);

  useEffect(() => {
    // Ensure xboxGamesFromContext and psnGames are defined, default to empty array if not
    const safeXboxGames = xboxGamesFromContext || [];
    const safePsnGames = psnGames || [];

    const combinedGames = [
      ...(steamGames.map(steamGameToGameType).filter(Boolean) as Game[]),
      ...(gogGames.map(gogGameToGameType).filter(Boolean) as Game[]),
      ...(safeXboxGames.map(mapXboxGameToGenericGame).filter(Boolean) as Game[]),
      ...(safePsnGames.map(psnGameToGameType).filter(Boolean) as Game[])
    ];
    setAllGames(combinedGames);
    // console.log('Games data updated and combined:', { steamGames, gogGames, xboxGamesFromContext, psnGames, combinedGames });
  }, [steamGames, gogGames, xboxGamesFromContext, psnGames]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader 
        activeView={activeView} 
        onViewChange={setActiveView}
      />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        {activeView === 'library' ? (
          <>
            <PlatformStats games={allGames} />
            <GameLibrary 
              games={allGames}
              selectedPlatform={selectedPlatform}
              onPlatformChange={setSelectedPlatform}
              // Pass loading and error states for individual platforms
              isLoadingSteam={isLoadingSteamGames}
              steamError={steamGamesError}
              isLoadingGog={isLoadingGogGames}
              gogError={gogGamesError}
              isLoadingXbox={isLoadingXboxGames}
              xboxError={xboxGamesError}
              isLoadingPsn={isLoadingPsnGames}
              psnError={psnGamesError}
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
