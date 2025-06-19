
import { useState, useEffect } from "react";
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

  const { fetchSteamGames, steamId } = useSteam();
  const { fetchGogGames, gogUserId } = useGog();

  // Effect for fetching Steam games
  useEffect(() => {
    if (steamId) {
      setIsLoadingSteamGames(true);
      fetchSteamGames()
        .then(data => {
          setSteamGames(data?.games || []);
          setSteamGamesError(null);
        })
        .catch(err => {
          console.error("Error fetching Steam games:", err);
          setSteamGamesError(err);
          setSteamGames([]);
        })
        .finally(() => {
          setIsLoadingSteamGames(false);
        });
    } else {
      setSteamGames([]);
    }
  }, [steamId, fetchSteamGames]);

  // Effect for fetching GOG games
  useEffect(() => {
    if (gogUserId) {
      setIsLoadingGogGames(true);
      fetchGogGames()
        .then(data => {
          setGogGames(data || []);
          setGogGamesError(null);
        })
        .catch(err => {
          console.error("Error fetching GOG games:", err);
          setGogGamesError(err);
          setGogGames([]);
        })
        .finally(() => {
          setIsLoadingGogGames(false);
        });
    } else {
      setGogGames([]);
    }
  }, [gogUserId, fetchGogGames]);

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
