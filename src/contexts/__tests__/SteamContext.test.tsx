import React, { useEffect } from 'react'; // useEffect added for specific test cases
import { render, act, waitFor } from '@testing-library/react';
import { SteamProvider, useSteam, SteamUserProfile } from '../SteamContext'; // Adjust path
import fetchMock from 'jest-fetch-mock';

// Helper component to consume context for testing
const TestConsumer: React.FC<{
    action?: (context: ReturnType<typeof useSteam>) => void,
    steamIdToFetchViaProfileFunc?: string, // For testing fetchSteamProfile
    callCheckUserSession?: boolean // For explicitly calling checkUserSession
}> = ({ action, steamIdToFetchViaProfileFunc, callCheckUserSession }) => {
  const context = useSteam();

  useEffect(() => {
    if (action) {
      action(context);
    }
  }, [action, context]);

  useEffect(() => {
    if (steamIdToFetchViaProfileFunc && context.fetchSteamProfile) {
        context.fetchSteamProfile(steamIdToFetchViaProfileFunc);
    }
  }, [steamIdToFetchViaProfileFunc, context.fetchSteamProfile]);

  useEffect(() => {
    if (callCheckUserSession) {
        context.checkUserSession();
    }
  }, [callCheckUserSession, context.checkUserSession]);

  return (
    <div>
      <div data-testid="steam-id">{context.steamId || 'null'}</div>
      <div data-testid="steam-user-name">{context.steamUser?.personaName || 'null'}</div>
      <div data-testid="steam-user-avatar">{context.steamUser?.avatarFull || 'null'}</div>
      <div data-testid="steam-user-profileUrl">{context.steamUser?.profileUrl || 'null'}</div>
      <div data-testid="is-authenticated">{context.isAuthenticated.toString()}</div>
      <div data-testid="is-loading">{context.isLoadingSteamProfile.toString()}</div>
      <div data-testid="error">{context.steamProfileError || 'null'}</div>
      <button onClick={context.clearSteamConnection} data-testid="clear-button">Clear</button>
      {/* Button to manually trigger checkUserSession for specific tests if needed */}
      <button onClick={context.checkUserSession} data-testid="check-session-button">Check Session</button>
    </div>
  );
};

