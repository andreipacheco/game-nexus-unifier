import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { SteamProvider, useSteam, SteamUserProfile } from '../SteamContext'; // Adjust path
import fetchMock from 'jest-fetch-mock';

// Helper component to consume context for testing
const TestConsumer: React.FC<{ action?: (context: any) => void, steamIdToFetch?: string }> = ({ action, steamIdToFetch }) => {
  const context = useSteam();

  useEffect(() => {
    if (action) {
      action(context);
    }
    if (steamIdToFetch && context.fetchSteamProfile) {
        context.fetchSteamProfile(steamIdToFetch);
    }
  }, [action, context, steamIdToFetch]);

  return (
    <div>
      <div data-testid="steam-id">{context.steamId || 'null'}</div>
      <div data-testid="steam-user-name">{context.steamUser?.personaName || 'null'}</div>
      <div data-testid="steam-user-avatar">{context.steamUser?.avatarFull || 'null'}</div>
      <div data-testid="steam-user-profileUrl">{context.steamUser?.profileUrl || 'null'}</div>
      <div data-testid="is-loading">{context.isLoadingSteamProfile.toString()}</div>
      <div data-testid="error">{context.steamProfileError || 'null'}</div>
    </div>
  );
};

describe('SteamContext', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    localStorage.clear();
  });

  it('should have correct initial state', () => {
    render(
      <SteamProvider>
        <TestConsumer />
      </SteamProvider>
    );
    expect(document.getElementById('steam-id')?.textContent).toBe('null');
    expect(document.getElementById('steam-user-name')?.textContent).toBe('null');
    expect(document.getElementById('is-loading')?.textContent).toBe('false');
    expect(document.getElementById('error')?.textContent).toBe('null');
  });

  describe('Initialization from localStorage', () => {
    it('should load and verify steamId from localStorage, then fetch profile from DB', async () => {
      localStorage.setItem('steamId', 'test-steam-id-local');
      const mockDbProfile: SteamUserProfile & { steamId: string } = {
        steamId: 'test-steam-id-local',
        personaName: 'DB User',
        avatarFull: 'db_avatar.jpg',
        profileUrl: 'db_profile_url',
      };
      fetchMock.mockResponseOnce(JSON.stringify(mockDbProfile)); // For /api/user/steam_profile

      render(
        <SteamProvider>
          <TestConsumer />
        </SteamProvider>
      );

      expect(document.getElementById('is-loading')?.textContent).toBe('true'); // Initial loading state

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/user/steam_profile?steamid=test-steam-id-local');
      });

      await waitFor(() => {
        expect(document.getElementById('steam-id')?.textContent).toBe('test-steam-id-local');
        expect(document.getElementById('steam-user-name')?.textContent).toBe('DB User');
        expect(document.getElementById('steam-user-avatar')?.textContent).toBe('db_avatar.jpg');
        expect(document.getElementById('is-loading')?.textContent).toBe('false');
      });
      expect(localStorage.getItem('steamUser')).toEqual(JSON.stringify(mockDbProfile));
    });

    it('should clear localStorage and context if stored steamId not found in DB (404)', async () => {
      localStorage.setItem('steamId', 'stale-steam-id');
      localStorage.setItem('steamUser', JSON.stringify({ personaName: 'Stale User', avatarFull: 'stale.jpg', profileUrl: 'stale.url' }));

      fetchMock.mockResponseOnce(JSON.stringify({ error: 'User not found' }), { status: 404 });

      render(
        <SteamProvider>
          <TestConsumer />
        </SteamProvider>
      );

      expect(document.getElementById('is-loading')?.textContent).toBe('true');

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/user/steam_profile?steamid=stale-steam-id');
      });

      await waitFor(() => {
        expect(document.getElementById('steam-id')?.textContent).toBe('null');
        expect(document.getElementById('steam-user-name')?.textContent).toBe('null');
        expect(document.getElementById('is-loading')?.textContent).toBe('false');
      });
      expect(localStorage.getItem('steamId')).toBeNull();
      expect(localStorage.getItem('steamUser')).toBeNull();
    });

    it('should clear localStorage and context on other API errors during init', async () => {
        localStorage.setItem('steamId', 'error-steam-id');
        fetchMock.mockResponseOnce(JSON.stringify({ error: 'Server error' }), { status: 500 });

        render(
          <SteamProvider>
            <TestConsumer />
          </SteamProvider>
        );
        await waitFor(() => {
            expect(document.getElementById('steam-id')?.textContent).toBe('null');
            expect(document.getElementById('error')?.textContent).not.toBe('null'); // Check if error is set
        });
        expect(localStorage.getItem('steamId')).toBeNull();
      });
  });

  it('setSteamConnection should update context and localStorage', async () => {
    let capturedContext: any;
    render(
      <SteamProvider>
        <TestConsumer action={(ctx) => { capturedContext = ctx; }}/>
      </SteamProvider>
    );

    const newSteamId = 'new-id';
    const newUserProfile: SteamUserProfile = { personaName: 'New User', avatarFull: 'new.jpg', profileUrl: 'new.url' };

    await act(async () => {
      capturedContext.setSteamConnection(newSteamId, newUserProfile);
    });

    expect(document.getElementById('steam-id')?.textContent).toBe(newSteamId);
    expect(document.getElementById('steam-user-name')?.textContent).toBe(newUserProfile.personaName);
    expect(localStorage.getItem('steamId')).toBe(newSteamId);
    expect(localStorage.getItem('steamUser')).toEqual(JSON.stringify(newUserProfile));
  });

  it('fetchSteamProfile should update context and localStorage (simulates post-OpenID fetch)', async () => {
    const steamIdToFetch = 'fetch-this-id';
    const mockSteamApiProfile = { // Data structure from /api/steam/user/:steamid
      steamid: steamIdToFetch, // Note: steamid vs steamId
      personaname: 'Fetched User',
      avatarfull: 'fetched_avatar.jpg',
      profileurl: 'fetched_profile.url',
    };
    // This mock is for the call made by `fetchSteamProfile` inside the context
    fetchMock.mockResponseOnce(JSON.stringify(mockSteamApiProfile));

    render(
      <SteamProvider>
        <TestConsumer steamIdToFetch={steamIdToFetch} />
      </SteamProvider>
    );

    expect(document.getElementById('is-loading')?.textContent).toBe('true');

    await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(`/api/steam/user/${steamIdToFetch}`);
    });

    await waitFor(() => {
      expect(document.getElementById('steam-user-name')?.textContent).toBe('Fetched User');
      expect(document.getElementById('steam-user-avatar')?.textContent).toBe('fetched_avatar.jpg');
      expect(document.getElementById('is-loading')?.textContent).toBe('false');
    });

    const expectedStoredUser = { // What fetchSteamProfile stores
        personaName: mockSteamApiProfile.personaname,
        avatarFull: mockSteamApiProfile.avatarfull,
        profileUrl: mockSteamApiProfile.profileurl,
    };
    expect(localStorage.getItem('steamUser')).toEqual(JSON.stringify(expectedStoredUser));
  });

  it('clearSteamConnection should clear context and localStorage', async () => {
    localStorage.setItem('steamId', 'old-id');
    localStorage.setItem('steamUser', JSON.stringify({ personaName: 'Old User', avatarFull: 'old.jpg', profileUrl: 'old.url' }));

    let capturedContext: any;
    render(
      <SteamProvider>
        <TestConsumer action={(ctx) => { capturedContext = ctx; }}/>
      </SteamProvider>
    );

    // Initial state should be from localStorage (verified by other tests, assume it loads)
    // Now clear it
    await act(async () => {
      capturedContext.clearSteamConnection();
    });

    expect(document.getElementById('steam-id')?.textContent).toBe('null');
    expect(document.getElementById('steam-user-name')?.textContent).toBe('null');
    expect(localStorage.getItem('steamId')).toBeNull();
    expect(localStorage.getItem('steamUser')).toBeNull();
  });
});
