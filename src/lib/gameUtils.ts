import { Game } from "@/types/gameTypes";
import { XboxGame } from "@/contexts/XboxContext";
import { PsnGame } from "@/contexts/PsnContext";

// Basic interface for Steam games (adapt as needed based on actual API response)
export interface SteamGame {
  appID: number;
  name: string;
  playtimeForever: number; // in minutes
  imgIconURL: string;
  imgLogoURL?: string; // Often available, good for a larger image if needed
  achievements: { // Added this field
    unlocked: number;
    total: number;
  };
}

// Basic interface for GOG games (adapt as needed based on actual API response)
export interface GogGame {
  appID: string; // GOG uses id, which is a string in the backend
  name: string;
  imgIconURL: string;
  playtimeForever: number; // Defaulted to 0 in backend
  achievements: {
    unlocked: number;
    total: number;
  };
}

// Helper to convert SteamGame to Game for consistent display, or GameCard could be adapted
export const steamGameToGameType = (steamGame: SteamGame): Game | null => {
  if (!steamGame || typeof steamGame.appID === 'undefined' || steamGame.appID === null) {
    console.warn('Skipping Steam game with missing or invalid appID:', steamGame);
    return null;
  }

  const gameTitle = steamGame.name || 'Unknown Steam Game';
  const playtimeHours = typeof steamGame.playtimeForever === 'number' ? Math.round(steamGame.playtimeForever / 60) : 0;

  // Construct image URL safely, using a placeholder if data is missing
  // The current GameCard uses coverImage. header.jpg is usually available.
  // imgIconURL is for smaller list icons, not usually for card headers.
  const coverImg = `https://cdn.akamai.steamstatic.com/steam/apps/${steamGame.appID}/header.jpg`;
  // If imgIconURL was needed for something else:
  // const iconUrl = steamGame.imgIconURL || '';
  // const smallImageUrl = iconUrl ? `https://media.steampowered.com/steamcommunity/public/images/apps/${steamGame.appID}/${iconUrl}.jpg` : 'placeholder_icon.svg';

  // Default values for fields not present in Steam's GetOwnedGames API response
  const defaultLastPlayed = new Date(0).toISOString(); // Epoch time as a placeholder
  // const defaultAchievements = { unlocked: 0, total: 0 }; // Removed, as backend provides it
  const defaultStatus = 'not_installed'; // Or 'owned' - 'not_installed' seems reasonable
  const defaultGenre: string[] = ['Unknown Genre']; // Default to an array with 'Unknown Genre'
  const defaultReleaseYear = 0; // Placeholder for unknown year

  return {
    id: `steam-${steamGame.appID.toString()}`, // Unique ID for React keys
    appId: steamGame.appID.toString(),
    title: gameTitle,
    platform: 'steam',
    coverImage: coverImg,
    // imageUrl: coverImg, // Redundant if GameCard uses coverImage, ensure Game uses one primary image prop
    playtime: playtimeHours,
    lastPlayed: defaultLastPlayed, // Steam API doesn't provide this in GetOwnedGames
    achievements: steamGame.achievements, // Use achievements data from backend
    status: defaultStatus, // Steam API GetOwnedGames doesn't provide installation status
    genre: defaultGenre, // Steam API GetOwnedGames doesn't provide genre
    releaseYear: defaultReleaseYear, // Steam API GetOwnedGames doesn't provide release year
    // Ensure any other fields from the 'Game' interface (from mockGameData.ts) are considered
  };
};

