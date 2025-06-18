import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PsnConnections from './PsnConnections';
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


describe('PsnConnections Component', () => {
  const mockToast = jest.fn();
  beforeEach(() => {
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
    global.fetch.mockClear();
    localStorageMock.clear();
    jest.clearAllMocks(); // Clear all mocks including localStorage spy
  });

  it('renders the component with NPSSO input and button', () => {
    render(<PsnConnections />);
    expect(screen.getByLabelText(/NPSSO Token/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect to PSN/i })).toBeInTheDocument();
  });

  it('shows an error if NPSSO token is empty on submit', async () => {
    render(<PsnConnections />);
    fireEvent.click(screen.getByRole('button', { name: /Connect to PSN/i }));
    expect(await screen.findByText(/NPSSO token cannot be empty./i)).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Error',
      description: 'NPSSO token cannot be empty.',
      variant: 'destructive'
    }));
  });

  it('handles successful authentication flow', async () => {
    global.fetch
      .mockResolvedValueOnce({ // For /api/psn/initiate-auth
        ok: true,
        json: async () => ({ accessCode: 'mockAccessCode' }),
      } as Response)
      .mockResolvedValueOnce({ // For /api/psn/exchange-code
        ok: true,
        json: async () => ({
          authorization: {
            accessToken: 'mockAccessToken',
            refreshToken: 'mockRefreshToken',
            expiresIn: 3600
          }
        }),
      } as Response);

    const setItemSpy = jest.spyOn(localStorageMock, 'setItem');

    render(<PsnConnections />);
    fireEvent.change(screen.getByLabelText(/NPSSO Token/i), { target: { value: 'testNpsso' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect to PSN/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Step 1 Complete',
        description: 'NPSSO exchanged for access code. Now exchanging for auth tokens.'
      }));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'PSN Authentication Successful!',
        description: 'Access and refresh tokens obtained.'
      }));
    });

    expect(await screen.findByText(/Successfully connected to PSN!/i)).toBeInTheDocument();
    expect(setItemSpy).toHaveBeenCalledWith('psnAuthToken', 'mockAccessToken');
  });

  it('handles failure during NPSSO exchange (/api/psn/initiate-auth)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error during NPSSO exchange' }),
    } as Response);

    render(<PsnConnections />);
    fireEvent.change(screen.getByLabelText(/NPSSO Token/i), { target: { value: 'testNpsso' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect to PSN/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Authentication Error',
        description: 'Server error during NPSSO exchange',
        variant: 'destructive'
      }));
    });
    expect(await screen.findByText(/Server error during NPSSO exchange/i)).toBeInTheDocument();
  });

  it('handles failure during access code exchange (/api/psn/exchange-code)', async () => {
    global.fetch
      .mockResolvedValueOnce({ // Successful /api/psn/initiate-auth
        ok: true,
        json: async () => ({ accessCode: 'mockAccessCode' }),
      } as Response)
      .mockResolvedValueOnce({ // Failed /api/psn/exchange-code
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error during token exchange' }),
      } as Response);

    render(<PsnConnections />);
    fireEvent.change(screen.getByLabelText(/NPSSO Token/i), { target: { value: 'testNpsso' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect to PSN/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Step 1 Complete', // First part succeeds
      }));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Authentication Error',
        description: 'Server error during token exchange',
        variant: 'destructive'
      }));
    });
    expect(await screen.findByText(/Server error during token exchange/i)).toBeInTheDocument();
  });
});
