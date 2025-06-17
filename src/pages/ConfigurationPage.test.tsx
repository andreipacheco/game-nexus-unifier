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

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock useAuth hook
const mockLogout = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'),
  useAuth: () => mockUseAuth(),
}));


describe('ConfigurationPage', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    jest.clearAllMocks();
    mockNavigate.mockClear(); // Clear navigate mock specifically
    mockLogout.mockClear(); // Clear logout mock

    // Setup default mock for useAuth, can be overridden in tests
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User Name',
        personaName: 'TestUserPersona', // For fallback testing
      },
      isLoading: false,
      fetchUser: jest.fn(),
      logout: mockLogout,
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
    // Change Password form
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
    // Logout button
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    // Back to Dashboard button
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument();
  });

  // --- User Profile Display Tests ---
  describe('User Profile Display', () => {
    it('displays user name and email correctly', () => {
      renderWithProviders(<ConfigurationPage />);
      expect(screen.getByText('Test User Name')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('displays personaName if name is not available', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 'test-user-id-2',
          email: 'persona@example.com',
          name: null, // Name is null
          personaName: 'UserPersonaName123'
        },
        isLoading: false,
        fetchUser: jest.fn(),
        logout: mockLogout,
      });
      renderWithProviders(<ConfigurationPage />);
      expect(screen.getByText('UserPersonaName123')).toBeInTheDocument();
      expect(screen.getByText('persona@example.com')).toBeInTheDocument();
    });

    it('displays N/A if no name or email is available', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 'test-user-id-3',
          email: null,
          name: null,
          personaName: null
        },
        isLoading: false,
        fetchUser: jest.fn(),
        logout: mockLogout,
      });
      renderWithProviders(<ConfigurationPage />);
      // The component uses <p>{displayName}</p>, so we search for the text content directly
      // Need to be careful if there are multiple 'N/A's, but for distinct fields it's okay.
      // Check within specific sections if needed, but for now, direct text check.
      const nameDisplay = screen.getAllByText('N/A').find(node => node.previousSibling && node.previousSibling.textContent === 'Name');
      const emailDisplay = screen.getAllByText('N/A').find(node => node.previousSibling && node.previousSibling.textContent === 'Email');

      // A better way to assert this is to get by specific test-ids or more structured queries if possible.
      // For now, this relies on the text content of the <p> tags.
      // Let's assume the structure is <Label>Name</Label><p>Test User Name</p>
      expect(screen.getByText((content, element) => element.tagName.toLowerCase() === 'p' && content === 'N/A' && element.previousElementSibling?.textContent === 'Name')).toBeInTheDocument();
      expect(screen.getByText((content, element) => element.tagName.toLowerCase() === 'p' && content === 'N/A' && element.previousElementSibling?.textContent === 'Email')).toBeInTheDocument();
    });
  });

  // --- Password Change Tests ---
  describe('Password Change', () => {
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

  // --- Logout Tests ---
  describe('Logout', () => {
    it('renders the logout button', () => {
      renderWithProviders(<ConfigurationPage />);
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });

    it('calls logout function and navigates to /login on button click', async () => {
      mockLogout.mockResolvedValueOnce(undefined); // Simulate successful logout from context
      renderWithProviders(<ConfigurationPage />);

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      // Check for loading state (optional, if implemented well)
      expect(screen.getByRole('button', { name: /logging out.../i })).toBeInTheDocument();

      await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(require('@/components/ui/sonner').toast.success).toHaveBeenCalledWith('You have been logged out.'));
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
    });

    it('shows error toast if logout context function fails', async () => {
      mockLogout.mockRejectedValueOnce(new Error('Context logout failed'));
      renderWithProviders(<ConfigurationPage />);

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(require('@/components/ui/sonner').toast.error).toHaveBeenCalledWith('Logout failed. Please try again.'));
      expect(mockNavigate).not.toHaveBeenCalled(); // Should not navigate if logout fails
    });
  });

  // --- Back to Dashboard Button Test ---
  describe('Back to Dashboard Button', () => {
    it('navigates to /dashboard when "Back to Dashboard" button is clicked', () => {
      renderWithProviders(<ConfigurationPage />);
      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      fireEvent.click(backButton);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
