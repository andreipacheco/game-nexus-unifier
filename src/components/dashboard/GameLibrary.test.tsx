import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameLibrary } from './GameLibrary';
import { Game } from '@/data/mockGameData';
import { useAuth } from '@/contexts/AuthContext';
import { useSteam } from '@/contexts/SteamContext';
import { useGog } from '@/contexts/GogContext';
import { useXbox } from '@/contexts/XboxContext'; // Import useXbox
// import fetchMock from 'jest-fetch-mock'; // fetch is globally mocked

// Define SteamUserProfile for mockSteamProfile if needed for explicit typing
type SteamUserProfile = { personaName: string; avatarFull: string; profileUrl: string };

// Mock PsnTrophyData as it's rendered by GameLibrary but not the focus of these tests
jest.mock('./PsnTrophyData', () => () => <div data-testid="psn-trophy-data-mock">PsnTrophyData Mock</div>);

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const originalLucide = jest.requireActual('lucide-react');
  return {
    ...originalLucide,
    Search: () => <svg data-testid="search-icon" />,
    Download: () => <svg data-testid="download-icon" />,
    AlertTriangle: () => <svg data-testid="alert-icon" />,
    Loader2: () => <svg data-testid="loader-icon" />,
    Gamepad2: () => <svg data-testid="gamepad-icon" />, // For PSN platform icon
  };
});

// Mock GameCard
const mockGameCard = jest.fn();
jest.mock('./GameCard', () => ({
  GameCard: (props: { game: Game }) => {
    mockGameCard(props);
    return (
      <div data-testid={`game-card-${props.game.id}`} aria-label={props.game.title}>
        {props.game.title}
      </div>
    );
  },
}));

// Mock contexts
const mockUseAuth = useAuth as jest.Mock;
const mockUseSteam = useSteam as jest.Mock;
const mockUseGog = useGog as jest.Mock;
const mockUseXbox = useXbox as jest.Mock; // Added mock for useXbox

jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/SteamContext');
jest.mock('@/contexts/GogContext');
jest.mock('@/contexts/XboxContext'); // Mock the Xbox context

// Mock localStorage for psnAuthToken check
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value.toString(); }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch globally
global.fetch = jest.fn();

const mockPlatformGames: Game[] = [
  { id: '1', title: 'Steam Game Alpha', platform: 'steam', coverImage: 'steam_alpha.jpg', achievements: { unlocked: 1, total: 10 }, playtime: 10, lastPlayed: '', status: 'owned', genre: ['Action'], releaseYear: 2020 },
  { id: '2', title: 'PSN Game Beta', platform: 'PSN', coverImage: 'psn_beta.jpg', achievements: { unlocked: 2, total: 20 }, playtime: 0, lastPlayed: '', status: 'owned', genre: ['Adventure'], releaseYear: 2021 },
  { id: '3', title: 'Xbox Game Gamma', platform: 'xbox', coverImage: 'xbox_gamma.jpg', achievements: { unlocked: 3, total: 30 }, playtime: 30, lastPlayed: '', status: 'owned', genre: ['RPG'], releaseYear: 2022 },
  { id: '4', title: 'PSN Game Delta', platform: 'PSN', coverImage: 'psn_delta.jpg', achievements: { unlocked: 4, total: 40 }, playtime: 0, lastPlayed: '', status: 'owned', genre: ['Strategy'], releaseYear: 2023 },
  { id: '5', title: 'GOG Game Epsilon', platform: 'gog', coverImage: 'gog_epsilon.jpg', achievements: { unlocked: 5, total: 50 }, playtime: 50, lastPlayed: '', status: 'owned', genre: ['Indie'], releaseYear: 2024 },
];

