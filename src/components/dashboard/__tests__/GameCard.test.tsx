import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameCard } from '../GameCard';
import { Game, platformInfo } from '@/data/mockGameData';
import { XboxContext, XboxContextType, XboxDetailedAchievement } from '@/contexts/XboxContext';
import { ToastProvider } from '@/components/ui/toast';
import { DetailedAchievementsModalProps } from '../DetailedAchievementsModal'; // For mocking

// Mock the DetailedAchievementsModal to verify props and open state
jest.mock('../DetailedAchievementsModal', () => ({
  DetailedAchievementsModal: jest.fn(({ isOpen, gameName, achievements, isLoading, error, onClose }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="mock-detailed-achievements-modal">
        <h2 data-testid="modal-gamename">{gameName}</h2>
        {isLoading && <div data-testid="modal-loading">Loading...</div>}
        {error && <div data-testid="modal-error">{error}</div>}
        {achievements && achievements.map(ach => <div key={ach.id} data-testid={`ach-${ach.id}`}>{ach.name}</div>)}
        <button onClick={onClose} data-testid="modal-close-button">Close Modal</button>
      </div>
    );
  }),
}));

// Mock lucide-react icons used in GameCard
jest.mock('lucide-react', () => {
  const original = jest.requireActual('lucide-react');
  return {
    ...original,
    Clock: () => <span data-testid="clock-icon" />,
    Trophy: () => <span data-testid="trophy-icon" />,
    Play: () => <span data-testid="play-icon" />,
    Download: () => <span data-testid="download-icon" />,
    MoreVertical: () => <span data-testid="more-icon" />,
    ListChecks: () => <span data-testid="listchecks-icon" />, // Used for "View Achievements"
  };
});

const mockGameSteam: Game = {
  id: 'steam-123',
  appId: '123',
  title: 'Steam Game Test',
  platform: 'steam',
  coverImage: 'steam.jpg',
  playtime: 10,
  lastPlayed: new Date().toISOString(),
  achievements: { unlocked: 5, total: 10 },
  status: 'installed',
  genre: ['Action'],
  releaseYear: 2022,
};

const mockGameXbox: Game = {
  id: 'xbox-456', // This ID will be used (substring) as titleId
  title: 'Xbox Game Test',
  platform: 'xbox',
  coverImage: 'xbox.jpg',
  playtime: 0, // Xbox games from context don't have playtime from this source
  lastPlayed: new Date().toISOString(),
  achievements: { unlocked: 3, total: 15, currentGamerscore: 30, totalGamerscore: 150 },
  status: 'owned',
  genre: ['Adventure'],
  releaseYear: 2023,
};

