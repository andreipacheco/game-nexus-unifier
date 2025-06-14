import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom'; // MemoryRouter for testing
import { PlatformConnections } from './PlatformConnections';
import { SteamProvider, useSteam, SteamUserProfile } from '@/contexts/SteamContext'; // Adjust path
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

// Mock the useSteam hook for some tests to control context values directly
const mockSetSteamConnection = jest.fn();
const mockFetchSteamProfile = jest.fn();
const mockClearSteamConnection = jest.fn();

jest.mock('@/contexts/SteamContext', () => ({
  ...jest.requireActual('@/contexts/SteamContext'), // Import and retain actual SteamProvider for some tests
  useSteam: jest.fn(() => ({ // Default mock implementation
    steamId: null,
    steamUser: null,
    isLoadingSteamProfile: false,
    steamProfileError: null,
    setSteamConnection: mockSetSteamConnection,
    fetchSteamProfile: mockFetchSteamProfile,
    clearSteamConnection: mockClearSteamConnection,
  })),
}));


// Helper to render with providers, including MemoryRouter for location/navigation
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SteamProvider> {/* Use actual provider for callback test, or mock useSteam for others */}
        {ui}
      </SteamProvider>
    </MemoryRouter>
  );
};
const renderWithMockedSteamContext = (ui: React.ReactElement, contextValue: Partial<ReturnType<typeof useSteam>>) => {
    (useSteam as jest.Mock).mockImplementation(() => ({
        steamId: null,
        steamUser: null,
        isLoadingSteamProfile: false,
        steamProfileError: null,
        setSteamConnection: mockSetSteamConnection,
        fetchSteamProfile: mockFetchSteamProfile,
        clearSteamConnection: mockClearSteamConnection,
        ...contextValue, // Override with specific values for the test
    }));
    return render(<MemoryRouter>{ui}</MemoryRouter>); // No need for SteamProvider if useSteam is fully mocked
}


describe('PlatformConnections Component (OpenID Flow)', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    mockSetSteamConnection.mockClear();
    mockFetchSteamProfile.mockClear();
    mockClearSteamConnection.mockClear();
    // Reset window.location.href spy if used
    delete window.location;
    window.location = { ...window.location, href: '', assign: jest.fn(), replace: jest.fn() };
    window.history.replaceState = jest.fn(); // Mock history.replaceState
  });

  it('should redirect to /auth/steam when "Connect Steam" is clicked', async () => {
    renderWithMockedSteamContext(<PlatformConnections />, { steamId: null, steamUser: null });

    const steamCard = (await screen.findAllByText('Steam'))
        .map(el => el.closest('div.relative'))
        .find(card => card !== null && card !== undefined);
    if (!steamCard) throw new Error("Steam platform card not found");

    const connectButton = within(steamCard).getByRole('button', { name: /Connect Steam/i });
    fireEvent.click(connectButton);

    expect(window.location.href).toBe('http://localhost:3000/auth/steam');
  });

  it('should process successful Steam OpenID callback parameters', async () => {
    const testSteamId = '76561197960287930';
    const mockProfile: SteamUserProfile = {
        personaName: 'Test User',
        avatarFull: 'avatar.jpg',
        profileUrl: 'profile.url'
    };
    // This mock is for the fetchSteamProfile call inside the context, triggered by PlatformConnections
    fetchMock.mockResponseOnce(JSON.stringify({ steamid: testSteamId, ...mockProfile }));

    // Render with actual SteamProvider to test its interaction via the component
    renderWithProviders(<PlatformConnections />, [`/dashboard?steam_login_success=true&steamid=${testSteamId}`]);

    await waitFor(() => {
      // setSteamConnection is called by PlatformConnections's useEffect, then fetchSteamProfile
      // These are now part of the actual context a_nd not directly mockable here if using real provider
      // Instead, we check the outcome: profile display or error state on context
      // For now, let's verify the fetch that fetchSteamProfile (from context) would make
       expect(fetchMock).toHaveBeenCalledWith(`/api/steam/user/${testSteamId}`);
    });

    // After profile fetch, UI should update based on context state.
    // We need to mock useSteam to return the *updated* context state to check UI.
    (useSteam as jest.Mock).mockReturnValue({
        steamId: testSteamId,
        steamUser: mockProfile,
        isLoadingSteamProfile: false,
        steamProfileError: null,
        setSteamConnection: mockSetSteamConnection, // Keep mocks for other functions
        fetchSteamProfile: mockFetchSteamProfile,
        clearSteamConnection: mockClearSteamConnection,
    });

    // Re-render or find elements based on updated context (tricky without re-rendering the specific component)
    // This part is better tested by seeing if the UI *eventually* updates.
    // The component itself will re-render due to context changes from SteamProvider.

    // Check for connected state on the card
    const steamCard = (await screen.findAllByText('Steam'))
        .map(el => el.closest('div.relative'))
        .find(card => card !== null && card !== undefined);
    if (!steamCard) throw new Error("Steam platform card not found");

    await waitFor(() => {
        expect(within(steamCard).getByText('Connected')).toBeInTheDocument();
        expect(within(steamCard).getByText(`Connected as ${mockProfile.personaName}.`)).toBeInTheDocument();
        expect(within(steamCard).getByRole('img', {name: mockProfile.personaName})).toBeInTheDocument();
    });
    expect(window.history.replaceState).toHaveBeenCalledWith({}, document.title, '/dashboard');
  });

  it('should display error from URL parameter on callback', async () => {
    renderWithProviders(<PlatformConnections />, ['/dashboard?error=OpenID%20validation%20failed']);

    expect(await screen.findByText(/Steam connection failed: OpenID validation failed/i)).toBeInTheDocument();
    expect(window.history.replaceState).toHaveBeenCalledWith({}, document.title, '/dashboard');
  });

  it('should display connected Steam user info if steamId and steamUser are in context', async () => {
    const mockProfile: SteamUserProfile = { personaName: 'Already Connected', avatarFull: 'connected.jpg', profileUrl: 'connected.url' };
    renderWithMockedSteamContext(<PlatformConnections />, { steamId: 'existing-id', steamUser: mockProfile });

    const steamCard = (await screen.findAllByText('Steam'))
        .map(el => el.closest('div.relative'))
        .find(card => card !== null && card !== undefined);
    if (!steamCard) throw new Error("Steam platform card not found");

    expect(within(steamCard).getByText('Connected')).toBeInTheDocument();
    expect(within(steamCard).getByText(`Connected as ${mockProfile.personaName}.`)).toBeInTheDocument();
    expect(within(steamCard).getByRole('img', {name: mockProfile.personaName})).toBeInTheDocument();
    expect(within(steamCard).getByRole('button', { name: /Disconnect Steam/i })).toBeInTheDocument();
  });

  it('"Disconnect Steam" button should call clearSteamConnection from context', async () => {
    const mockProfile: SteamUserProfile = { personaName: 'To Disconnect', avatarFull: 'disconnect.jpg', profileUrl: 'disconnect.url' };
    renderWithMockedSteamContext(<PlatformConnections />, { steamId: 'disconnect-id', steamUser: mockProfile });

    const steamCard = (await screen.findAllByText('Steam'))
        .map(el => el.closest('div.relative'))
        .find(card => card !== null && card !== undefined);
    if (!steamCard) throw new Error("Steam platform card not found");

    const disconnectButton = within(steamCard).getByRole('button', { name: /Disconnect Steam/i });
    fireEvent.click(disconnectButton);
    expect(mockClearSteamConnection).toHaveBeenCalled();
  });

});
});
