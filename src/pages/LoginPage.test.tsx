import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom'; // Needed if LoginPage uses Link, etc.
import LoginPage from './LoginPage';

// Mock react-icons if they cause issues in test environment without specific handling
jest.mock('react-icons/fa', () => ({
  FaGoogle: () => <svg data-testid="google-icon" />,
}));

describe('LoginPage', () => {
  // Mock window.location.href
  let originalLocationHref;

  beforeEach(() => {
    originalLocationHref = window.location.href;
    // Object.defineProperty is used to make window.location.href writable for tests
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, href: '' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, href: originalLocationHref },
    });
  });

  it('renders the Login with Google button', () => {
    render(
      <Router>
        <LoginPage />
      </Router>
    );

    const loginButton = screen.getByRole('button', { name: /login with google/i });
    expect(loginButton).toBeInTheDocument();
    expect(screen.getByTestId('google-icon')).toBeInTheDocument(); // Check for mocked icon
  });

  it('redirects to the Google OAuth URL when the button is clicked', () => {
    render(
      <Router>
        <LoginPage />
      </Router>
    );

    const loginButton = screen.getByRole('button', { name: /login with google/i });
    fireEvent.click(loginButton);

    expect(window.location.href).toBe('http://localhost:3001/auth/google');
  });

  it('displays welcome text', () => {
    render(
      <Router>
        <LoginPage />
      </Router>
    );
    expect(screen.getByText(/welcome!/i)).toBeInTheDocument();
    expect(screen.getByText(/please log in to continue to your dashboard./i)).toBeInTheDocument();
  });
});
