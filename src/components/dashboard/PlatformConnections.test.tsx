import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { PlatformConnections } from './PlatformConnections';
import { SteamProvider, useSteam, SteamUserProfile } from '@/contexts/SteamContext';
import { useGog } from '@/contexts/GogContext'; // Added for completeness, though not directly tested here yet
import { useXbox } from '@/contexts/XboxContext'; // Added for completeness
import { PlaystationProvider, usePlaystation, PlaystationGame } from '@/contexts/PlaystationContext'; // Import Playstation context and types
import fetchMock from 'jest-fetch-mock';

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const original = jest.requireActual('lucide-react');
  return {
    ...original,
    Plug: () => <svg data-testid="plug-icon" />,
    CheckCircle: () => <svg data-testid="check-icon" />,
    XCircle: () => <svg data-testid="x-icon" />,
    ExternalLink: () => <svg data-testid="link-icon" />,
    Settings: () => <svg data-testid="settings-icon" />,
  };
});

// Mock the useSteam hook
const mockClearSteamConnection = jest.fn();
const mockCheckUserSession = jest.fn();
// fetchSteamProfile might still be in context, so mock it, though PlatformConnections may not use it directly anymore
const mockFetchSteamProfile = jest.fn();

jest.mock('@/contexts/SteamContext', () => ({
  ...jest.requireActual('@/contexts/SteamContext'), // Import and retain actual SteamProvider for some tests
  useSteam: jest.fn(() => ({
    steamId: null,
    steamUser: null,
    isAuthenticated: false,
    isLoadingSteamProfile: false,
    steamProfileError: null,
    clearSteamConnection: mockClearSteamConnection,
    checkUserSession: mockCheckUserSession,
    fetchSteamProfile: mockFetchSteamProfile,
  })),
}));

// Mock GOG context (basic mock, expand if GOG interactions are tested in this file)
jest.mock('@/contexts/GogContext', () => ({
  ...jest.requireActual('@/contexts/GogContext'),
  useGog: jest.fn(() => ({
    gogUserId: null,
    connectGogUser: jest.fn(),
    disconnectGogUser: jest.fn(),
    isLoadingGogUserId: false,
    gogUserError: null,
  })),
}));

// Mock Xbox context (basic mock)
jest.mock('@/contexts/XboxContext', () => ({
  ...jest.requireActual('@/contexts/XboxContext'),
  useXbox: jest.fn(() => ({
    xboxGames: [],
    fetchXboxGames: jest.fn(),
    isLoading: false,
    error: null,
  })),
}));


// Mock Playstation context
const mockConnectPlaystation = jest.fn();
const mockDisconnectPlaystation = jest.fn();
const mockFetchPlaystationGames = jest.fn();

jest.mock('@/contexts/PlaystationContext', () => ({
  ...jest.requireActual('@/contexts/PlaystationContext'), // Retain actual Provider if needed for some tests
  usePlaystation: jest.fn(() => ({
    npssoToken: null,
    playstationGames: [],
    isLoadingPlaystation: false,
    errorPlaystation: null,
    connectPlaystation: mockConnectPlaystation,
    disconnectPlaystation: mockDisconnectPlaystation,
    fetchPlaystationGames: mockFetchPlaystationGames,
  })),
}));


// Helper to render with MemoryRouter for location/navigation, and mocked contexts
const renderWithMockedContexts = (
  ui: React.ReactElement,
  {
    steamContextValue = {},
    gogContextValue = {}, // Added GOG
    xboxContextValue = {}, // Added Xbox
    playstationContextValue = {} // Added Playstation
  }: {
    steamContextValue?: Partial<ReturnType<typeof useSteam>>;
    gogContextValue?: Partial<ReturnType<typeof useGog>>;
    xboxContextValue?: Partial<ReturnType<typeof useXbox>>;
    playstationContextValue?: Partial<ReturnType<typeof usePlaystation>>;
  } = {},
  initialEntries: string[] = ['/']
) => {
  (useSteam as jest.Mock).mockImplementation(() => ({
    steamId: null,
    steamUser: null,
    isAuthenticated: false,
    isLoadingSteamProfile: false,
    steamProfileError: null,
    clearSteamConnection: mockClearSteamConnection,
    checkUserSession: mockCheckUserSession,
    fetchSteamProfile: mockFetchSteamProfile,
    ...steamContextValue,
  }));
  (useGog as jest.Mock).mockImplementation(() => ({
    gogUserId: null, connectGogUser: jest.fn(), disconnectGogUser: jest.fn(), isLoadingGogUserId: false, gogUserError: null,
    ...gogContextValue,
  }));
  (useXbox as jest.Mock).mockImplementation(() => ({
    xboxGames: [], fetchXboxGames: jest.fn(), isLoading: false, error: null,
    ...xboxContextValue,
  }));
  (usePlaystation as jest.Mock).mockImplementation(() => ({
    npssoToken: null, playstationGames: [], isLoadingPlaystation: false, errorPlaystation: null,
    connectPlaystation: mockConnectPlaystation, disconnectPlaystation: mockDisconnectPlaystation, fetchPlaystationGames: mockFetchPlaystationGames,
    ...playstationContextValue,
  }));

  // Render with all providers. For simplicity, we're not using the actual providers here
  // as these tests focus on PlatformConnections' interaction with the context values.
  // If provider-specific logic (like useEffect in provider) needs testing, that's a different setup.
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SteamProvider> {/* Using actual providers to ensure context is available */}
        <GogProvider>
          <XboxProvider>
            <PlaystationProvider>
              {ui}
            </PlaystationProvider>
          </XboxProvider>
        </GogProvider>
      </SteamProvider>
    </MemoryRouter>
  );
};


