import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { PlatformStats } from './PlatformStats'; // Adjust path as necessary
import { Game } from '@/types/gameTypes'; // Adjust path as necessary
import { platformInfo } from '@/config/platformConfig'; // Adjust path

// Mock platformInfo if its dynamic nature or icons interfere with simple snapshot/text testing
// For this test, we assume platformInfo is stable and provides necessary data like name, color for icons.

const mockSteamGame: Game = {
  id: 'steam1',
  title: 'Steam Game 1',
  platform: 'steam',
  coverImage: 'steam1.png',
  playtime: 10, // 10 hours
  lastPlayed: new Date().toISOString(),
  achievements: { unlocked: 10, total: 20 },
  status: 'not_installed',
  genre: ['Action'],
  releaseYear: 2022,
};

const mockPsnGame: Game = {
  id: 'psn1',
  title: 'PSN Game 1',
  platform: 'psn', // Corrected platform type
  coverImage: 'psn1.png',
  playtime: 5, // 5 hours
  lastPlayed: new Date().toISOString(),
  achievements: { unlocked: 5, total: 10 },
  status: 'not_installed',
  genre: ['RPG'],
  releaseYear: 2021,
};

const mockXboxGame: Game = {
  id: 'xbox1',
  title: 'Xbox Game 1',
  platform: 'xbox',
  coverImage: 'xbox1.png',
  playtime: 20, // 20 hours
  lastPlayed: new Date().toISOString(),
  achievements: { unlocked: 25, total: 50, currentGamerscore: 500, totalGamerscore: 1000 },
  status: 'not_installed',
  genre: ['Shooter'],
  releaseYear: 2023,
};

const mockXboxGameNoGamerscore: Game = {
    id: 'xbox2',
    title: 'Xbox Game 2 No Gamerscore',
    platform: 'xbox',
    coverImage: 'xbox2.png',
    playtime: 2,
    lastPlayed: new Date().toISOString(),
    achievements: { unlocked: 5, total: 10 }, // No gamerscore here
    status: 'not_installed',
    genre: ['Indie'],
    releaseYear: 2023,
  };


