import React, { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast'; // Assuming you have a toast hook
// import { AuthContext } from '@/contexts/AuthContext'; // If you use a context for tokens
// import GameCard from './GameCard'; // Assuming a generic GameCard component exists or will be created

interface PsnGameTitle {
  npCommunicationId: string;
  trophyTitleName: string;
  trophyTitleIconUrl: string;
  trophyTitlePlatform: string;
  hasTrophyGroups: boolean;
  definedTrophies: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  progress: number; // Overall progress percentage
  earnedTrophies: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  lastUpdatedDateTime: string;
}

interface PsnUserTitlesResponse {
  trophyTitles: PsnGameTitle[];
  totalItemCount: number;
}

const PsnGameLibrary: React.FC = () => {
  const [games, setGames] = useState<PsnGameTitle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  // const { psnAccessToken } = useContext(AuthContext); // Example: get token from context

  // TODO: Replace this with actual token retrieval (e.g., from localStorage or AuthContext)
  const getPsnAccessToken = (): string | null => {
    // This is a placeholder. In a real app, retrieve this securely.
    // const authData = localStorage.getItem('psnAuthorization');
    // if (authData) {
    //   return JSON.parse(authData).accessToken;
    // }
    // For now, you might need to manually paste an access token during development,
    // or ensure PsnConnections.tsx stores it in a way this component can access.
    // This part needs to be connected to where PsnConnections stores the token.
    const storedAuth = localStorage.getItem('psnAuthToken'); // Example, if PsnConnections stores it this way
    return storedAuth;
  };

  useEffect(() => {
    const fetchGames = async () => {
      const accessToken = getPsnAccessToken();
      if (!accessToken) {
        setError('PSN Access Token not found. Please connect to PSN first.');
        // toast({ title: 'Authentication Required', description: 'Please connect to PSN first.', variant: 'destructive'});
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/psn/games', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data: PsnUserTitlesResponse = await response.json();
        setGames(data.trophyTitles || []);
        if (!data.trophyTitles || data.trophyTitles.length === 0) {
            toast({ title: 'No Games Found', description: 'No PSN games were found for your account or an error occurred.' });
        }

      } catch (err: any) {
        console.error('Error fetching PSN games:', err);
        const errorMessage = err.message || 'Failed to fetch PSN game library.';
        setError(errorMessage);
        toast({ title: 'Error Fetching Games', description: errorMessage, variant: 'destructive' });
        setGames([]); // Clear any stale game data
      } finally {
        setIsLoading(false);
      }
    };

    fetchGames();
  }, []); // TODO: Add dependency on token availability if it can change

  if (isLoading) {
    return <p>Loading PSN Game Library...</p>; // Replace with a Skeleton loader if available
  }

  if (error) {
    return <p className="text-destructive">Error: {error}</p>;
  }

  if (games.length === 0 && !isLoading) {
     // This message is now shown via toast, but you can have a placeholder here too.
    return <p>No PSN games found, or you need to connect your PSN account.</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">My PSN Game Library</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((game) => (
          <div key={game.npCommunicationId} className="border p-4 rounded-lg shadow">
            <img src={game.trophyTitleIconUrl} alt={game.trophyTitleName} className="w-full h-48 object-cover rounded-md mb-2" />
            <h4 className="font-semibold">{game.trophyTitleName}</h4>
            <p className="text-sm text-muted-foreground">{game.trophyTitlePlatform}</p>
            <p className="text-sm">Progress: {game.progress}%</p>
            <p className="text-sm">Platinum: {game.earnedTrophies.platinum} / {game.definedTrophies.platinum}</p>
            {/* You could use a generic GameCard component here if desired */}
            {/* <GameCard
              title={game.trophyTitleName}
              imageUrl={game.trophyTitleIconUrl}
              platform={game.trophyTitlePlatform}
              // Add other relevant props
            /> */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PsnGameLibrary;
