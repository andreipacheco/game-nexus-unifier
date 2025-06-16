import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameLibrary } from './GameLibrary';
import { Game } from '@/data/mockGameData'; // Assuming Game type is exported
import { useSteam } from '@/contexts/SteamContext'; // Import useSteam
import fetchMock from 'jest-fetch-mock';

// Define SteamUserProfile for mockSteamProfile if needed for explicit typing, mirroring SteamContext.tsx
type SteamUserProfile = { personaName: string; avatarFull: string; profileUrl: string };

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const original = jest.requireActual('lucide-react');
  return {
    ...original,
    Search: () => <svg data-testid="search-icon" />,
    Download: () => <svg data-testid="download-icon" />, // Used for Steam platform icon in GameLibrary
    AlertTriangle: () => <svg data-testid="alert-icon" />,
    Loader2: () => <svg data-testid="loader-icon" />,
  };
});

// Mock GameCard to simplify testing GameLibrary's logic
jest.mock('./GameCard', () => ({
  // GameCard: ({ game }: { game: Game }) => (
  //   <div data-testid={`game-card-${game.id}`} aria-label={game.title}>
  //     {/* Added comment to ensure diff picks up this block for search if needed */}
  //     {game.title}
  //   </div>
  // ),
  // New mock:
  GameCard: (props: { game: Game }) => {
    mockGameCard(props); // Capture props passed to GameCard
    return (
      <div data-testid={`game-card-${props.game.id}`} aria-label={props.game.title}>
        {props.game.title} - Achievements: {props.game.achievements.unlocked}/{props.game.achievements.total}
      </div>
    );
  },
}));

const mockGameCard = jest.fn();

const mockGames: Game[] = [
  {
    id: '1',
    title: 'Local Game 1',
    platform: 'steam', // Changed from 'pc' to a valid platform
    coverImage: '/placeholder.svg', // Added from Game interface
    playtime: 10,
    lastPlayed: '2024-01-15T10:00:00.000Z', // Added from Game interface
    achievements: { unlocked: 5, total: 10 }, // Changed 'current' to 'unlocked'
    status: 'installed', // Changed from 'played' to a valid status
    genre: ['RPG'], // Changed to string[]
    releaseYear: 2023, // Changed from releaseDate
  },
  {
    id: '2',
    title: 'Local Game 2',
    platform: 'xbox',
    coverImage: '/placeholder.svg', // Added from Game interface
    playtime: 25,
    lastPlayed: '2024-03-20T15:30:00.000Z', // Added from Game interface
    achievements: { unlocked: 1, total: 20 }, // Changed 'current' to 'unlocked'
    status: 'not_installed', // Changed from 'owned' to a valid status
    genre: ['Action'], // Changed to string[]
    releaseYear: 2022, // Changed from releaseDate
  },
];