describe('PlatformStats Component', () => {
  it('renders correctly with an empty games array', () => {
    render(<PlatformStats games={[]} />);

    const totalGamesCard = screen.getByText('Total Games').closest('div > div.rounded-lg');
    expect(within(totalGamesCard!).getByText('0')).toBeInTheDocument();
    expect(within(totalGamesCard!).queryByText(/installed/i)).not.toBeInTheDocument();

    const totalPlaytimeCard = screen.getByText('Total Playtime').closest('div > div.rounded-lg');
    expect(within(totalPlaytimeCard!).getByText('0h')).toBeInTheDocument();

    const achievementsCard = screen.getByText('Achievements Unlocked').closest('div > div.rounded-lg');
    expect(within(achievementsCard!).getByText('0')).toBeInTheDocument();

    const connectedPlatformsCard = screen.getByText('Connected Platforms').closest('div > div.rounded-lg');
    expect(within(connectedPlatformsCard!).getByText('0')).toBeInTheDocument();

    expect(screen.queryByText('Xbox Gamerscore')).not.toBeInTheDocument();
  });

  it('renders correctly with only Steam games', () => {
    render(<PlatformStats games={[mockSteamGame, {...mockSteamGame, id: 'steam2', playtime: 5, achievements: { unlocked: 2, total: 5}}]} />);

    const totalGamesCard = screen.getByText('Total Games').closest('div > div.rounded-lg');
    expect(within(totalGamesCard!).getByText('2')).toBeInTheDocument();
    expect(within(totalGamesCard!).queryByText(/installed/i)).not.toBeInTheDocument();

    const totalPlaytimeCard = screen.getByText('Total Playtime').closest('div > div.rounded-lg');
    expect(within(totalPlaytimeCard!).getByText('15h')).toBeInTheDocument(); // 10 + 5

    const achievementsCard = screen.getByText('Achievements Unlocked').closest('div > div.rounded-lg');
    expect(within(achievementsCard!).getByText('12')).toBeInTheDocument(); // 10 + 2

    const connectedPlatformsCard = screen.getByText('Connected Platforms').closest('div > div.rounded-lg');
    expect(within(connectedPlatformsCard!).getByText('1')).toBeInTheDocument(); // Only Steam

    expect(screen.queryByText('Xbox Gamerscore')).not.toBeInTheDocument();
  });

  it('renders correctly with PSN and Xbox games (with Gamerscore)', () => {
    render(<PlatformStats games={[mockPsnGame, mockXboxGame]} />);

    const totalGamesCard = screen.getByText('Total Games').closest('div > div.rounded-lg');
    expect(within(totalGamesCard!).getByText('2')).toBeInTheDocument();
    expect(within(totalGamesCard!).queryByText(/installed/i)).not.toBeInTheDocument();

    const totalPlaytimeCard = screen.getByText('Total Playtime').closest('div > div.rounded-lg');
    expect(within(totalPlaytimeCard!).getByText('25h')).toBeInTheDocument(); // 5 + 20

    const achievementsCard = screen.getByText('Achievements Unlocked').closest('div > div.rounded-lg');
    expect(within(achievementsCard!).getByText('30')).toBeInTheDocument(); // 5 + 25

    expect(screen.getByText('Xbox Gamerscore')).toBeInTheDocument();
    const xboxGamerscoreCard = screen.getByText('Xbox Gamerscore').closest('div > div.rounded-lg');
    expect(within(xboxGamerscoreCard!).getByText('500 / 1000')).toBeInTheDocument();

    const connectedPlatformsCard = screen.getByText('Connected Platforms').closest('div > div.rounded-lg');
    expect(within(connectedPlatformsCard!).getByText('2')).toBeInTheDocument(); // PSN and Xbox
  });

  it('does not show Xbox Gamerscore card if no Xbox games have Gamerscore', () => {
    render(<PlatformStats games={[mockSteamGame, mockPsnGame, mockXboxGameNoGamerscore]} />);
    const totalGamesCard = screen.getByText('Total Games').closest('div > div.rounded-lg');
    expect(within(totalGamesCard!).getByText('3')).toBeInTheDocument();
    expect(within(totalGamesCard!).queryByText(/installed/i)).not.toBeInTheDocument();

    expect(screen.queryByText('Xbox Gamerscore')).not.toBeInTheDocument();
  });

  it('handles games with zero playtime or zero achievements', () => {
    const gameWithZeroes: Game = {
      ...mockSteamGame,
      id: 'zeroGame',
      playtime: 0,
      achievements: { unlocked: 0, total: 10 },
    };
    render(<PlatformStats games={[gameWithZeroes, mockPsnGame]} />); // mockPsnGame has playtime 5, 5 unlocked

    const totalGamesCard = screen.getByText('Total Games').closest('div > div.rounded-lg');
    expect(within(totalGamesCard!).getByText('2')).toBeInTheDocument();
    expect(within(totalGamesCard!).queryByText(/installed/i)).not.toBeInTheDocument();

    const totalPlaytimeCard = screen.getByText('Total Playtime').closest('div > div.rounded-lg');
    expect(within(totalPlaytimeCard!).getByText('5h')).toBeInTheDocument(); // 0 + 5

    const achievementsCard = screen.getByText('Achievements Unlocked').closest('div > div.rounded-lg');
    expect(within(achievementsCard!).getByText('5')).toBeInTheDocument(); // 0 + 5
  });

  it('correctly displays connected platforms count and icons', () => {
    render(<PlatformStats games={[mockSteamGame, mockPsnGame, mockXboxGame]} />);
    const connectedPlatformsCard = screen.getByText('Connected Platforms').closest('div > div.rounded-lg');
    expect(within(connectedPlatformsCard!).getByText('3')).toBeInTheDocument();

    // Check for platform icons (presence of divs with specific title attributes from platformConfig)
    const platformIconContainer = within(connectedPlatformsCard!).getByText('3').nextElementSibling; // The div with icons is usually after the count
    expect(platformIconContainer?.children.length).toBe(3); // 3 platform icons
  });
});
