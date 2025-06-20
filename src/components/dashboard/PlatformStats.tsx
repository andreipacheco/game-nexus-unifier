
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Game } from "@/types/gameTypes";
import { platformInfo } from "@/config/platformConfig";
import { Clock, Trophy, GamepadIcon as TotalGamesIcon, Download, Star } from "lucide-react"; // Renamed GamepadIcon, Added Star for Gamerscore

interface PlatformStatsProps {
  games: Game[];
}

export const PlatformStats = ({ games }: PlatformStatsProps) => {
  const totalGames = games.length;
  const totalPlaytime = games.reduce((acc, game) => acc + (game.playtime || 0), 0); // Ensure playtime is handled if undefined
  const totalUnlockedAchievements = games.reduce((acc, game) => acc + (game.achievements?.unlocked || 0), 0);
  // const totalPossibleAchievements = games.reduce((acc, game) => acc + (game.achievements?.total || 0), 0); // If needed for a different display

  const totalUnlockedGamerscore = games.reduce(
    (acc, game) => acc + (game.platform === 'xbox' && game.achievements?.currentGamerscore ? game.achievements.currentGamerscore : 0),
    0
  );
  const totalPossibleGamerscore = games.reduce(
    (acc, game) => acc + (game.platform === 'xbox' && game.achievements?.totalGamerscore ? game.achievements.totalGamerscore : 0),
    0
  );

  // const installedGames = games.filter(game => game.status === 'installed').length; // Removed as per request

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
          <TotalGamesIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalGames}</div>
          {/* Removed installed games count line */}
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
          <CardTitle className="text-sm font-medium">Achievements Unlocked</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalUnlockedAchievements}</div>
          <p className="text-xs text-muted-foreground">
            Across all platforms
            {/* Possible to show {totalUnlockedAchievements} / {totalPossibleAchievements} if desired */}
          </p>
        </CardContent>
      </Card>

      {totalPossibleGamerscore > 0 && ( // Only show Gamerscore card if there's any Xbox data
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Xbox Gamerscore</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" /> {/* Using Star for Gamerscore */}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalUnlockedGamerscore} / {totalPossibleGamerscore}
            </div>
            <p className="text-xs text-muted-foreground">
              Unlocked from Xbox games
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Connected Platforms</CardTitle>
          <Download className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {platformStats.filter(p => p.count > 0 || (p.platform === 'xbox' && totalPossibleGamerscore > 0)).length}
            {/* Count platform if it has games OR if it's xbox and has gamerscore (even if 0 games shown due to filters elsewhere) */}
          </div>
          <div className="flex space-x-1 mt-2">
            {platformStats.map((platform) => (
              (platform.count > 0 || (platform.platform === 'xbox' && totalPossibleGamerscore > 0)) && (
                <div
                  key={platform.platform}
                  className={`w-3 h-3 rounded-full ${platform.color}`}
                  title={`${platform.name}: ${platform.count} games, ${platform.playtime}h playtime`}
                />
              )
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