describe('SteamContext', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    localStorage.clear();
  });

  it('should have correct initial state (isLoading true due to auto checkUserSession)', async () => {
    // checkUserSession is called on mount, so isLoadingSteamProfile will be true initially
    // and then false after the fetch mock (likely 401 by default if not mocked for this test)
    fetchMock.mockResponseOnce(JSON.stringify({}), { status: 401 }); // Default for initial load

    render(
      <SteamProvider>
        <TestConsumer />
      </SteamProvider>
    );
    // Initial state before checkUserSession's fetch mock resolves
    expect(document.getElementById('steam-id')?.textContent).toBe('null');
    expect(document.getElementById('steam-user-name')?.textContent).toBe('null');
    expect(document.getElementById('is-authenticated')?.textContent).toBe('false');
    expect(document.getElementById('is-loading')?.textContent).toBe('true'); // True because checkUserSession runs on mount
    expect(document.getElementById('error')?.textContent).toBe('null');

    // Wait for the initial checkUserSession to complete
    await waitFor(() => {
        expect(document.getElementById('is-loading')?.textContent).toBe('false');
    });
  });

  describe('checkUserSession (called on initial load)', () => {
    it('should fetch from /api/me, update context and localStorage on successful session', async () => {
      const mockApiMeResponse: SteamUserProfile & { steamId: string } = {
        steamId: 'authenticated-steam-id',
        personaName: 'Authenticated User',
        avatarFull: 'auth_avatar.jpg',
        profileUrl: 'auth_profile.url',
      };
      fetchMock.mockResponseOnce(JSON.stringify(mockApiMeResponse)); // For /api/me

      render(
        <SteamProvider>
          <TestConsumer />
        </SteamProvider>
      );

      // isLoading is true initially due to checkUserSession on mount
      expect(document.getElementById('is-loading')?.textContent).toBe('true');

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/me');
      });

      await waitFor(() => {
        expect(document.getElementById('steam-id')?.textContent).toBe('authenticated-steam-id');
        expect(document.getElementById('steam-user-name')?.textContent).toBe('Authenticated User');
        expect(document.getElementById('steam-user-avatar')?.textContent).toBe('auth_avatar.jpg');
        expect(document.getElementById('is-authenticated')?.textContent).toBe('true');
        expect(document.getElementById('is-loading')?.textContent).toBe('false');
      });

      expect(localStorage.getItem('steamId')).toBe(mockApiMeResponse.steamId);
      // Stored data in localStorage from checkUserSession is the full API response
      const storedUser = JSON.parse(localStorage.getItem('steamUser') || '{}');
      expect(storedUser.personaName).toBe(mockApiMeResponse.personaName);
      expect(storedUser.avatarFull).toBe(mockApiMeResponse.avatarFull);
    });

    it('should clear context and localStorage if /api/me returns 401', async () => {
      localStorage.setItem('steamId', 'stale-steam-id'); // Simulate stale data
      localStorage.setItem('steamUser', JSON.stringify({ personaName: 'Stale User' }));

      fetchMock.mockResponseOnce(JSON.stringify({ error: 'User not authenticated' }), { status: 401 });

      render(
        <SteamProvider>
          <TestConsumer />
        </SteamProvider>
      );

      expect(document.getElementById('is-loading')?.textContent).toBe('true');

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/me');
      });

      await waitFor(() => {
        expect(document.getElementById('steam-id')?.textContent).toBe('null');
        expect(document.getElementById('steam-user-name')?.textContent).toBe('null');
        expect(document.getElementById('is-authenticated')?.textContent).toBe('false');
        expect(document.getElementById('is-loading')?.textContent).toBe('false');
      });
      expect(localStorage.getItem('steamId')).toBeNull();
      expect(localStorage.getItem('steamUser')).toBeNull();
    });

    it('should clear context and set error on other /api/me fetch errors', async () => {
        fetchMock.mockResponseOnce(JSON.stringify({ error: 'Server error' }), { status: 500 });

        render(
          <SteamProvider>
            <TestConsumer />
          </SteamProvider>
        );
        await waitFor(() => {
            expect(document.getElementById('steam-id')?.textContent).toBe('null');
            expect(document.getElementById('is-authenticated')?.textContent).toBe('false');
            expect(document.getElementById('error')?.textContent).toMatch(/Server error: 500|Failed to check user session/);
            expect(document.getElementById('is-loading')?.textContent).toBe('false');
        });
        expect(localStorage.getItem('steamId')).toBeNull();
      });
  });

  // Test for fetchSteamProfile (used by PlatformConnections after OpenID callback)
  it('fetchSteamProfile should update steamUser and localStorage', async () => {
    const steamIdForProfileFetch = 'profile-fetch-id';
    const mockSteamApiProfileResponse = { // Structure from /api/steam/user/:steamid
      steamid: steamIdForProfileFetch,
      personaname: 'ProfileFetched User',
      avatarfull: 'profile_fetched_avatar.jpg',
      profileurl: 'profile_fetched.url',
    };
    fetchMock.mockResponseOnce(JSON.stringify(mockSteamApiProfileResponse));

    // Set an initial steamId as if setSteamConnection was called after OpenID redirect
    // (or rely on checkUserSession to set it if that's the flow)
    // For this specific test of fetchSteamProfile, we can assume steamId is already set.
    localStorage.setItem('steamId', steamIdForProfileFetch); // Simulate steamId is known

    render(
      <SteamProvider>
        {/* TestConsumer will call fetchSteamProfile if steamIdToFetchViaProfileFunc is provided */}
        <TestConsumer steamIdToFetchViaProfileFunc={steamIdForProfileFetch} />
      </SteamProvider>
    );

    // isLoading will be true due to fetchSteamProfile call
    await waitFor(() => expect(document.getElementById('is-loading')?.textContent).toBe('true'));

    await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(`/api/steam/user/${steamIdForProfileFetch}`);
    });

    await waitFor(() => {
      // steamId should remain what was set
      expect(document.getElementById('steam-id')?.textContent).toBe(steamIdForProfileFetch);
      // steamUser should be updated by fetchSteamProfile
      expect(document.getElementById('steam-user-name')?.textContent).toBe('ProfileFetched User');
      expect(document.getElementById('steam-user-avatar')?.textContent).toBe('profile_fetched_avatar.jpg');
      expect(document.getElementById('is-loading')?.textContent).toBe('false');
    });

    const expectedStoredUser = {
        personaName: mockSteamApiProfileResponse.personaname,
        avatarFull: mockSteamApiProfileResponse.avatarfull,
        profileUrl: mockSteamApiProfileResponse.profileurl,
    };
    expect(JSON.parse(localStorage.getItem('steamUser') || '{}')).toEqual(expectedStoredUser);
  });


  it('clearSteamConnection should clear context, localStorage, and set isAuthenticated to false', async () => {
    // Setup initial authenticated state in localStorage
    localStorage.setItem('steamId', 'id-to-clear');
    const userToClear = { personaName: 'User To Clear', avatarFull: 'clear.jpg', profileUrl: 'clear.url' };
    localStorage.setItem('steamUser', JSON.stringify(userToClear));

    // Mock initial load from /api/me to set isAuthenticated to true
    fetchMock.mockResponseOnce(JSON.stringify({ steamId: 'id-to-clear', ...userToClear }));

    let capturedContext: any;
    render(
      <SteamProvider>
        <TestConsumer action={(ctx) => { capturedContext = ctx; }}/>
      </SteamProvider>
    );

    // Wait for initial load to complete and set user
    await waitFor(() => {
      expect(document.getElementById('is-authenticated')?.textContent).toBe('true');
    });

    // Now clear it
    await act(async () => {
      // capturedContext.clearSteamConnection(); // This would work if action was re-run
      // More directly:
      document.querySelector<HTMLButtonElement>('[data-testid="clear-button"]')?.click();
    });

    expect(document.getElementById('steam-id')?.textContent).toBe('null');
    expect(document.getElementById('steam-user-name')?.textContent).toBe('null');
    expect(document.getElementById('is-authenticated')?.textContent).toBe('false');
    expect(localStorage.getItem('steamId')).toBeNull();
    expect(localStorage.getItem('steamUser')).toBeNull();
  });
});
