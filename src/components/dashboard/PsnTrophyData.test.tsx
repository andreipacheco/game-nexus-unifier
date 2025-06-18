import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PsnTrophyData from './PsnTrophyData';
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
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('PsnTrophyData Component', () => {
  const mockToast = jest.fn();
  beforeEach(() => {
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
    global.fetch.mockClear();
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('renders loading state initially then displays "Access Token not found" if no token', async () => {
    render(<PsnTrophyData />);
    // expect(screen.getByText(/Loading PSN Trophy Data.../i)).toBeInTheDocument(); // May be too fast
    await waitFor(() => {
      expect(screen.getByText(/PSN Access Token not found. Please connect to PSN first./i)).toBeInTheDocument();
    });
  });

  it('fetches and displays trophy summary when access token is present', async () => {
    localStorageMock.setItem('psnAuthToken', 'testAccessToken');
    const mockSummary = {
      accountId: 'testUser123',
      trophyLevel: 150,
      progress: 75,
      tier: 4,
      earnedTrophies: {
        bronze: 100,
        silver: 50,
        gold: 20,
        platinum: 5,
      },
    };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    render(<PsnTrophyData />);
    expect(screen.getByText(/Loading PSN Trophy Data.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Account ID: testUser123/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Trophy Level: 150 \(Tier 4\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Progress to Next Level: 75%/i)).toBeInTheDocument();
    expect(screen.getByText(/Platinum: 5/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/psn/trophy-summary', {
      headers: { Authorization: 'Bearer testAccessToken' },
    });
  });

  it('shows a message if no trophy data is found (e.g. API returns null or specific structure)', async () => {
    localStorageMock.setItem('psnAuthToken', 'testAccessToken');
    // Simulate API returning ok but no actual summary data (or an empty object if that's possible)
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => null, // Or an empty object {} if the component handles that
    } as Response);

    render(<PsnTrophyData />);
    expect(screen.getByText(/Loading PSN Trophy Data.../i)).toBeInTheDocument();

    await waitFor(() => {
      // The component renders a fallback <p> tag in this case
      expect(screen.getByText(/No PSN trophy data found, or you need to connect your PSN account./i)).toBeInTheDocument();
    });
  });

  it('handles API errors when fetching trophy summary', async () => {
    localStorageMock.setItem('psnAuthToken', 'testAccessToken');
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error fetching trophy data' }),
    } as Response);

    render(<PsnTrophyData />);
    expect(screen.getByText(/Loading PSN Trophy Data.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Error Fetching Trophies',
        description: 'Server error fetching trophy data',
        variant: 'destructive'
      }));
    });
    expect(await screen.findByText(/Error: Server error fetching trophy data/i)).toBeInTheDocument();
  });
});