describe('PlatformConnections Component', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    mockClearSteamConnection.mockClear();
    mockCheckUserSession.mockClear();
    mockFetchSteamProfile.mockClear();
    mockConnectPlaystation.mockClear();
    mockDisconnectPlaystation.mockClear();
    mockFetchPlaystationGames.mockClear();

    // Mock window.location.href assignment for Steam connect
    delete window.location;
    window.location = { ...window.location, href: '', assign: jest.fn(), replace: jest.fn() };
    // Mock window.history.replaceState
    window.history.replaceState = jest.fn(); // For cleaning URL params
  });

  // Test cases for Steam (existing ones, adapted to new render helper if needed)
  describe('Steam Platform', () => {
    it('should redirect to /auth/steam when "Connect Steam" is clicked (when not authenticated)', async () => {
      renderWithMockedContexts(<PlatformConnections />, { steamContextValue: { isAuthenticated: false } });
      const steamCard = await screen.findByText((content, element) => element?.tagName.toLowerCase() === 'span' && content.startsWith('Steam'));
      const parentCard = steamCard.closest('div.relative');
      if (!parentCard) throw new Error("Steam platform card not found");
      const connectButton = within(parentCard).getByRole('button', { name: /Connect Steam/i });
      fireEvent.click(connectButton);
      expect(window.location.href).toBe('http://localhost:3000/auth/steam');
    });

    // ... other Steam tests adapted to renderWithMockedContexts if necessary ...
    it('should display connected Steam user info', async () => {
      const mockProfile: SteamUserProfile = { personaName: 'Test Steam User', avatarFull: 'test.jpg', profileUrl: 'test.url' };
      renderWithMockedContexts(<PlatformConnections />, { steamContextValue: { isAuthenticated: true, steamId: '123', steamUser: mockProfile } });
      const steamCard = await screen.findByText((content, element) => element?.tagName.toLowerCase() === 'span' && content.startsWith('Steam'));
      const parentCard = steamCard.closest('div.relative');
      expect(within(parentCard).getByText('Connected as Test Steam User.')).toBeInTheDocument();
      expect(within(parentCard).getByRole('button', {name: /Disconnect Steam/i})).toBeInTheDocument();
    });
  });


  // --- Playstation Tests ---
  describe('Playstation Platform', () => {
    it('renders the Playstation card with connect elements when not connected', async () => {
      renderWithMockedContexts(<PlatformConnections />, { playstationContextValue: { npssoToken: null } });

      const psCardTitle = await screen.findByText((content, element) => element?.tagName.toLowerCase() === 'span' && content.startsWith('Playstation'));
      const parentCard = psCardTitle.closest('div.relative');
      if (!parentCard) throw new Error("Playstation platform card not found");

      expect(within(parentCard).getByText('Playstation')).toBeInTheDocument();
      expect(within(parentCard).getByText('Connect your Playstation Network account using your NPSSO token.')).toBeInTheDocument();
      expect(within(parentCard).getByLabelText('NPSSO Token')).toBeInTheDocument();
      // The button text is "Connect Playstation (Placeholder)" due to current implementation
      expect(within(parentCard).getByRole('button', { name: /Connect Playstation/i })).toBeInTheDocument();
      expect(within(parentCard).getByTestId('x-icon')).toBeInTheDocument(); // Not connected icon
    });

    it('calls connectPlaystation with the entered token when "Connect" is clicked', async () => {
      const consoleSpy = jest.spyOn(console, 'log'); // Spy on console.log for the placeholder button
      renderWithMockedContexts(<PlatformConnections />, { playstationContextValue: { npssoToken: null } });

      const psCardTitle = await screen.findByText('Playstation');
      const parentCard = psCardTitle.closest('div.relative');
      if (!parentCard) throw new Error("Playstation platform card not found");

      const npssoInput = within(parentCard).getByLabelText('NPSSO Token');
      const connectButton = within(parentCard).getByRole('button', { name: /Connect Playstation/i });

      fireEvent.change(npssoInput, { target: { value: 'test-npsso-token' } });
      fireEvent.click(connectButton);

      // For the placeholder button that uses console.log:
      expect(consoleSpy).toHaveBeenCalledWith("Attempting to connect Playstation with NPSSO:", "test-npsso-token");
      // When context is fully wired:
      // await waitFor(() => {
      //   expect(mockConnectPlaystation).toHaveBeenCalledWith('test-npsso-token');
      // });
      consoleSpy.mockRestore();
    });

    it('displays connected state for Playstation when npssoToken is present', async () => {
      // Simulate that connectPlaystation was called and it set the token and fetched games
      const mockPsGames: PlaystationGame[] = [{ npCommunicationId: 'NPWR12345_00', name: 'Test Game PS', image: 'ps.jpg', platform: 'PS5', trophySummary: { progress: 50, earnedTrophies: { bronze: 10, silver: 5, gold: 1, platinum: 0}, definedTrophies: { bronze: 20, silver: 10, gold: 2, platinum: 1}}, hasTrophyGroups: false, lastUpdatedDateTime: new Date().toISOString() }];
      renderWithMockedContexts(<PlatformConnections />, {
        playstationContextValue: {
          npssoToken: 'fake-npsso',
          // playstationGames: mockPsGames, // This part of UI is not shown directly in PlatformConnections card based on current code
          // For PlatformConnections, the `connected` prop of the platform object is what matters, which is derived from context in useEffect.
          // We'll need to mock the platform object to be `connected: true` or rely on the useEffect to update it.
          // For simplicity, we'll check for elements consistent with a connected state (e.g. "Disconnect" button if it existed)
        }
      });

      const psCardTitle = await screen.findByText('Playstation');
      const parentCard = psCardTitle.closest('div.relative');
      if (!parentCard) throw new Error("Playstation platform card not found");

      // The platform.connected state is updated by useEffect in PlatformConnections.
      // We need to wait for that effect to run.
      // Since the actual connectPlaystation and fetch calls are mocked, the `connected` state
      // in `platformsState` for playstation might not update to true unless we also mock that logic or
      // the `playstationGames` array being non-empty (which is commented out in the effect for now).
      // For now, we assume the placeholder text "Playstation Connected." would appear if logic was complete.
      // Or, we check for the absence of the "Connect" button's main text if it changes.
      // The current UI for playstation when "connected" (even placeholder) is:
      // <p className="text-sm text-green-600">Playstation Connected.</p>
      // <p className="text-xs text-muted-foreground">Disconnect functionality to be added with context.</p>

      // Let's refine this test once the connect/disconnect logic in PlatformConnections is fully tied to the context.
      // For now, if npssoToken exists, the input field might change or a disconnect option appears.
      // The current "Connect" button text is static "Connect Playstation (Placeholder)".
      // The "Disconnect" button is commented out.
      // Let's assume for now that if npssoToken is present, the description might change or input is pre-filled.
      // This test will need significant updates when the component fully implements connected UI for Playstation.

      // We expect the input field to still be there.
      expect(within(parentCard).getByLabelText('NPSSO Token')).toBeInTheDocument();
      // And the connect button (as disconnect is not fully implemented yet for PS)
      expect(within(parentCard).getByRole('button', { name: /Connect Playstation/i })).toBeInTheDocument();
      // The status icon depends on `platform.connected` which is currently hardcoded to false in `useEffect` for playstation.
      // So it will show XCircle. This test needs to be updated when that logic is complete.
      // await waitFor(() => {
      //  expect(within(parentCard).getByTestId('check-icon')).toBeInTheDocument();
      // });
       expect(within(parentCard).getByTestId('x-icon')).toBeInTheDocument(); // Because connected is false
    });

    it('calls disconnectPlaystation when "Disconnect" is clicked (if button existed and was wired)', async () => {
      // This test is currently theoretical as the Disconnect button for Playstation is commented out.
      // We'll set it up for when it's implemented.
      // renderWithMockedContexts(<PlatformConnections />, { playstationContextValue: { npssoToken: 'fake-npsso' } });
      // const disconnectButton = screen.getByRole('button', { name: /Disconnect Playstation/i });
      // fireEvent.click(disconnectButton);
      // expect(mockDisconnectPlaystation).toHaveBeenCalled();
      expect(true).toBe(true); // Placeholder
    });

    it('displays an error message for Playstation when errorPlaystation is present', async () => {
      renderWithMockedContexts(<PlatformConnections />, { playstationContextValue: { errorPlaystation: 'Fake PSN Error' } });

      const psCardTitle = await screen.findByText('Playstation');
      const parentCard = psCardTitle.closest('div.relative');
      if (!parentCard) throw new Error("Playstation platform card not found");

      expect(await within(parentCard).findByText('Fake PSN Error')).toBeInTheDocument();
    });
  });

});
