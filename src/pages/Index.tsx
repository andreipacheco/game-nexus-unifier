
import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PlatformStats } from "@/components/dashboard/PlatformStats";
import { GameLibrary } from "@/components/dashboard/GameLibrary";
import { PlatformConnections } from "@/components/dashboard/PlatformConnections";

const Index = () => {
  const [activeView, setActiveView] = useState<'library' | 'connections'>('library');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader 
        activeView={activeView} 
        onViewChange={setActiveView}
      />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        {activeView === 'library' ? (
          <>
            <PlatformStats games={[]} />
            <GameLibrary 
              games={[]}
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
