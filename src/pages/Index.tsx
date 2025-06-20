
import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PlatformStats } from "@/components/dashboard/PlatformStats";
import { GameLibrary } from "@/components/dashboard/GameLibrary";
import { PlatformConnections } from "@/components/dashboard/PlatformConnections";

const Index = () => {
  const [activeView, setActiveView] = useState<'library' | 'connections'>('library');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [gamesData, setGamesData] = useState<any[]>([]); // To hold fetched games

  useEffect(() => {
    const fetchGamesData = async () => {
      try {
        // Assuming the API endpoint is /api/user/stats
        // Adjust if your backend routes are set up differently
        const response = await fetch('/api/user/stats');
        if (!response.ok) {
          // Handle HTTP errors, e.g., response.status is 401, 403, 500
          console.error('Failed to fetch games data, status:', response.status);
          // Optionally, set an error state here to display to the user
          return;
        }
        const data = await response.json();
        if (data.games) {
          setGamesData(data.games);
          console.log('Fetched games data:', data.games);
        } else {
          console.log('No games data found in response or response format is unexpected.');
          setGamesData([]); // Ensure it's an array even if no games are returned
        }
      } catch (error) {
        console.error('Error fetching games data:', error);
        // Optionally, set an error state here
      }
    };

    fetchGamesData();
  }, []); // Empty dependency array means this effect runs once on mount

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader 
        activeView={activeView} 
        onViewChange={setActiveView}
      />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        {activeView === 'library' ? (
          <>
            <PlatformStats games={gamesData} />
            <GameLibrary 
              games={gamesData}
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