describe('GameCard', () => {
  const mockFetchDetailedXboxAchievements = jest.fn();
  let xboxContextValue: XboxContextType;

  const renderGameCardWithXboxContext = (game: Game, contextOverrides?: Partial<XboxContextType>) => {
    xboxContextValue = {
      xboxGames: [],
      isLoading: false,
      error: null,
      fetchXboxGames: jest.fn(),
      detailedAchievements: {},
      isLoadingDetailedAchievements: {},
      errorDetailedAchievements: {},
      currentXuid: 'test-user-xuid', // Default XUID for tests
      fetchDetailedXboxAchievements: mockFetchDetailedXboxAchievements,
      ...contextOverrides,
    };

    return render(
      <ToastProvider> {/* Assuming GameCard or its children might use toast indirectly */}
        <XboxContext.Provider value={xboxContextValue}>
          <GameCard game={game} />
        </XboxContext.Provider>
      </ToastProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock for DetailedAchievementsModal before each test
    (require('../DetailedAchievementsModal').DetailedAchievementsModal as jest.Mock).mockClear();
  });

  it('renders common game information (title, image, platform badge)', () => {
    renderGameCardWithXboxContext(mockGameSteam);
    expect(screen.getByText(mockGameSteam.title)).toBeInTheDocument();
    expect(screen.getByAltText(mockGameSteam.title)).toHaveAttribute('src', mockGameSteam.coverImage);
    expect(screen.getByText(platformInfo.steam.name)).toBeInTheDocument(); // Platform name from platformInfo
  });

  it('does NOT render "View Achievements" button for non-Xbox games', () => {
    renderGameCardWithXboxContext(mockGameSteam);
    expect(screen.queryByRole('button', { name: /View Achievements/i })).not.toBeInTheDocument();
  });

  describe('Xbox Game Specific Tests', () => {
    it('renders "View Achievements" button for Xbox games', () => {
      renderGameCardWithXboxContext(mockGameXbox);
      const achievementsButton = screen.getByRole('button', { name: /View Achievements/i });
      expect(achievementsButton).toBeInTheDocument();
      expect(screen.getByTestId('listchecks-icon')).toBeInTheDocument(); // Check for icon presence
    });

    it('disables "View Achievements" button if currentXuid is null', () => {
      renderGameCardWithXboxContext(mockGameXbox, { currentXuid: null });
      const achievementsButton = screen.getByRole('button', { name: /View Achievements/i });
      expect(achievementsButton).toBeDisabled();
    });

    it('clicking "View Achievements" calls fetchDetailedXboxAchievements and opens modal', async () => {
      renderGameCardWithXboxContext(mockGameXbox);
      const achievementsButton = screen.getByRole('button', { name: /View Achievements/i });

      fireEvent.click(achievementsButton);

      const expectedTitleId = mockGameXbox.id.substring(5); // Remove "xbox-" prefix
      expect(mockFetchDetailedXboxAchievements).toHaveBeenCalledWith(xboxContextValue.currentXuid, expectedTitleId);

      // Check if DetailedAchievementsModal was rendered (mocked version) with isOpen=true
      // The mock modal renders content only if isOpen is true.
      await waitFor(() => {
        expect(screen.getByTestId('mock-detailed-achievements-modal')).toBeInTheDocument();
      });

      // Verify props passed to the mocked modal
      const MockedModal = require('../DetailedAchievementsModal').DetailedAchievementsModal as jest.Mock;
      const lastCallProps = MockedModal.mock.calls[MockedModal.mock.calls.length - 1][0] as DetailedAchievementsModalProps;
      expect(lastCallProps.isOpen).toBe(true);
      expect(lastCallProps.gameName).toBe(mockGameXbox.title);
    });

    it('passes correct achievement data, loading, and error states to modal', async () => {
      const titleId = mockGameXbox.id.substring(5);
      const mockDetailedData: XboxDetailedAchievement[] = [{ id: 'detail1', name: 'Detailed Ach 1', description: 'Desc', isUnlocked: true, gamerscore: 20 }];
      const contextWithData = {
        currentXuid: 'test-user-xuid',
        detailedAchievements: { [titleId]: mockDetailedData },
        isLoadingDetailedAchievements: { [titleId]: false },
        errorDetailedAchievements: { [titleId]: null },
      };
      renderGameCardWithXboxContext(mockGameXbox, contextWithData);

      const achievementsButton = screen.getByRole('button', { name: /View Achievements/i });
      fireEvent.click(achievementsButton);

      await waitFor(() => {
        expect(screen.getByTestId('mock-detailed-achievements-modal')).toBeInTheDocument();
      });

      const MockedModal = require('../DetailedAchievementsModal').DetailedAchievementsModal as jest.Mock;
      const lastCallProps = MockedModal.mock.calls[MockedModal.mock.calls.length - 1][0] as DetailedAchievementsModalProps;

      expect(lastCallProps.achievements).toEqual(mockDetailedData);
      expect(lastCallProps.isLoading).toBe(false);
      expect(lastCallProps.error).toBeNull();

      // Test with loading state
      const contextLoading = { ...contextWithData, isLoadingDetailedAchievements: { [titleId]: true } };
      renderGameCardWithXboxContext(mockGameXbox, contextLoading);
      fireEvent.click(screen.getByRole('button', { name: /View Achievements/i }));
      await waitFor(() => expect(screen.getByTestId('modal-loading')).toBeInTheDocument());


      // Test with error state
      const errorMsg = "Failed to load";
      const contextError = { ...contextWithData, detailedAchievements: { [titleId]: [] }, errorDetailedAchievements: { [titleId]: errorMsg } };
      renderGameCardWithXboxContext(mockGameXbox, contextError);
      fireEvent.click(screen.getByRole('button', { name: /View Achievements/i }));
      await waitFor(() => expect(screen.getByTestId('modal-error')).toHaveTextContent(errorMsg));
    });

    it('modal closes when onClose is triggered from mocked modal', async () => {
        renderGameCardWithXboxContext(mockGameXbox);
        const achievementsButton = screen.getByRole('button', { name: /View Achievements/i });
        fireEvent.click(achievementsButton);

        await waitFor(() => {
            expect(screen.getByTestId('mock-detailed-achievements-modal')).toBeInTheDocument();
        });

        const closeButtonInMock = screen.getByTestId('modal-close-button');
        fireEvent.click(closeButtonInMock);

        await waitFor(() => {
            expect(screen.queryByTestId('mock-detailed-achievements-modal')).not.toBeInTheDocument();
        });
    });
  });
});
