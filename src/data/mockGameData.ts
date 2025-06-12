
export interface Game {
  id: string;
  title: string;
  platform: 'steam' | 'epic' | 'xbox' | 'gog';
  coverImage: string;
  playtime: number; // in hours
  lastPlayed: string;
  achievements: {
    unlocked: number;
    total: number;
  };
  status: 'installed' | 'not_installed' | 'downloading';
  genre: string[];
  releaseYear: number;
}

export const mockGameData: Game[] = [
  {
    id: '1',
    title: 'Cyberpunk 2077',
    platform: 'steam',
    coverImage: '/placeholder.svg',
    playtime: 87.5,
    lastPlayed: '2024-06-10',
    achievements: { unlocked: 23, total: 44 },
    status: 'installed',
    genre: ['RPG', 'Action'],
    releaseYear: 2020
  },
  {
    id: '2',
    title: 'Fortnite',
    platform: 'epic',
    coverImage: '/placeholder.svg',
    playtime: 156.3,
    lastPlayed: '2024-06-12',
    achievements: { unlocked: 89, total: 120 },
    status: 'installed',
    genre: ['Battle Royale', 'Action'],
    releaseYear: 2017
  },
  {
    id: '3',
    title: 'Halo Infinite',
    platform: 'xbox',
    coverImage: '/placeholder.svg',
    playtime: 42.1,
    lastPlayed: '2024-06-08',
    achievements: { unlocked: 15, total: 67 },
    status: 'installed',
    genre: ['FPS', 'Action'],
    releaseYear: 2021
  },
  {
    id: '4',
    title: 'The Witcher 3',
    platform: 'gog',
    coverImage: '/placeholder.svg',
    playtime: 203.7,
    lastPlayed: '2024-06-05',
    achievements: { unlocked: 34, total: 78 },
    status: 'installed',
    genre: ['RPG', 'Fantasy'],
    releaseYear: 2015
  },
  {
    id: '5',
    title: 'Rocket League',
    platform: 'epic',
    coverImage: '/placeholder.svg',
    playtime: 89.2,
    lastPlayed: '2024-06-11',
    achievements: { unlocked: 45, total: 88 },
    status: 'installed',
    genre: ['Sports', 'Racing'],
    releaseYear: 2015
  },
  {
    id: '6',
    title: 'Red Dead Redemption 2',
    platform: 'steam',
    coverImage: '/placeholder.svg',
    playtime: 124.8,
    lastPlayed: '2024-06-07',
    achievements: { unlocked: 28, total: 52 },
    status: 'not_installed',
    genre: ['Action', 'Adventure'],
    releaseYear: 2018
  }
];

export const platformInfo = {
  steam: { name: 'Steam', color: 'bg-blue-600', icon: '🟦' },
  epic: { name: 'Epic Games', color: 'bg-gray-800', icon: '⚫' },
  xbox: { name: 'Xbox', color: 'bg-green-600', icon: '🟢' },
  gog: { name: 'GOG', color: 'bg-purple-600', icon: '🟣' }
};
