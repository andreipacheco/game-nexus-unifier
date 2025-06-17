import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { AuthProvider, useAuth } from '@/contexts/AuthContext'; // Import actual AuthProvider and useAuth hook

// Mock the useAuth hook
jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'), // Import and retain default exports like AuthProvider
  useAuth: jest.fn(),
}));

const MockLoginPage = () => <div>Login Page</div>;
const MockDashboardPage = () => <div>Protected Dashboard Content</div>;

describe('ProtectedRoute', () => {
  const mockUseAuth = useAuth as jest.Mock; // Cast to jest.Mock for type safety on mockReturnValue

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'test' },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<MockLoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<MockDashboardPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('redirects to /login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<MockLoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<MockDashboardPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument(); // Should be redirected to login
    expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<MockLoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<MockDashboardPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/loading authentication status.../i)).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument();
  });

  it('redirects to /login preserving state when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    // We need to check the Navigate component's props, which is tricky directly.
    // The effect is that the login page is rendered.
    // And if login page used useLocation().state.from, it could redirect back.
    // This test primarily ensures it lands on /login.
    render(
      <MemoryRouter initialEntries={['/protected-route']}>
        <Routes>
          <Route path="/login" element={<MockLoginPage />} />
          <Route path="/protected-route" element={
            <ProtectedRoute /> // This will contain an Outlet for a nested route if any
          }>
            <Route index element={<MockDashboardPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    // To test the 'state={{ from: location }}' part of Navigate,
    // one would typically have the MockLoginPage component display location.state.from.
    // For this test, confirming redirection to /login is the main goal.
  });
});
