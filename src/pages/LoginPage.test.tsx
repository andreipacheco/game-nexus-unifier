import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter as Router, MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from '@/contexts/AuthContext'; // Needed for useAuth
import { Toaster as Sonner } from '@/components/ui/sonner'; // For toast visibility

// Mock react-icons
jest.mock('react-icons/fa', () => ({
  FaGoogle: () => <svg data-testid="google-icon" />,
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock useAuth hook
const mockFetchUser = jest.fn().mockResolvedValue(undefined);
jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'), // important to spread actual to get AuthProvider
  useAuth: () => ({
    fetchUser: mockFetchUser,
    // Add other properties/functions from useAuth if LoginPage uses them directly
    // For now, LoginPage primarily uses fetchUser after successful API calls.
  }),
}));

// Mock the toast function from sonner
jest.mock('@/components/ui/sonner', () => ({
  ...jest.requireActual('@/components/ui/sonner'),
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));


describe('LoginPage', () => {
  let originalLocationHref;

  beforeEach(() => {
    originalLocationHref = window.location.href;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, href: '' },
    });
    fetchMock.resetMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, href: originalLocationHref },
    });
  });

  const renderLoginPage = () => {
    // Use MemoryRouter if testing navigation aspects triggered by LoginPage itself.
    // AuthProvider is needed because LoginPage calls useAuth().
    return render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
          <Sonner /> {/* To make toasts appear */}
        </AuthProvider>
      </MemoryRouter>
    );
  };

  // --- Google Login Tests ---
  it('renders the Login with Google button', () => {
    renderLoginPage();
    expect(screen.getByRole('button', { name: /login with google/i })).toBeInTheDocument();
    expect(screen.getByTestId('google-icon')).toBeInTheDocument();
  });

  it('redirects to the Google OAuth URL when Google login button is clicked', () => {
    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: /login with google/i }));
    expect(window.location.href).toBe('http://localhost:3000/auth/google'); // Port 3000
  });

  // --- Form Toggle Tests ---
  it('initially shows the Login form and can toggle to Registration form', () => {
    renderLoginPage();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();

    const toggleButton = screen.getByRole('button', { name: /don't have an account\? register/i });
    fireEvent.click(toggleButton);

    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /already have an account\? login/i })).toBeInTheDocument();
  });

  // --- Local Login Form Tests ---
  describe('Login Form', () => {
    it('renders login fields', () => {
      renderLoginPage();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('handles successful login', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ message: 'Login successful', user: { id: '1', email: 'test@example.com' } }), { status: 200 });
      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/login', expect.anything());
      await waitFor(() => expect(mockFetchUser).toHaveBeenCalled());
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
      expect(require('@/components/ui/sonner').toast.success).toHaveBeenCalledWith('Login successful!');
    });

    it('handles login failure from API', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 });
      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(await screen.findByText('Invalid credentials')).toBeVisible();
      expect(require('@/components/ui/sonner').toast.error).toHaveBeenCalledWith('Invalid credentials');
      expect(mockFetchUser).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // --- Registration Form Tests ---
  describe('Registration Form', () => {
    beforeEach(() => {
      // Ensure we are on the registration form for these tests
      renderLoginPage();
      fireEvent.click(screen.getByRole('button', { name: /don't have an account\? register/i }));
    });

    it('renders registration fields', () => {
      expect(screen.getByLabelText(/name \(optional\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument(); // Use exact match for "Email" to distinguish
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('handles successful registration', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ message: 'Registration successful!', user: { id: '2', email: 'new@example.com' } }), { status: 201 });

      await userEvent.type(screen.getByLabelText(/name \(optional\)/i), 'New User');
      await userEvent.type(screen.getByLabelText(/^email$/i), 'new@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
      fireEvent.click(screen.getByRole('button', { name: 'Register' }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/register', expect.anything());
      await waitFor(() => expect(mockFetchUser).toHaveBeenCalled());
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
      expect(require('@/components/ui/sonner').toast.success).toHaveBeenCalledWith('Registration successful! You are now logged in.');
    });

    it('handles registration failure (e.g., email exists)', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ message: 'Email already exists' }), { status: 409 });

      await userEvent.type(screen.getByLabelText(/^email$/i), 'existing@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
      fireEvent.click(screen.getByRole('button', { name: 'Register' }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(await screen.findByText('Email already exists')).toBeVisible();
      expect(require('@/components/ui/sonner').toast.error).toHaveBeenCalledWith('Email already exists');
      expect(mockFetchUser).not.toHaveBeenCalled();
    });

    it('shows client-side error for password mismatch', async () => {
      await userEvent.type(screen.getByLabelText(/^email$/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'passwordMISMATCH');
      fireEvent.click(screen.getByRole('button', { name: 'Register' }));

      expect(await screen.findByText('Passwords do not match.')).toBeVisible();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows client-side error for short password', async () => {
      await userEvent.type(screen.getByLabelText(/^email$/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'short');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'short');
      fireEvent.click(screen.getByRole('button', { name: 'Register' }));

      expect(await screen.findByText('Password must be at least 8 characters long.')).toBeVisible();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
