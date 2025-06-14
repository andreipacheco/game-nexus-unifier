import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameLibrary } from './GameLibrary';
import { Game, SteamUserProfile } from '@/data/mockGameData'; // Assuming Game type is exported, added SteamUserProfile for mock
import { useSteam } from '@/contexts/SteamContext'; // Import useSteam
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
      {/* Added comment to ensure diff picks up this block for search if needed */}
      {game.title}
    </div>
  ),
}));

const mockGames: Game[] = [
  { id: '1', title: 'Local Game 1', platform: 'pc', genre: 'RPG', releaseDate: '2023-01-01', imageUrl: '', playtime: 10, achievements: { current: 5, total: 10 }, rating: 5, status: 'played' },
  { id: '2', title: 'Local Game 2', platform: 'xbox', genre: 'Action', releaseDate: '2022-05-10', imageUrl: '', playtime: 25, achievements: { current: 1, total: 20 }, rating: 4, status: 'owned' },
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
    mockUseSteam.mockReturnValue({ // Default mock for tests not focusing on Steam
      steamId: null,
      steamUser: null,
      isLoadingSteamProfile: false,
      steamProfileError: null,
    });
  });

  it('should render local games initially when no steamId in context', () => {
    render(<GameLibrary games={mockGames} selectedPlatform="all" onPlatformChange={() => {}} />);
    expect(screen.getByText('Local Game 1')).toBeInTheDocument();
    expect(screen.getByText('Local Game 2')).toBeInTheDocument();
    expect(screen.queryByText('Counter-Strike 2')).not.toBeInTheDocument(); // Steam game should not be there
  });

  it('should fetch and display Steam games when steamId and steamUser are in context', async () => {
    const mockSteamGames = [
      { appID: 730, name: 'Counter-Strike 2', playtimeForever: 12000, imgIconURL: 'csgo.jpg' },
      { appID: 570, name: 'Dota 2', playtimeForever: 30000, imgIconURL: 'dota2.jpg' },
    ];
    fetchMock.mockResponseOnce(JSON.stringify(mockSteamGames));
    const steamId = 'teststeamid123';
    const mockSteamProfile: SteamUserProfile = { personaName: 'TestSteam', avatarFull: 'avatar.jpg', profileUrl: 'url' };
    mockUseSteam.mockReturnValue({
      steamId: steamId,
      steamUser: mockSteamProfile, // steamUser is needed for the filter to appear
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
    expect(await screen.findByText('Counter-Strike 2')).toBeInTheDocument();
    expect(await screen.findByText('Dota 2')).toBeInTheDocument();
    expect(screen.getByText('Local Game 1')).toBeInTheDocument(); // Local games still present

    const steamPlatformButton = await screen.findByRole('button', { name: /Steam/ });
    expect(steamPlatformButton).toBeInTheDocument();
    expect(within(steamPlatformButton).getByText('2')).toBeInTheDocument(); // Count for Steam games
  });

  it('should display an error message if fetching Steam games fails when steamId is in context', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: 'Failed to load Steam games' }), { status: 500 });
    const steamId = 'errorsteamid';
    const mockSteamProfile: SteamUserProfile = { personaName: 'TestSteam', avatarFull: 'avatar.jpg', profileUrl: 'url' };
    mockUseSteam.mockReturnValue({
      steamId: steamId,
      steamUser: mockSteamProfile,
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
    mockUseSteam.mockReturnValue({ // steamId is null by default in this mock setup
        steamId: null,
        steamUser: null,
        isLoadingSteamProfile: false,
        steamProfileError: null,
    });
    render(<GameLibrary games={mockGames} selectedPlatform="all" onPlatformChange={() => {}} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Steam/ })).not.toBeInTheDocument(); // Steam filter should not show
  });

  // TODO: Add tests for filtering behavior when Steam games are present and selectedPlatform changes
});
