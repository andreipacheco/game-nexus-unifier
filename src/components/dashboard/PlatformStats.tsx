
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Game, platformInfo } from "@/data/mockGameData";
import { Clock, Trophy, GamepadIcon, Download } from "lucide-react";

interface PlatformStatsProps {
  games: Game[];
}

export const PlatformStats = ({ games }: PlatformStatsProps) => {
  const totalGames = games.length;
  const totalPlaytime = games.reduce((acc, game) => acc + game.playtime, 0);
  const totalAchievements = games.reduce((acc, game) => acc + game.achievements.unlocked, 0);
  const installedGames = games.filter(game => game.status === 'installed').length;

  const platformStats = Object.entries(platformInfo).map(([key, info]) => {
    const platformGames = games.filter(game => game.platform === key);
    return {
      platform: key,
      name: info.name,
      color: info.color,
      icon: info.icon,
      count: platformGames.length,
      playtime: platformGames.reduce((acc, game) => acc + game.playtime, 0)
    };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Games</CardTitle>
          <GamepadIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalGames}</div>
          <p className="text-xs text-muted-foreground">
            {installedGames} installed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Playtime</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(totalPlaytime)}h</div>
          <p className="text-xs text-muted-foreground">
            Across all platforms
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Achievements</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAchievements}</div>
          <p className="text-xs text-muted-foreground">
            Unlocked trophies
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Platforms</CardTitle>
          <Download className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{platformStats.filter(p => p.count > 0).length}</div>
          <div className="flex space-x-1 mt-2">
            {platformStats.map((platform) => (
              platform.count > 0 && (
                <div
                  key={platform.platform}
                  className={`w-3 h-3 rounded-full ${platform.color}`}
                  title={`${platform.name}: ${platform.count} games`}
                />
              )
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
