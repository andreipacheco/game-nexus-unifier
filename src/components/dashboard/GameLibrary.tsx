
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Game, platformInfo } from "@/data/mockGameData";
import { Clock, Trophy, Play, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { GameCard } from "./GameCard";

interface GameLibraryProps {
  games: Game[];
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
}

export const GameLibrary = ({ games, selectedPlatform, onPlatformChange }: GameLibraryProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredGames = games.filter(game => {
    const matchesPlatform = selectedPlatform === 'all' || game.platform === selectedPlatform;
    const matchesSearch = game.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  const platformFilters = [
    { key: 'all', name: 'All Platforms', count: games.length },
    ...Object.entries(platformInfo).map(([key, info]) => ({
      key,
      name: info.name,
      count: games.filter(game => game.platform === key).length
    }))
  ];

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>

      {filteredGames.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No games found</h3>
            <p className="text-muted-foreground text-center">
              Try adjusting your search or platform filter
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