describe('GameLibrary Component - Refactored Data Flow', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
    mockGameCard.mockClear();
    localStorageMock.clear();

    // Default mock implementations
    mockUseAuth.mockReturnValue({ user: { id: 'testUserId' }, isAuthenticated: true });
    mockUseSteam.mockReturnValue({ steamId: 'testSteamId', steamUser: { personaName: 'SteamUser' } });
    mockUseGog.mockReturnValue({ gogUserId: 'testGogId' });
    mockUseXbox.mockReturnValue({ xuid: null, errorXbox: null, isLoadingXbox: false }); // Default Xbox not connected
    localStorageMock.setItem('psnAuthToken', 'testPsnToken');
  });

  it('fetches and displays games from the consolidated endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlatformGames,
    });

    render(<GameLibrary selectedPlatform="all" onPlatformChange={jest.fn()} />);

    expect(screen.getByText(/Loading all games/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Steam Game Alpha')).toBeInTheDocument();
      expect(screen.getByText('PSN Game Beta')).toBeInTheDocument();
      expect(screen.getByText('Xbox Game Gamma')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/user/testUserId/games');
  });

  it('displays an error message if fetching games fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server Error' }),
    });

    render(<GameLibrary selectedPlatform="all" onPlatformChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Games')).toBeInTheDocument();
      expect(screen.getByText(/Server Error/i)).toBeInTheDocument();
    });
  });

  it('shows PlayStation filter button when PSN is connected', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [] }); // No games needed for this check
    render(<GameLibrary selectedPlatform="all" onPlatformChange={jest.fn()} />);

    // Wait for loading to complete to ensure filters are processed
    await waitFor(() => expect(screen.queryByText(/Loading all games/i)).not.toBeInTheDocument());

    expect(screen.getByRole('button', { name: /PlayStation/i })).toBeInTheDocument();
  });

  describe('Xbox Platform Filter Visibility', () => {
    it('shows Xbox filter button when Xbox is connected (via context) even if no Xbox games from DB', async () => {
      mockUseXbox.mockReturnValue({ xuid: 'testXboxUser', errorXbox: null, isLoadingXbox: false });
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () =>
        mockPlatformGames.filter(game => game.platform !== 'xbox') // Return games, but no Xbox ones
      });
      render(<GameLibrary selectedPlatform="all" onPlatformChange={jest.fn()} />);
      await waitFor(() => expect(screen.queryByText(/Loading all games/i)).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: /Xbox/i })).toBeInTheDocument();
    });

    it('does not show Xbox filter button when Xbox not connected and no Xbox games from DB', async () => {
      mockUseXbox.mockReturnValue({ xuid: null, errorXbox: null, isLoadingXbox: false });
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () =>
        mockPlatformGames.filter(game => game.platform !== 'xbox')
      });
      render(<GameLibrary selectedPlatform="all" onPlatformChange={jest.fn()} />);
      await waitFor(() => expect(screen.queryByText(/Loading all games/i)).not.toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /Xbox/i })).not.toBeInTheDocument();
    });

    it('shows Xbox filter button when Xbox not connected via context BUT Xbox games are present in DB', async () => {
      mockUseXbox.mockReturnValue({ xuid: null, errorXbox: null, isLoadingXbox: false });
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockPlatformGames }); // Includes Xbox games
      render(<GameLibrary selectedPlatform="all" onPlatformChange={jest.fn()} />);
      await waitFor(() => expect(screen.queryByText(/Loading all games/i)).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: /Xbox/i })).toBeInTheDocument();
    });
  });

  it('filters for PSN games when PlayStation filter is selected', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlatformGames,
    });
    const mockOnPlatformChange = jest.fn();

    render(<GameLibrary selectedPlatform="psn" onPlatformChange={mockOnPlatformChange} />);

    await waitFor(() => { // Ensure games are loaded and initial render with filter is done
      expect(screen.queryByText('Steam Game Alpha')).not.toBeInTheDocument();
      expect(screen.getByText('PSN Game Beta')).toBeInTheDocument();
      expect(screen.getByText('PSN Game Delta')).toBeInTheDocument();
      expect(screen.queryByText('Xbox Game Gamma')).not.toBeInTheDocument();
      expect(screen.queryByText('GOG Game Epsilon')).not.toBeInTheDocument();
    });
  });

  it('displays all games when "All Platforms" filter is selected', async () => {
     (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlatformGames,
    });
    const mockOnPlatformChange = jest.fn();
    render(<GameLibrary selectedPlatform="all" onPlatformChange={mockOnPlatformChange} />);

    await waitFor(() => {
      expect(screen.getByText('Steam Game Alpha')).toBeInTheDocument();
      expect(screen.getByText('PSN Game Beta')).toBeInTheDocument();
      expect(screen.getByText('Xbox Game Gamma')).toBeInTheDocument();
      expect(screen.getByText('PSN Game Delta')).toBeInTheDocument();
      expect(screen.getByText('GOG Game Epsilon')).toBeInTheDocument();
    });
  });

   it('handles empty game list from API', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    render(<GameLibrary selectedPlatform="all" onPlatformChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/No games found/i)).toBeInTheDocument();
      expect(screen.queryByTestId(/game-card-/)).not.toBeInTheDocument();
    });
  });

  it('handles API returning a message instead of game array', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, // API might return 200 OK with a message object
      json: async () => ({ message: "No games available for this user." }),
    });
    render(<GameLibrary selectedPlatform="all" onPlatformChange={jest.fn()} />);

    await waitFor(() => {
      // The component logs a warning and sets games to empty array.
      // The UI should reflect "No games found".
      expect(screen.getByText(/No games found/i)).toBeInTheDocument();
      expect(screen.queryByTestId(/game-card-/)).not.toBeInTheDocument();
      // Optionally, check for the specific message if it were displayed as an error/info
      // For now, it just results in an empty game list.
    });
  });

});
