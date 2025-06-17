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
    try {
      // Assuming backend is on port 3001 for API calls
      const response = await fetch('http://localhost:3001/api/user/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null); // Not authenticated or error
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
        // Backend logout call
        await fetch('http://localhost:3001/auth/logout'); // Assuming this is your backend logout endpoint
        setUser(null);
    } catch (error) {
        console.error('Logout failed:', error);
        // Optionally handle logout errors, e.g., show a toast
    } finally {
        setIsLoading(false);
        // Redirect to login or home page after logout
        // This might be better handled by the component calling logout
        // For now, just clearing user state.
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