// Helper to convert GogGame to Game for consistent display
export const gogGameToGameType = (gogGame: GogGame): Game | null => {
  if (!gogGame || typeof gogGame.appID === 'undefined' || gogGame.appID === null) {
    console.warn('Skipping GOG game with missing or invalid appID:', gogGame);
    return null;
  }

  const gameTitle = gogGame.name || 'Unknown GOG Game';
  // playtimeForever is already a number (defaulted to 0 in backend)
  const playtimeHours = gogGame.playtimeForever;


  // Default values for fields not present or different in GOG's API response
  const defaultLastPlayed = new Date(0).toISOString(); // Epoch time as a placeholder
  const defaultStatus = 'owned'; // GOG games are owned
  const defaultGenre: string[] = ['Unknown Genre'];
  const defaultReleaseYear = 0; // Placeholder for unknown year

  return {
    id: `gog-${gogGame.appID}`, // Unique ID for React keys
    appId: gogGame.appID,
    title: gameTitle,
    platform: 'gog',
    coverImage: gogGame.imgIconURL || 'placeholder_cover.svg', // Use imgIconURL as cover, or a placeholder
    playtime: playtimeHours,
    lastPlayed: defaultLastPlayed,
    achievements: gogGame.achievements, // Use achievements data from backend (defaulted)
    status: defaultStatus,
    genre: defaultGenre,
    releaseYear: defaultReleaseYear,
  };
};

// Helper to convert XboxGame to Game for consistent display
export const mapXboxGameToGenericGame = (xboxGame: XboxGame): Game | null => {
  if (!xboxGame || !xboxGame.titleId) {
    console.warn('Skipping Xbox game with missing or invalid titleId:', xboxGame);
    return null;
  }

  const gameTitle = xboxGame.name || 'Unknown Xbox Game';

  return {
    id: `xbox-${xboxGame.titleId}`,
    appId: xboxGame.titleId, // Assuming titleId can serve as appId
    title: gameTitle,
    platform: 'xbox',
    coverImage: xboxGame.displayImage || '/placeholder.svg', // Ensure placeholder.svg is in public
    playtime: 0, // Playtime not available from this Xbox API
    lastPlayed: xboxGame.lastUpdated || new Date(0).toISOString(), // Use lastUpdated from API, or epoch
    achievements: {
      unlocked: xboxGame.achievements.currentAchievements,
      total: xboxGame.achievements.totalAchievements,
      currentGamerscore: xboxGame.achievements.currentGamerscore,
      totalGamerscore: xboxGame.achievements.totalGamerscore,
    },
    status: 'owned', // Assume 'owned', can be 'not_installed' if preferred
    genre: ['Unknown Genre'], // Xbox API (titles) doesn't provide genre
    releaseYear: 0, // Xbox API (titles) doesn't provide release year
  };
};

// Must be defined in the same file or imported if defined elsewhere
export const psnGameToGameType = (psnGame: PsnGame): Game | null => {
  if (!psnGame || !psnGame.npCommunicationId) {
    console.warn('Skipping PSN game with missing npCommunicationId:', psnGame);
    return null;
  }

  const gameTitle = psnGame.trophyTitleName || 'Unknown PSN Game';

  const playtimeHours = 0; // getUserTitles doesn't typically include playtime
  const defaultLastPlayed = psnGame.lastUpdatedDateTime || new Date(0).toISOString();
  const achievements = {
    unlocked: (psnGame.earnedTrophies?.platinum || 0) +
              (psnGame.earnedTrophies?.gold || 0) +
              (psnGame.earnedTrophies?.silver || 0) +
              (psnGame.earnedTrophies?.bronze || 0),
    total: (psnGame.definedTrophies?.platinum || 0) +
           (psnGame.definedTrophies?.gold || 0) +
           (psnGame.definedTrophies?.silver || 0) +
           (psnGame.definedTrophies?.bronze || 0),
  };
  if (achievements.total === 0 && achievements.unlocked > 0) {
    achievements.total = achievements.unlocked;
  }

  return {
    id: `psn-${psnGame.npCommunicationId}`,
    appId: psnGame.npCommunicationId,
    title: gameTitle,
    platform: 'psn',
    coverImage: psnGame.trophyTitleIconUrl || '/placeholder.svg',
    playtime: playtimeHours,
    lastPlayed: defaultLastPlayed,
    achievements: achievements,
    status: 'owned',
    genre: [psnGame.trophyTitlePlatform || 'Unknown Genre'],
    releaseYear: 0,
  };
};
