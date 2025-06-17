import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute"; // Import ProtectedRoute
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage"; // Import LoginPage
import ConfigurationPage from "./pages/ConfigurationPage"; // Import ConfigurationPage
import { AuthProvider } from "./contexts/AuthContext"; // Import AuthProvider
import { SteamProvider } from "./contexts/SteamContext"; // Import SteamProvider
import { GogProvider } from "./contexts/GogContext"; // Import GogProvider

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider> {/* Wrap with AuthProvider */}
      <SteamProvider>
        <GogProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} /> {/* Index/Home can be public */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected Routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<Index />} /> {/* Assuming Index can serve as Dashboard */}
                  <Route path="/configuration" element={<ConfigurationPage />} />
                </Route>

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </GogProvider>
      </SteamProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
