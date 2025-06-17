
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Game, platformInfo } from "@/data/mockGameData";
import { Clock, Trophy, Play, Download, MoreVertical } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface GameCardProps {
  game: Game;
}

export const GameCard = ({ game }: GameCardProps) => {
  const platform = platformInfo[game.platform];
  const achievementProgress = Math.round((game.achievements.unlocked / game.achievements.total) * 100);
  const isSteamGame = game.platform === 'steam' && game.appId;
  const steamStoreUrl = isSteamGame ? `https://store.steampowered.com/app/${game.appId}` : '';

  const formatPlaytime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${Math.round(hours)}h`;
  };

  const getStatusColor = (status: Game['status']) => {
    switch (status) {
      case 'installed': return 'bg-green-600';
      case 'downloading': return 'bg-yellow-600';
      case 'not_installed': return 'bg-gray-600';
    }
  };

  const getStatusText = (status: Game['status']) => {
    switch (status) {
      case 'installed': return 'Play';
      case 'downloading': return 'Downloading...';
      case 'not_installed': return 'Install';
    }
  };

  const handlePlayInstallClick = () => {
    if (isSteamGame && game.appId && game.status !== 'downloading') {
      // For installed games, Steam will launch the game.
      // For not_installed games, Steam will open the game's page or start the install process.
      window.location.href = `steam://run/${game.appId}`;
    }
    // Potentially add logic for other platforms here in the future
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200">
      <CardContent className="p-0">
        {isSteamGame ? (
          <a href={steamStoreUrl} target="_blank" rel="noopener noreferrer">
            <div className="relative">
              <AspectRatio ratio={16 / 9}>
                <img
                  src={game.coverImage}
                  alt={game.title}
                  className="w-full h-full object-cover rounded-t-lg bg-muted"
                />
              </AspectRatio>
              <div className="absolute top-2 left-2 flex items-center space-x-2">
                <Badge className={`${platform.color} text-white`}>
                  {platform.name}
                </Badge>
                <div className={`w-2 h-2 rounded-full ${getStatusColor(game.status)}`} />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </a>
        ) : (
          <div className="relative">
            <AspectRatio ratio={16 / 9}>
              <img
                src={game.coverImage}
                alt={game.title}
                className="w-full h-full object-cover rounded-t-lg bg-muted"
              />
            </AspectRatio>

            <div className="absolute top-2 left-2 flex items-center space-x-2">
              <Badge className={`${platform.color} text-white`}>
              {platform.name}
            </Badge>
            <div className={`w-2 h-2 rounded-full ${getStatusColor(game.status)}`} />
          </div>
          
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
        )}
        
        <div className="p-4 space-y-3">
          <div>
            {isSteamGame ? (
              <a href={steamStoreUrl} target="_blank" rel="noopener noreferrer">
                <h3 className="font-semibold line-clamp-1 hover:underline">{game.title}</h3>
              </a>
            ) : (
              <h3 className="font-semibold line-clamp-1">{game.title}</h3>
            )}
            {((Array.isArray(game.genre) && game.genre.join(', ') !== 'Unknown Genre') || (game.releaseYear !== 0 && game.releaseYear !== 'N/A')) && (
            <p className="text-sm text-muted-foreground">
              {(() => {
                const genreDisplay = Array.isArray(game.genre) && game.genre.join(', ') !== 'Unknown Genre' ? game.genre.join(', ') : null;
                const yearDisplay = game.releaseYear !== 0 && game.releaseYear !== 'N/A' ? game.releaseYear.toString() : null;
                let parts = [];
                if (genreDisplay) parts.push(genreDisplay);
                if (yearDisplay) parts.push(yearDisplay);
                return parts.length > 0 ? parts.join(' • ') : null;
              })()}
            </p>
            )}
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{formatPlaytime(game.playtime)}</span>
            </div>
            {game.achievements.total > 0 && (
              <div className="flex items-center space-x-1">
                <Trophy className="h-3 w-3" />
                <span>{achievementProgress}%</span>
              </div>
            )}
          </div>
          
          {game.lastPlayed !== new Date(0).toISOString() && (
            <div className="text-xs text-muted-foreground">
              Last played: {new Date(game.lastPlayed).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="pt-0 px-4 pb-4">
        <Button
          className="w-full"
          variant={game.status === 'installed' ? 'default' : 'outline'}
          disabled={game.status === 'downloading'}
          onClick={handlePlayInstallClick}
        >
          {game.status === 'installed' ? (
            <Play className="h-4 w-4 mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {getStatusText(game.status)}
        </Button>
      </CardFooter>
    </Card>
  );
};
