import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import ConfigurationPage from "./pages/ConfigurationPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SteamProvider } from "./contexts/SteamContext";
import { GogProvider } from "./contexts/GogContext";
import { XboxProvider } from "./contexts/XboxContext";
import { PlaystationProvider } from "./contexts/PlaystationContext"; // Added PlaystationProvider

const queryClient = new QueryClient();

// Helper component to handle root path redirection
const RootRedirector: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>; // Or a spinner component
  }

  if (isAuthenticated) {
    // If user is authenticated, redirect from root to dashboard
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }
  // If user is not authenticated, redirect from root to login
  return <Navigate to="/login" state={{ from: location }} replace />;
};

// Helper component to handle /login path redirection if already authenticated
const LoginPageWrapper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>; // Or a spinner component
  }

  if (isAuthenticated) {
    // If user is already authenticated, redirect from /login to dashboard
    const from = location.state?.from?.pathname || "/dashboard";
    return <Navigate to={from} replace />;
  }
  // If user is not authenticated, render the LoginPage
  return <LoginPage />;
};


const AppRoutes: React.FC = () => {
  const { isLoading } = useAuth(); // useAuth can now be called here as AppRoutes is child of AuthProvider

  if (isLoading) {
    // Global loading state for initial auth check
    return <div className="flex justify-center items-center min-h-screen">Authenticating...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<RootRedirector />} />
      <Route path="/login" element={<LoginPageWrapper />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Index />} /> {/* Index now serves as the dashboard content */}
        <Route path="/configuration" element={<ConfigurationPage />} />
      </Route>

      {/* Other public routes can be added here if needed */}
      {/* Example: <Route path="/about" element={<AboutPage />} /> */}

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SteamProvider>
        <GogProvider>
          <XboxProvider>
            <PlaystationProvider> {/* Added PlaystationProvider */}
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <AppRoutes /> {/* Use the new AppRoutes component */}
                </BrowserRouter>
              </TooltipProvider>
            </PlaystationProvider>
          </XboxProvider>
        </GogProvider>
      </SteamProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
