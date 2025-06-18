import React, { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
// import { AuthContext } from '@/contexts/AuthContext'; // If you use a context for tokens

interface TrophyCounts {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

interface PsnTrophySummaryResponse {
  accountId: string;
  trophyLevel: number;
  progress: number; // Progress to next level
  tier: number;
  earnedTrophies: TrophyCounts;
}

const PsnTrophyData: React.FC = () => {
  const [trophySummary, setTrophySummary] = useState<PsnTrophySummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  // const { psnAccessToken } = useContext(AuthContext); // Example

  // TODO: Replace this with actual token retrieval (e.g., from localStorage or AuthContext)
  const getPsnAccessToken = (): string | null => {
    // This should be consistent with how PsnGameLibrary.tsx and PsnConnections.tsx handle tokens
    const storedAuth = localStorage.getItem('psnAuthToken');
    return storedAuth;
  };

  useEffect(() => {
    const fetchTrophySummary = async () => {
      const accessToken = getPsnAccessToken();
      if (!accessToken) {
        setError('PSN Access Token not found. Please connect to PSN first.');
        // toast({ title: 'Authentication Required', description: 'Please connect to PSN first.', variant: 'destructive'});
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/psn/trophy-summary', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data: PsnTrophySummaryResponse = await response.json();
        setTrophySummary(data);

      } catch (err: any) {
        console.error('Error fetching PSN trophy summary:', err);
        const errorMessage = err.message || 'Failed to fetch PSN trophy summary.';
        setError(errorMessage);
        toast({ title: 'Error Fetching Trophies', description: errorMessage, variant: 'destructive' });
        setTrophySummary(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrophySummary();
  }, []); // TODO: Add dependency on token availability if it can change

  if (isLoading) {
    return <p>Loading PSN Trophy Data...</p>; // Replace with Skeleton loader
  }

  if (error) {
    return <p className="text-destructive">Error: {error}</p>;
  }

  if (!trophySummary && !isLoading) {
    return <p>No PSN trophy data found, or you need to connect your PSN account.</p>;
  }

  if (!trophySummary) return null; // Should be covered by above, but good practice

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">My PSN Trophy Summary</h3>
      <div className="p-4 border rounded-lg shadow">
        <p>Account ID: {trophySummary.accountId}</p>
        <p>Trophy Level: {trophySummary.trophyLevel} (Tier {trophySummary.tier})</p>
        <p>Progress to Next Level: {trophySummary.progress}%</p>
        <h4 className="font-semibold mt-2">Earned Trophies:</h4>
        <ul className="list-disc list-inside">
          <li>Platinum: {trophySummary?.earnedTrophies?.platinum || 0}</li>
          <li>Gold: {trophySummary?.earnedTrophies?.gold || 0}</li>
          <li>Silver: {trophySummary?.earnedTrophies?.silver || 0}</li>
          <li>Bronze: {trophySummary?.earnedTrophies?.bronze || 0}</li>
        </ul>
      </div>
    </div>
  );
};

export default PsnTrophyData;
