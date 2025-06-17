import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter as Router } from 'react-router-dom';
import ConfigurationPage from './ConfigurationPage';
import { AuthProvider } from '@/contexts/AuthContext'; // To provide useAuth hook
import { Toaster as Sonner } from '@/components/ui/sonner'; // For toast visibility

// Mock the toast function from sonner
jest.mock('@/components/ui/sonner', () => ({
  ...jest.requireActual('@/components/ui/sonner'), // Import and retain default exports
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(), // Add other methods if used
    warn: jest.fn(),
  },
}));

// Mock useAuth hook
const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'),
  useAuth: () => mockUseAuth(),
}));


describe('ConfigurationPage', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    jest.clearAllMocks(); // Clear toast mocks and useAuth mocks

    // Setup default mock for useAuth, can be overridden in tests
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'test-user-id', email: 'test@example.com' },
      isLoading: false,
      fetchUser: jest.fn(),
      logout: jest.fn(),
    });
  });

  const renderWithProviders = (ui) => {
    return render(
      <Router>
        <AuthProvider> {/* Actual AuthProvider to ensure context exists, useAuth is mocked above */}
          {ui}
          <Sonner /> {/* Render Toaster to make toasts visible */}
        </AuthProvider>
      </Router>
    );
  };

  it('renders the change password form correctly', () => {
    renderWithProviders(<ConfigurationPage />);
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
  });

  it('shows validation error if new passwords do not match', async () => {
    renderWithProviders(<ConfigurationPage />);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
    const submitButton = screen.getByRole('button', { name: /change password/i });

    await userEvent.type(newPasswordInput, 'newValidPassword123');
    await userEvent.type(confirmPasswordInput, 'newValidPasswordMISMATCH');
    fireEvent.click(submitButton);

    expect(await screen.findByText(/new passwords do not match/i)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows validation error if new password is too short', async () => {
    renderWithProviders(<ConfigurationPage />);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
    const submitButton = screen.getByRole('button', { name: /change password/i });

    await userEvent.type(newPasswordInput, 'short');
    await userEvent.type(confirmPasswordInput, 'short');
    fireEvent.click(submitButton);

    expect(await screen.findByText(/new password must be at least 8 characters long/i)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the API and shows success toast on successful password change', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ message: 'Password changed successfully!' }), { status: 200 });
    renderWithProviders(<ConfigurationPage />);

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
    const submitButton = screen.getByRole('button', { name: /change password/i });

    await userEvent.type(currentPasswordInput, 'currentPassword123');
    await userEvent.type(newPasswordInput, 'newValidPassword123');
    await userEvent.type(confirmPasswordInput, 'newValidPassword123');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3001/api/user/change-password',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'currentPassword123',
            newPassword: 'newValidPassword123',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(require('@/components/ui/sonner').toast.success).toHaveBeenCalledWith('Password changed successfully!');
    });
  });

  it('shows error toast if API returns an error (e.g., incorrect current password)', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ message: 'Incorrect current password.' }), { status: 401 });
    renderWithProviders(<ConfigurationPage />);

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
    const submitButton = screen.getByRole('button', { name: /change password/i });

    await userEvent.type(currentPasswordInput, 'wrongCurrentPassword123');
    await userEvent.type(newPasswordInput, 'newValidPassword123');
    await userEvent.type(confirmPasswordInput, 'newValidPassword123');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      // Check for error message displayed on page AND toast
      expect(screen.getByText('Incorrect current password.')).toBeVisible();
      expect(require('@/components/ui/sonner').toast.error).toHaveBeenCalledWith('Incorrect current password.');
    });
  });

  it('shows a generic error toast on network failure', async () => {
    fetchMock.mockRejectOnce(new Error('Network failure'));
    renderWithProviders(<ConfigurationPage />);

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
    const submitButton = screen.getByRole('button', { name: /change password/i });

    await userEvent.type(currentPasswordInput, 'currentPassword123');
    await userEvent.type(newPasswordInput, 'newValidPassword123');
    await userEvent.type(confirmPasswordInput, 'newValidPassword123');
    fireEvent.click(submitButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeVisible();
        expect(require('@/components/ui/sonner').toast.error).toHaveBeenCalledWith('An unexpected error occurred. Please try again.');
    });
  });
});
