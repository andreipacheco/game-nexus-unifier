import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom'; // For .toBeInTheDocument() etc.
import { PlatformConnections } from '../PlatformConnections';
import { XboxContext, XboxContextType } from '../../../contexts/XboxContext';
import { AuthContextType, AuthProvider } from '../../../contexts/AuthContext'; // Using real AuthProvider
import { SteamContextType, SteamProvider } from '../../../contexts/SteamContext'; // Using real SteamProvider
import { GogContextType, GogProvider } from '../../../contexts/GogContext'; // Using real GogProvider
import { ToastProvider } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';

// Mock the actual useToast hook
jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(),
}));

// Mock child contexts if their full functionality isn't needed or to simplify tests
// For this test, we mostly care about the Xbox part, so Steam/GOG can be basic.
// AuthContext is used for Steam connection, so provide a mock user.
jest.mock('../../../contexts/AuthContext', () => {
  const originalAuthContext = jest.requireActual('../../../contexts/AuthContext');
  return {
    ...originalAuthContext, // Keep other exports like AuthProvider
    useAuth: () => ({
      user: { _id: 'test-user-id', username: 'TestUser', email: 'test@example.com', platformProfiles: {} },
      login: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
      error: null,
      fetchCurrentUser: jest.fn(),
      updateUserPlatformProfile: jest.fn(),
    } as AuthContextType),
  };
});

jest.mock('../../../contexts/SteamContext', () => {
  const originalSteamContext = jest.requireActual('../../../contexts/SteamContext');
  return {
    ...originalSteamContext,
    useSteam: () => ({
      steamUser: null,
      steamId: null,
      isAuthenticated: false,
      isLoadingSteamProfile: false,
      steamProfileError: null,
      checkUserSession: jest.fn(),
      clearSteamConnection: jest.fn(),
    } as SteamContextType),
  };
});

jest.mock('../../../contexts/GogContext', () => {
  const originalGogContext = jest.requireActual('../../../contexts/GogContext');
  return {
    ...originalGogContext,
    useGog: () => ({
      gogUserId: null,
      isLoadingGogUserId: false,
      gogUserError: null,
      connectGogUser: jest.fn(),
      disconnectGogUser: jest.fn(),
    } as GogContextType),
  };
});


// Mock axios for any calls that might originate from providers if not fully mocked
jest.mock('axios');


describe('PlatformConnections - Xbox Integration', () => {
  const mockFetchXboxGames = jest.fn();

  // Helper to render PlatformConnections with specific XboxContext value
  const renderWithXboxContext = (xboxContextValue?: Partial<XboxContextType>) => {
    const defaultXboxContextValues: XboxContextType = {
      xboxGames: [],
      isLoading: false,
      error: null,
      fetchXboxGames: mockFetchXboxGames,
    };

    // Merge provided values with defaults
    const effectiveXboxContextValue = { ...defaultXboxContextValues, ...xboxContextValue };

    return render(
      <AuthProvider> {/* Real providers to ensure the component tree is somewhat realistic */}
        <SteamProvider>
          <GogProvider>
            <XboxContext.Provider value={effectiveXboxContextValue}>
              <ToastProvider> {/* Required by XboxContext for toasts, and potentially by PlatformConnections */}
                <PlatformConnections />
              </ToastProvider>
            </XboxContext.Provider>
          </GogProvider>
        </SteamProvider>
      </AuthProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Xbox connection section with input and button', async () => {
    renderWithXboxContext();
    // The title "Xbox (xbl.io)" is defined in the platforms array within PlatformConnections
    expect(screen.getByText('Xbox (xbl.io)')).toBeInTheDocument();

    // Check for the description text too
    expect(screen.getByText(/Connect via xbl.io using your Xbox User ID \(XUID\)/i)).toBeInTheDocument();

    const xuidInput = screen.getByLabelText(/Xbox User ID \(XUID\)/i);
    expect(xuidInput).toBeInTheDocument();
    expect(xuidInput).toHaveAttribute('placeholder', 'Enter your XUID');

    expect(screen.getByRole('button', { name: /Load Xbox Games/i })).toBeInTheDocument();
  });

  it('calls fetchXboxGames with XUID when "Load Xbox Games" button is clicked', async () => {
    renderWithXboxContext();
    const xuid = 'test-xuid-123';
    const xuidInput = screen.getByLabelText(/Xbox User ID \(XUID\)/i);
    const loadButton = screen.getByRole('button', { name: /Load Xbox Games/i });

    fireEvent.change(xuidInput, { target: { value: xuid } });
    expect(loadButton).not.toBeDisabled(); // Button should be enabled after typing XUID
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(mockFetchXboxGames).toHaveBeenCalledWith(xuid);
    });
  });

  it('disables "Load Xbox Games" button if XUID input is empty', () => {
    renderWithXboxContext();
    const xuidInput = screen.getByLabelText(/Xbox User ID \(XUID\)/i);
    const loadButton = screen.getByRole('button', { name: /Load Xbox Games/i });

    expect(loadButton).toBeDisabled(); // Initially disabled
    fireEvent.change(xuidInput, { target: { value: '  ' } }); // Input with only spaces
    expect(loadButton).toBeDisabled(); // Still disabled
  });

  it('shows loading state on button when isLoadingXbox is true', () => {
    renderWithXboxContext({ isLoading: true });
    // The button text changes to "Loading Xbox Games..."
    const loadingButton = screen.getByRole('button', { name: /Loading Xbox Games.../i });
    expect(loadingButton).toBeInTheDocument();
    expect(loadingButton).toBeDisabled();
  });

  it('displays error message when errorXbox is set from context', () => {
    const errorMessage = "Custom Xbox connection error from test";
    renderWithXboxContext({ error: errorMessage });
    // The error message should be rendered within the Xbox card
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('displays connected status and game count when Xbox games are loaded', () => {
    const mockGames = [
      { _id: '1', xuid: 'test-xuid', titleId: '123', name: 'Game 1', displayImage: 'img1.jpg', achievements: { currentAchievements: 10, totalAchievements: 20, currentGamerscore: 100, totalGamerscore: 200 }, lastUpdated: new Date().toISOString() },
    ];
    renderWithXboxContext({ xboxGames: mockGames, error: null });

    // Check for "Connected" badge or status text
    expect(screen.getByText('Xbox (xbl.io)')).toBeInTheDocument(); // Title still there
    // The description text changes to show connected status
    expect(screen.getByText(/Xbox Connected \(1 games loaded\)/i)).toBeInTheDocument();

    // The button might change to "Update/Reload Xbox Games"
    expect(screen.getByRole('button', { name: /Update\/Reload Xbox Games/i })).toBeInTheDocument();
  });
});
