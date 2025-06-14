import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameLibrary } from './GameLibrary'; // Adjust path as necessary
import { Game } from '@/data/mockGameData'; // Assuming Game type is exported
import fetchMock from 'jest-fetch-mock';

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
  GameCard: ({ game }: { game: Game }) => (
    <div data-testid={`game-card-${game.id}`} aria-label={game.title}>
      {game.title}
    </div>
  ),
}));

const mockGames: Game[] = [
  { id: '1', title: 'Local Game 1', platform: 'pc', genre: 'RPG', releaseDate: '2023-01-01', imageUrl: '', playtime: 10, achievements: { current: 5, total: 10 }, rating: 5, status: 'played' },
  { id: '2', title: 'Local Game 2', platform: 'xbox', genre: 'Action', releaseDate: '2022-05-10', imageUrl: '', playtime: 25, achievements: { current: 1, total: 20 }, rating: 4, status: 'owned' },
];

describe('GameLibrary Component', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it('should render local games initially', () => {
    render(<GameLibrary games={mockGames} selectedPlatform="all" onPlatformChange={() => {}} />);
    expect(screen.getByText('Local Game 1')).toBeInTheDocument();
    expect(screen.getByText('Local Game 2')).toBeInTheDocument();
  });

  it('should fetch and display Steam games when steamId is provided', async () => {
    const mockSteamGames = [
      { appID: 730, name: 'Counter-Strike 2', playtimeForever: 12000, imgIconURL: 'csgo.jpg' },
      { appID: 570, name: 'Dota 2', playtimeForever: 30000, imgIconURL: 'dota2.jpg' },
    ];
    fetchMock.mockResponseOnce(JSON.stringify(mockSteamGames));

    const steamId = 'teststeamid123';
    render(
      <GameLibrary
        games={mockGames}
        selectedPlatform="all"
        onPlatformChange={() => {}}
        steamId={steamId}
      />
    );

    // Check for loading state (optional, depends on how quick the mock resolves)
    // expect(screen.getByText('Loading Steam games...')).toBeInTheDocument(); // Or check for loader icon

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/steam/user/${steamId}/games`);
    });

    // Check if Steam games are displayed (transformed to Game type by the component)
    expect(await screen.findByText('Counter-Strike 2')).toBeInTheDocument();
    expect(await screen.findByText('Dota 2')).toBeInTheDocument();

    // Check if local games are still there
    expect(screen.getByText('Local Game 1')).toBeInTheDocument();

    // Check if "Steam" platform filter button is available
    const steamPlatformButton = await screen.findByRole('button', { name: /Steam/ });
    expect(steamPlatformButton).toBeInTheDocument();
    // Check count on steam platform button (2 steam games)
    expect(within(steamPlatformButton).getByText('2')).toBeInTheDocument();

  });

  it('should display an error message if fetching Steam games fails', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: 'Failed to load Steam games' }), { status: 500 });
    const steamId = 'errorsteamid';

    render(
      <GameLibrary
        games={mockGames}
        selectedPlatform="all"
        onPlatformChange={() => {}}
        steamId={steamId}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/steam/user/${steamId}/games`);
    });

    expect(await screen.findByText('Error Loading Steam Games')).toBeInTheDocument();
    expect(await screen.findByText('Failed to load Steam games')).toBeInTheDocument(); // The specific error message from API
  });

  it('should display loading indicator for Steam games', async () => {
    fetchMock.mockResponseOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // delay response
      return JSON.stringify([]);
    });
    const steamId = 'loadingsteamid';

    render(
      <GameLibrary
        games={[]}
        selectedPlatform="all"
        onPlatformChange={() => {}}
        steamId={steamId}
      />
    );
    // Check that loading text IS present initially
    expect(screen.getByText('Loading Steam games...')).toBeInTheDocument();

    // Wait for the fetch to complete and the loading text to DISAPPEAR
    await waitFor(() => {
      expect(screen.queryByText('Loading Steam games...')).not.toBeInTheDocument();
    });
    // Also ensure fetch was called
    expect(fetchMock).toHaveBeenCalledWith(`/api/steam/user/${steamId}/games`);
  });

  // TODO: Add tests for filtering behavior when Steam games are present
});
