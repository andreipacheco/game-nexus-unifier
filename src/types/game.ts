export interface Game {
  id: string;
  appId?: string;
  title: string;
  platform: 'steam' | 'epic' | 'xbox' | 'gog';
  coverImage: string;
  playtime: number; // in hours
  lastPlayed: string;
  achievements: {
    unlocked: number;
    total: number;
    currentGamerscore?: number; // Optional: For Xbox Gamerscore
    totalGamerscore?: number;   // Optional: For Xbox Gamerscore
  };
  status: 'installed' | 'not_installed' | 'downloading';
  genre: string[];
  releaseYear: number;
}