describe('GameLibrary Component', () => {
// Mock useSteam hook
jest.mock('@/contexts/SteamContext', () => ({
  useSteam: jest.fn(),
}));

const mockUseSteam = useSteam as jest.Mock;


describe('GameLibrary Component', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    mockGameCard.mockClear(); // Clear mock before each test
    mockUseSteam.mockReturnValue({
      steamId: null,
      steamUser: null,
      isAuthenticated: false, // Default to not authenticated
      isLoadingSteamProfile: false,
      steamProfileError: null,
    });
  });

  it('should render local games initially when not authenticated', () => {
    render(<GameLibrary games={mockGames} selectedPlatform="all" onPlatformChange={() => {}} />);
    expect(screen.getByText('Local Game 1')).toBeInTheDocument();
    expect(screen.getByText('Local Game 2')).toBeInTheDocument();
    expect(screen.queryByText('Counter-Strike 2')).not.toBeInTheDocument(); // Steam game should not be there
  });

  it('should fetch and display Steam games when steamId and steamUser are in context', async () => {
    const mockSteamGames = [
      {
        appID: 730,
        name: 'Counter-Strike 2',
        playtimeForever: 12000,
        imgIconURL: 'csgo.jpg',
        imgLogoURL: 'csgo_logo.jpg',
        achievements: { unlocked: 50, total: 167 }
      },
      {
        appID: 570,
        name: 'Dota 2',
        playtimeForever: 30000,
        imgIconURL: 'dota2.jpg',
        imgLogoURL: 'dota2_logo.jpg',
        achievements: { unlocked: 10, total: 50 }
      },
    ];
    fetchMock.mockResponseOnce(JSON.stringify(mockSteamGames));
    const steamId = 'teststeamid123';
    const mockSteamProfile: SteamUserProfile = { personaName: 'TestSteam', avatarFull: 'avatar.jpg', profileUrl: 'url' };
    mockUseSteam.mockReturnValue({
      steamId: steamId,
      steamUser: mockSteamProfile,
      isAuthenticated: true, // User is authenticated
      isLoadingSteamProfile: false,
      steamProfileError: null,
    });

    render(
      <GameLibrary
        games={mockGames}
        selectedPlatform="all"
        onPlatformChange={() => {}}
        // steamId prop removed
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/steam/user/${steamId}/games`);
    });

    // Check if Steam games are displayed
    // The GameCard mock now includes achievement text, so we can check for that pattern
    expect(await screen.findByText(/Counter-Strike 2 - Achievements: 50\/167/i)).toBeInTheDocument();
    expect(await screen.findByText(/Dota 2 - Achievements: 10\/50/i)).toBeInTheDocument();
    expect(screen.getByText('Local Game 1')).toBeInTheDocument(); // Local games still present

    const steamPlatformButton = await screen.findByRole('button', { name: /Steam/ });
    expect(steamPlatformButton).toBeInTheDocument();
    expect(within(steamPlatformButton).getByText('2')).toBeInTheDocument(); // Count for Steam games

    // Example assertion (add this inside the test case):
    await waitFor(() => { // Ensure games are processed
      expect(mockGameCard).toHaveBeenCalledWith(
        expect.objectContaining({
          game: expect.objectContaining({
            id: 'steam-730', // ID after transformation by steamGameToGameType
            title: 'Counter-Strike 2',
            achievements: { unlocked: 50, total: 167 },
          }),
        })
      );
      expect(mockGameCard).toHaveBeenCalledWith(
        expect.objectContaining({
          game: expect.objectContaining({
            id: 'steam-570', // ID after transformation by steamGameToGameType
            title: 'Dota 2',
            achievements: { unlocked: 10, total: 50 },
          }),
        })
      );
    });
  });

  it('should display an error message if fetching Steam games fails when steamId is in context', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: 'Failed to load Steam games' }), { status: 500 });
    const steamId = 'errorsteamid';
    const mockSteamProfile: SteamUserProfile = { personaName: 'TestSteam', avatarFull: 'avatar.jpg', profileUrl: 'url' };
    mockUseSteam.mockReturnValue({
      steamId: steamId,
      steamUser: mockSteamProfile,
      isAuthenticated: true,
      isLoadingSteamProfile: false,
      steamProfileError: null,
    });

    render(
      <GameLibrary
        games={mockGames}
        selectedPlatform="all"
        onPlatformChange={() => {}}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/steam/user/${steamId}/games`);
    });

    expect(await screen.findByText('Error Loading Steam Games')).toBeInTheDocument();
    expect(await screen.findByText('Failed to load Steam games')).toBeInTheDocument();
  });

  it('should display loading indicator for Steam games when steamId is in context', async () => {
    fetchMock.mockResponseOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return JSON.stringify([]);
    });
    const steamId = 'loadingsteamid';
    const mockSteamProfile: SteamUserProfile = { personaName: 'TestSteam', avatarFull: 'avatar.jpg', profileUrl: 'url' };
    mockUseSteam.mockReturnValue({
      steamId: steamId,
      steamUser: mockSteamProfile,
      isAuthenticated: true,
      isLoadingSteamProfile: false,
      steamProfileError: null,
    });

    render(
      <GameLibrary
        games={[]}
        selectedPlatform="all"
        onPlatformChange={() => {}}
      />
    );
    expect(screen.getByText('Loading Steam games...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading Steam games...')).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/steam/user/${steamId}/games`);
  });

  it('should not fetch Steam games if steamId is null in context', () => {
    mockUseSteam.mockReturnValue({
        steamId: null,
        steamUser: null,
        isAuthenticated: false,
        isLoadingSteamProfile: false,
        steamProfileError: null,
    });
    render(<GameLibrary games={mockGames} selectedPlatform="all" onPlatformChange={() => {}} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Steam/ })).not.toBeInTheDocument(); // Steam filter should not show
  });

  // TODO: Add tests for filtering behavior when Steam games are present and selectedPlatform changes
});
