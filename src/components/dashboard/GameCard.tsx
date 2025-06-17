import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Game, platformInfo } from "@/data/mockGameData";
// ListChecks removed as Trophy is used instead for View Achievements button
import { Clock, Trophy, Play, Download, MoreVertical } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useXbox } from "@/contexts/XboxContext";
import { DetailedAchievementsModal } from "./DetailedAchievementsModal";

interface GameCardProps {
  game: Game;
}

export const GameCard = ({ game }: GameCardProps) => {
  const platform = platformInfo[game.platform];
  const achievementProgress = game.achievements && typeof game.achievements.unlocked === 'number' && game.achievements.total > 0
    ? Math.round((game.achievements.unlocked / game.achievements.total) * 100)
    : 0;
  const isSteamGame = game.platform === 'steam' && game.appId;
  const isXboxGame = game.platform === 'xbox';
  const steamStoreUrl = isSteamGame ? `https://store.steampowered.com/app/${game.appId}` : '';

  const {
    currentXuid,
    fetchDetailedXboxAchievements,
    detailedAchievements,
    isLoadingDetailedAchievements,
    errorDetailedAchievements
  } = useXbox();

  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false);

  const handleViewAchievementsClick = () => {
    if (isXboxGame && currentXuid && game.id) {
      const titleId = game.id.startsWith('xbox-') ? game.id.substring(5) : game.id;
      fetchDetailedXboxAchievements(currentXuid, titleId);
      setIsAchievementsModalOpen(true);
    } else if (!currentXuid && isXboxGame) {
      console.warn("Cannot fetch Xbox achievements: XUID not found in context.");
      // Consider a toast notification here for the user
    }
  };

  const formatPlaytime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${Math.round(hours)}h`;
  };

  const getStatusColor = (status: Game['status']) => {
    switch (status) {
      case 'installed': return 'bg-green-600';
      case 'downloading': return 'bg-yellow-600';
      case 'not_installed': return 'bg-gray-600';
      default: return 'bg-gray-400'; // Fallback color
    }
  };

  const getStatusText = (status: Game['status']) => {
    switch (status) {
      case 'installed': return 'Play';
      case 'downloading': return 'Downloading...';
      case 'not_installed': return 'Install';
      default: return 'View'; // Fallback text
    }
  };

  const handlePlayInstallClick = () => {
    if (isSteamGame && game.appId && game.status !== 'downloading') {
      window.location.href = `steam://run/${game.appId}`;
    }
    // Future: Add logic for other platforms or a generic "view game" action
  };

  // Determine the titleId for Xbox achievements, stripping the "xbox-" prefix
  const xboxTitleId = isXboxGame && game.id.startsWith('xbox-') ? game.id.substring(5) : game.id;

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-200 flex flex-col h-full"> {/* Added h-full for consistent card height if in grid */}
        <CardContent className="p-0">
          {isSteamGame ? (
            <a href={steamStoreUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${game.title} on Steam Store`}>
              <div className="relative">
                <AspectRatio ratio={16 / 9}>
                  <img
                    src={game.coverImage || '/placeholder.svg'} // Fallback image
                    alt={game.title}
                    className="w-full h-full object-cover rounded-t-lg bg-muted"
                  />
                </AspectRatio>
                <div className="absolute top-2 left-2 flex items-center space-x-2">
                  {platform && <Badge className={`${platform.color} text-white`}>{platform.name}</Badge>}
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(game.status)}`} />
                </div>
                {/* <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                  aria-label="More options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button> */}
              </div>
            </a>
          ) : (
            <div className="relative">
              <AspectRatio ratio={16 / 9}>
                <img
                  src={game.coverImage || '/placeholder.svg'} // Fallback image
                  alt={game.title}
                  className="w-full h-full object-cover rounded-t-lg bg-muted"
                />
              </AspectRatio>
              <div className="absolute top-2 left-2 flex items-center space-x-2">
                {platform && <Badge className={`${platform.color} text-white`}>{platform.name}</Badge>}
                {game.status && <div className={`w-2 h-2 rounded-full ${getStatusColor(game.status)}`} />}
              </div>
              {/* <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                aria-label="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button> */}
            </div>
          )}
          
          <div className="p-4 space-y-2 flex-grow flex flex-col"> {/* Removed justify-between to allow natural spacing */}
            <div>
              {isSteamGame ? (
                <a href={steamStoreUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${game.title} on Steam Store`}>
                  <h3 className="font-semibold line-clamp-2 hover:underline text-base">{game.title}</h3>
                </a>
              ) : (
                <h3 className="font-semibold line-clamp-2 text-base">{game.title}</h3>
              )}
              {((Array.isArray(game.genre) && game.genre.length > 0 && game.genre[0] !== 'Unknown Genre') || (game.releaseYear && game.releaseYear !== 0 && game.releaseYear !== 'N/A')) && (
              <p className="text-xs text-muted-foreground mt-1">
                {(() => {
                  const genreDisplay = Array.isArray(game.genre) && game.genre.length > 0 && game.genre[0] !== 'Unknown Genre' ? game.genre.join(', ') : null;
                  const yearDisplay = game.releaseYear && game.releaseYear !== 0 && game.releaseYear !== 'N/A' ? game.releaseYear.toString() : null;
                  let parts = [];
                  if (genreDisplay) parts.push(genreDisplay);
                  if (yearDisplay) parts.push(yearDisplay);
                  return parts.length > 0 ? parts.join(' • ') : '';
                })()}
              </p>
            )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2"> {/* Changed to text-xs and mt-2 */}
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{formatPlaytime(game.playtime)}</span>
              </div>
              {game.achievements && game.achievements.total > 0 && (
                <div className="flex items-center space-x-1">
                  <Trophy className="h-3 w-3" />
                  <span>{achievementProgress}%</span>
                </div>
              )}
            </div>

            {game.lastPlayed && game.lastPlayed !== new Date(0).toISOString() && (
              <div className="text-xs text-muted-foreground mt-1">
                Last played: {new Date(game.lastPlayed).toLocaleDateString()}
              </div>
            )}
          </div>
        </CardContent>
      
        <CardFooter className="pt-2 px-4 pb-4 mt-auto"> {/* Added pt-2, mt-auto */}
          <div className="w-full space-y-2">
            {isXboxGame && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleViewAchievementsClick}
                disabled={!currentXuid}
              >
                <Trophy className="h-4 w-4 mr-2" />
                View Achievements
              </Button>
            )}
            <Button
              className="w-full"
              variant={game.status === 'installed' ? 'default' : 'outline'}
              size="sm" // Added size sm for consistency
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
          </div>
        </CardFooter>
      </Card>

      {isXboxGame && (
        <DetailedAchievementsModal
          isOpen={isAchievementsModalOpen}
          onClose={() => setIsAchievementsModalOpen(false)}
          gameName={game.title}
          achievements={detailedAchievements[xboxTitleId] || null}
          isLoading={!!isLoadingDetailedAchievements[xboxTitleId]}
          error={errorDetailedAchievements[xboxTitleId] || null}
        />
      )}
    </>
  );
};
