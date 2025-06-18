import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PsnGameLibrary from './PsnGameLibrary';
import { useToast } from '@/components/ui/use-toast';

// Mock the useToast hook
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    // Add a spy to setItem if needed for other tests, though not directly for this component's direct action
    // setItemSpy: jest.fn((key: string, value: string) => { store[key] = value.toString(); }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('PsnGameLibrary Component', () => {
  const mockToast = jest.fn();
  beforeEach(() => {
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
    global.fetch.mockClear();
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('renders loading state initially then displays "Access Token not found" if no token', async () => {
    render(<PsnGameLibrary />);
    // Initial loading state might be too quick to catch reliably without more complex async handling
    // expect(screen.getByText(/Loading PSN Game Library.../i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/PSN Access Token not found. Please connect to PSN first./i)).toBeInTheDocument();
    });
  });

  it('fetches and displays games when access token is present', async () => {
    localStorageMock.setItem('psnAuthToken', 'testAccessToken');
    const mockGames = {
      trophyTitles: [
        {
          npCommunicationId: 'game1',
          trophyTitleName: 'Test Game 1',
          trophyTitleIconUrl: 'http://example.com/icon1.jpg',
          trophyTitlePlatform: 'PS5',
          progress: 50,
          earnedTrophies: { bronze: 10, silver: 5, gold: 2, platinum: 1 },
          definedTrophies: { bronze: 20, silver: 10, gold: 4, platinum: 1 },
          lastUpdatedDateTime: new Date().toISOString(),
          hasTrophyGroups: false,
        },
      ],
      totalItemCount: 1,
    };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGames,
    } as Response);

    render(<PsnGameLibrary />);

    expect(screen.getByText(/Loading PSN Game Library.../i)).toBeInTheDocument(); // Check loading state

    await waitFor(() => {
      expect(screen.getByText(/Test Game 1/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/PS5/i)).toBeInTheDocument();
    expect(screen.getByText(/Progress: 50%/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/psn/games', {
      headers: { Authorization: 'Bearer testAccessToken' },
    });
  });

  it('shows a message if no games are found', async () => {
    localStorageMock.setItem('psnAuthToken', 'testAccessToken');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ trophyTitles: [], totalItemCount: 0 }),
    } as Response);

    render(<PsnGameLibrary />);

    expect(screen.getByText(/Loading PSN Game Library.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'No Games Found',
        description: 'No PSN games were found for your account or an error occurred.'
      }));
    });
     // The component also renders a fallback <p> tag
    expect(screen.getByText(/No PSN games found, or you need to connect your PSN account./i)).toBeInTheDocument();
  });

  it('handles API errors when fetching games', async () => {
    localStorageMock.setItem('psnAuthToken', 'testAccessToken');
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error fetching games' }),
    } as Response);

    render(<PsnGameLibrary />);
    expect(screen.getByText(/Loading PSN Game Library.../i)).toBeInTheDocument();


    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Error Fetching Games',
        description: 'Server error fetching games',
        variant: 'destructive'
      }));
    });
    expect(await screen.findByText(/Error: Server error fetching games/i)).toBeInTheDocument();
  });
});
