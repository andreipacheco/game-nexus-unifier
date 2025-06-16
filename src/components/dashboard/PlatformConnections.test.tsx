import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { PlatformConnections } from './PlatformConnections';
import { SteamProvider, useSteam, SteamUserProfile } from '@/contexts/SteamContext';
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

// Helper to render with MemoryRouter for location/navigation, and mocked context
const renderWithMockedContext = (ui: React.ReactElement, contextValue: Partial<ReturnType<typeof useSteam>>, initialEntries: string[] = ['/']) => {
  (useSteam as jest.Mock).mockImplementation(() => ({
    steamId: null,
    steamUser: null,
    isAuthenticated: false,
    isLoadingSteamProfile: false,
    steamProfileError: null,
    clearSteamConnection: mockClearSteamConnection,
    checkUserSession: mockCheckUserSession,
    fetchSteamProfile: mockFetchSteamProfile,
    ...contextValue,
  }));
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
};

// Helper to render with the actual SteamProvider for testing callback effects on the provider
const renderWithActualProvider = (ui: React.ReactElement, initialEntries: string[] = ['/']) => {
    // Reset useSteam to its actual implementation for this render
    (useSteam as jest.Mock).mockImplementation(jest.requireActual('@/contexts/SteamContext').useSteam);
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <SteamProvider>
          {ui}
        </SteamProvider>
      </MemoryRouter>
    );
  };


describe('PlatformConnections Component (Passport Flow)', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    mockClearSteamConnection.mockClear();
    mockCheckUserSession.mockClear();
    mockFetchSteamProfile.mockClear();

    // Mock window.location.href assignment
    delete window.location;
    window.location = { ...window.location, href: '', assign: jest.fn(), replace: jest.fn() };
    // Mock window.history.replaceState
    window.history.replaceState = jest.fn();
  });

  it('should redirect to /auth/steam when "Connect Steam" is clicked (when not authenticated)', async () => {
    renderWithMockedContext(<PlatformConnections />, { isAuthenticated: false });

    const steamCard = await screen.findByText((content, element) => element?.tagName.toLowerCase() === 'span' && content.startsWith('Steam'));
    const parentCard = steamCard.closest('div.relative');
    if (!parentCard) throw new Error("Steam platform card not found");

    const connectButton = within(parentCard).getByRole('button', { name: /Connect Steam/i });
    fireEvent.click(connectButton);
    expect(window.location.href).toBe('http://localhost:3000/auth/steam');
  });

  it('should call checkUserSession if steam_login_success is in URL and not already authenticated or loading', async () => {
    // Render with the actual provider to test the useEffect logic that calls checkUserSession from context
    // The checkUserSession in the *provider* will be spied on or its effects (like fetch) checked.
    // Here, we mock useSteam to provide a spy for checkUserSession for this specific component instance.
    renderWithMockedContext(<PlatformConnections />,
        { isAuthenticated: false, isLoadingSteamProfile: false },
        ['/dashboard?steam_login_success=true&steamid=teststeamid123']
    );

    await waitFor(() => {
        expect(mockCheckUserSession).toHaveBeenCalled();
    });
    expect(window.history.replaceState).toHaveBeenCalledWith({}, document.title, '/dashboard');
  });

  it('should display error from URL parameter on callback', async () => {
    // Use actual provider to let its useEffect handle the error param from URL
    // The component's localSteamError state should be set.
    renderWithActualProvider(<PlatformConnections />, ['/dashboard?error=OpenID%20validation%20failed']);

    expect(await screen.findByText(/Steam connection attempt failed: OpenID validation failed/i)).toBeInTheDocument();
    expect(window.history.replaceState).toHaveBeenCalledWith({}, document.title, '/dashboard');
  });

  it('should display connected Steam user info if authenticated and user data is present in context', async () => {
    const mockProfile: SteamUserProfile = { personaName: 'Authenticated User', avatarFull: 'auth.jpg', profileUrl: 'auth.url' };
    renderWithMockedContext(<PlatformConnections />, { isAuthenticated: true, steamId: 'auth-id', steamUser: mockProfile });

    const steamCard = await screen.findByText((content, element) => element?.tagName.toLowerCase() === 'span' && content.startsWith('Steam'));
    const parentCard = steamCard.closest('div.relative');
    if (!parentCard) throw new Error("Steam platform card not found");

    expect(within(parentCard).getByText('Connected')).toBeInTheDocument();
    expect(within(parentCard).getByText(`Connected as ${mockProfile.personaName}.`)).toBeInTheDocument();
    expect(within(parentCard).getByRole('img', {name: mockProfile.personaName})).toBeInTheDocument();
    expect(within(parentCard).getByRole('button', { name: /Disconnect Steam/i })).toBeInTheDocument();
  });

  it('"Disconnect Steam" button should call backend /auth/logout and then clearSteamConnection', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true }), { status: 200 }); // Mock successful logout
    const mockProfile: SteamUserProfile = { personaName: 'User To Logout', avatarFull: 'logout.jpg', profileUrl: 'logout.url' };
    renderWithMockedContext(<PlatformConnections />, { isAuthenticated: true, steamId: 'logout-id', steamUser: mockProfile });

    const steamCard = await screen.findByText((content, element) => element?.tagName.toLowerCase() === 'span' && content.startsWith('Steam'));
    const parentCard = steamCard.closest('div.relative');
    if (!parentCard) throw new Error("Steam platform card not found");

    const disconnectButton = within(parentCard).getByRole('button', { name: /Disconnect Steam/i });
    fireEvent.click(disconnectButton);

    await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/auth/logout');
    });
    expect(mockClearSteamConnection).toHaveBeenCalled();
  });

  it('should handle backend logout failure gracefully on "Disconnect Steam"', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: 'Logout failed' }), { status: 500 });
    const mockProfile: SteamUserProfile = { personaName: 'User Logout Fail', avatarFull: 'logoutfail.jpg', profileUrl: 'logoutfail.url' };
    renderWithMockedContext(<PlatformConnections />, { isAuthenticated: true, steamId: 'logoutfail-id', steamUser: mockProfile });

    const steamCard = await screen.findByText((content, element) => element?.tagName.toLowerCase() === 'span' && content.startsWith('Steam'));
    const parentCard = steamCard.closest('div.relative');
    if (!parentCard) throw new Error("Steam platform card not found");

    const disconnectButton = within(parentCard).getByRole('button', { name: /Disconnect Steam/i });
    fireEvent.click(disconnectButton);

    await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/auth/logout');
    });
    // Check if error message is displayed (localSteamError)
    expect(await screen.findByText(/Logout failed on the server/i)).toBeInTheDocument();
    // Context should still be cleared as a fallback
    expect(mockClearSteamConnection).toHaveBeenCalled();
  });

});
