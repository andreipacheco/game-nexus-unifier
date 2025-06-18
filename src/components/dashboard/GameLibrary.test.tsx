import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameLibrary } from './GameLibrary';
import { Game, PlatformInfo } from '@/data/mockGameData'; // Assuming Game type is exported, Added PlatformInfo
import { useSteam } from '@/contexts/SteamContext'; // Import useSteam
import { useGog } from '@/contexts/GogContext'; // Import useGog
import { useXbox } from '@/contexts/XboxContext'; // Import useXbox
import { usePlaystation, PlaystationGame } from '@/contexts/PlaystationContext'; // Import usePlaystation and PlaystationGame type
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
// Mock useGog hook
jest.mock('@/contexts/GogContext', () => ({
  useGog: jest.fn(),
}));
// Mock useXbox hook
jest.mock('@/contexts/XboxContext', () => ({
  useXbox: jest.fn(),
}));
// Mock usePlaystation hook
jest.mock('@/contexts/PlaystationContext', () => ({
  usePlaystation: jest.fn(),
}));

const mockUseSteam = useSteam as jest.Mock;
const mockUseGog = useGog as jest.Mock;
const mockUseXbox = useXbox as jest.Mock;
const mockUsePlaystation = usePlaystation as jest.Mock;


describe('GameLibrary Component', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    mockGameCard.mockClear(); // Clear mock before each test

    // Default mock values for all contexts
    mockUseSteam.mockReturnValue({
      steamId: null, steamUser: null, isAuthenticated: false,
      isLoadingSteamProfile: false, steamProfileError: null,
    });
    mockUseGog.mockReturnValue({
      gogUserId: null, isLoadingGogGames: false, gogGamesError: null,
      // Assuming gogGames are fetched internally or not relevant for default GameLibrary state here
    });
    mockUseXbox.mockReturnValue({
      xboxGames: [], isLoading: false, error: null,
    });
    mockUsePlaystation.mockReturnValue({
      npssoToken: null, playstationGames: [], isLoadingPlaystation: false, errorPlaystation: null,
    });
  });

  it('should render local games initially when no platforms are connected', () => {
    render(<GameLibrary games={mockGames} selectedPlatform="all" onPlatformChange={jest.fn()} />);
    expect(screen.getByText('Local Game 1 - Achievements: 5/10')).toBeInTheDocument();
    expect(screen.getByText('Local Game 2 - Achievements: 1/20')).toBeInTheDocument();
    expect(screen.queryByText(/Counter-Strike 2/i)).not.toBeInTheDocument(); // Steam game should not be there
  });

  // --- Steam Tests (existing, slightly adapted) ---
  it('should fetch and display Steam games when steamId is present', async () => {
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
        onPlatformChange={jest.fn()}
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
        onPlatformChange={jest.fn()}
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
        onPlatformChange={jest.fn()}
      />
    );
    expect(screen.getByText('Loading Steam games...')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText('Loading Steam games...')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(`/api/steam/user/${steamId}/games`);
  });

  it('should not show Steam filter or fetch games if steamId is null', () => {
    // Default state from beforeEach already has steamId: null
    render(<GameLibrary games={mockGames} selectedPlatform="all" onPlatformChange={jest.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    // Check if the platform filter button for Steam is NOT rendered
    // This depends on how platformFilters are constructed. If it relies on currentPlatformInfo, it might always show.
    // The logic in GameLibrary for platformFilters is:
    // .filter(f => f.count > 0 || f.key === 'all' || (isConnected logic))
    // If not connected and no games, it shouldn't show.
    expect(screen.queryByRole('button', { name: /Steam \d+/i })).not.toBeInTheDocument();
  });

  // --- Playstation Tests ---
  const mockPSGames: PlaystationGame[] = [
    { npCommunicationId: 'NPWR001', name: 'PS Game 1', image: 'ps1.jpg', platform: 'PS5', trophySummary: { progress: 50, earnedTrophies: { bronze: 10, silver: 5, gold: 1, platinum: 1 }, definedTrophies: { bronze: 20, silver: 10, gold: 2, platinum: 1 } }, hasTrophyGroups: false, lastUpdatedDateTime: new Date().toISOString() },
    { npCommunicationId: 'NPWR002', name: 'PS Game 2', image: 'ps2.jpg', platform: 'PS4', trophySummary: { progress: 20, earnedTrophies: { bronze: 5, silver: 2, gold: 0, platinum: 0 }, definedTrophies: { bronze: 25, silver: 15, gold: 5, platinum: 1 } }, hasTrophyGroups: true, lastUpdatedDateTime: new Date().toISOString() },
  ];

  it('renders Playstation filter button with correct count when connected', async () => {
    mockUsePlaystation.mockReturnValueOnce({
      npssoToken: 'mock-npsso-token',
      playstationGames: mockPSGames,
      isLoadingPlaystation: false,
      errorPlaystation: null,
    });
    render(<GameLibrary games={[]} selectedPlatform="all" onPlatformChange={jest.fn()} />);

    const psFilterButton = await screen.findByRole('button', { name: /Playstation \d+/i });
    expect(psFilterButton).toBeInTheDocument();
    expect(within(psFilterButton).getByText('2')).toBeInTheDocument(); // Count of mockPSGames
  });

  it('displays Playstation games when data is available', async () => {
    mockUsePlaystation.mockReturnValueOnce({
      npssoToken: 'mock-npsso-token',
      playstationGames: mockPSGames,
      isLoadingPlaystation: false,
      errorPlaystation: null,
    });
    render(<GameLibrary games={[]} selectedPlatform="all" onPlatformChange={jest.fn()} />);

    expect(await screen.findByText(/PS Game 1 - Achievements: 17\/34/i)).toBeInTheDocument();
    expect(await screen.findByText(/PS Game 2 - Achievements: 7\/46/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGameCard).toHaveBeenCalledWith(expect.objectContaining({
        game: expect.objectContaining({ id: 'playstation-NPWR001', title: 'PS Game 1', platform: 'playstation' })
      }));
      expect(mockGameCard).toHaveBeenCalledWith(expect.objectContaining({
        game: expect.objectContaining({ id: 'playstation-NPWR002', title: 'PS Game 2', platform: 'playstation' })
      }));
    });
  });

  it('filters by Playstation games when "Playstation" filter is selected', async () => {
    mockUsePlaystation.mockReturnValueOnce({
      npssoToken: 'mock-npsso-token',
      playstationGames: mockPSGames,
      isLoadingPlaystation: false,
      errorPlaystation: null,
    });
    // Render with "playstation" selected
    render(<GameLibrary games={mockGames} selectedPlatform="playstation" onPlatformChange={jest.fn()} />);

    expect(await screen.findByText(/PS Game 1 - Achievements: 17\/34/i)).toBeInTheDocument();
    expect(await screen.findByText(/PS Game 2 - Achievements: 7\/46/i)).toBeInTheDocument();
    expect(screen.queryByText('Local Game 1 - Achievements: 5/10')).not.toBeInTheDocument();
  });

  it('displays loading indicator for Playstation games', () => {
    mockUsePlaystation.mockReturnValueOnce({
      npssoToken: 'mock-npsso-token',
      playstationGames: [],
      isLoadingPlaystation: true,
      errorPlaystation: null,
    });
    render(<GameLibrary games={[]} selectedPlatform="all" onPlatformChange={jest.fn()} />);
    expect(screen.getByText('Loading Playstation games...')).toBeInTheDocument();
  });

  it('displays error message for Playstation games', async () => {
    mockUsePlaystation.mockReturnValueOnce({
      npssoToken: 'mock-npsso-token',
      playstationGames: [],
      isLoadingPlaystation: false,
      errorPlaystation: 'Fake PSN Connection Error',
    });
    render(<GameLibrary games={[]} selectedPlatform="all" onPlatformChange={jest.fn()} />);
    expect(await screen.findByText('Error Loading Playstation Games')).toBeInTheDocument();
    expect(await screen.findByText('Fake PSN Connection Error')).toBeInTheDocument();
  });
});
