import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the shape of the user object and context
interface User {
  id: string;
  email: string;
  name?: string;
  avatarFull?: string;
  // Add other relevant user fields from your /api/user/me response
  steamId?: string;
  googleId?: string;
  createdAt?: Date;
  xuid?: string; // Added
  psnAccountId?: string; // Added
  psnOnlineId?: string; // Added
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>; // Basic logout, could be expanded
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    setIsLoading(true);
    console.log('AuthContext: Attempting to fetch user. Options: { credentials: "include" }');
    try {
      const response = await fetch('http://localhost:3000/api/user/me', { // Updated port
        credentials: 'include', // Crucial for sending session cookies
      });
      console.log('AuthContext: /api/user/me response status:', response.status);
      if (response.ok) {
        const userData = await response.json();
        console.log('AuthContext: User data received:', userData);
        setUser(userData);
      } else {
        console.log('AuthContext: Failed to fetch user or user not authenticated. Status:', response.statusText);
        setUser(null);
      }
    } catch (error) {
      console.error('AuthContext: Error fetching user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    console.log('AuthContext: Attempting to logout. Options: { credentials: "include" }');
    try {
        const response = await fetch('http://localhost:3000/auth/logout', { // Updated port
            credentials: 'include', // Crucial for sending session cookies
        });
        console.log('AuthContext: /auth/logout response status:', response.status);
        setUser(null); // Clear user state regardless of response for logout
    } catch (error) {
        console.error('AuthContext: Logout network error:', error);
        setUser(null); // Still clear user state on network error
    } finally {
        setIsLoading(false);
        // Redirect can be handled by the component that calls logout,
        // e.g., by checking isAuthenticated after logout completes.
        // window.location.href = '/login'; // Example redirect
    }
};

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, fetchUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
