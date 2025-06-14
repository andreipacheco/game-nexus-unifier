
import { useState, useEffect, useCallback } from "react"; // Added useCallback
import { useLocation, useNavigate } from "react-router-dom"; // For URL param handling
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSteam } from "@/contexts/SteamContext"; // Import useSteam
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plug, CheckCircle, XCircle, ExternalLink, Settings } from "lucide-react";

interface Platform {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  apiDocUrl: string;
  requiredCredentials: string[];
  icon: string;
  color: string;
}

const platforms: Platform[] = [
  {
    id: 'steam',
    name: 'Steam',
  description: 'Connect your Steam account to access game data, playtime, and achievements. This connection uses your Steam ID.',
  connected: false, // Initially not connected
    apiDocUrl: 'https://developer.valvesoftware.com/wiki/Steam_Web_API',
  requiredCredentials: ['Steam ID'], // Changed from API Key to Steam ID
  icon: '🟦', // Using a simple emoji, can be replaced with FaSteam later
    color: 'bg-blue-600'
  },
  {
    id: 'epic',
    name: 'Epic Games Store',
    description: 'Access your Epic Games library and player statistics.',
    connected: false,
    apiDocUrl: 'https://dev.epicgames.com/docs/web-api-ref/',
    requiredCredentials: ['Client ID', 'Client Secret'],
    icon: '⚫',
    color: 'bg-gray-800'
  },
  {
    id: 'xbox',
    name: 'Xbox (Microsoft)',
    description: 'Connect to Xbox Live for game library and achievement data.',
    connected: true,
    apiDocUrl: 'https://docs.microsoft.com/en-us/gaming/xbox-live/api-ref/',
    requiredCredentials: ['Client ID', 'Client Secret', 'Tenant ID'],
    icon: '🟢',
    color: 'bg-green-600'
  },
  // Other platforms remain the same
  {
    id: 'gog',
    name: 'GOG Galaxy',
    description: 'Access your GOG game library and player data.',
    connected: false,
    apiDocUrl: 'https://gogapidocs.readthedocs.io/',
    requiredCredentials: ['Client ID', 'Client Secret'],
    icon: '🟣',
    color: 'bg-purple-600'
  }
];

// Keep other platform definitions as they are

export const PlatformConnections = () => {
  const {
    steamId: contextSteamId,
    steamUser: contextSteamUser,
    isLoadingSteamProfile: isContextLoadingSteamProfile,
    steamProfileError: contextSteamProfileError,
    setSteamConnection,
    fetchSteamProfile,
    clearSteamConnection
  } = useSteam();

  const location = useLocation();
  const navigate = useNavigate(); // To clean URL params

  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null); // For other platforms' dialogs
  const [credentials, setCredentials] = useState<Record<string, string>>({}); // For other platforms
  const [platformsState, setPlatformsState] = useState<Platform[]>(platforms);
  const [localSteamError, setLocalSteamError] = useState<string | null>(null);


  // Effect to handle Steam OpenID callback
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const steamLoginSuccess = queryParams.get('steam_login_success');
    const returnedSteamId = queryParams.get('steamid');
    const errorParam = queryParams.get('error'); // Potential error from backend redirect

    if (errorParam) {
      setLocalSteamError(`Steam connection failed: ${errorParam}`);
      // Clean URL params
      window.history.replaceState({}, document.title, location.pathname);
      return;
    }

    if (steamLoginSuccess === 'true' && returnedSteamId) {
      if (contextSteamId !== returnedSteamId || !contextSteamUser) {
        // If context doesn't match or user profile is missing, set/fetch
        setSteamConnection(returnedSteamId, null); // Set ID, profile will be fetched
        fetchSteamProfile(returnedSteamId).then(() => {
          // Profile is now fetched and set in context by fetchSteamProfile
          console.log("Steam profile fetched after OpenID callback.");
        }).catch(err => {
          console.error("Error fetching profile after OpenID callback:", err);
          setLocalSteamError("Successfully connected Steam, but failed to fetch profile data.");
        });
      }
      // Clean URL params
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.search, setSteamConnection, fetchSteamProfile, contextSteamId, contextSteamUser, navigate]);

  // Update platformsState based on context
  useEffect(() => {
    setPlatformsState(prevPlatforms =>
      prevPlatforms.map(p =>
        p.id === 'steam' ? { ...p, connected: !!contextSteamId } : p
      )
    );
  }, [contextSteamId]);


  const handleSteamAuthRedirect = () => {
    // Redirect to backend for Steam OpenID authentication
    // Ensure this URL matches your backend server's address and port if it's different
    window.location.href = 'http://localhost:3000/auth/steam';
  };

  const handleSteamDisconnect = () => {
    clearSteamConnection();
    // Optionally, inform backend if needed, e.g. to invalidate session parts related to Steam
  };

  // Generic connect handler for other platforms (if any use the dialog)
  const handleConnect = (platform: Platform) => {
    if (platform.id === 'steam') {
      // Steam connection is handled by redirect or shows connected state
      return;
    }
    setSelectedPlatform(platform);
    setCredentials({});
  };

  // Generic save credentials for other platforms
  const handleSaveCredentials = () => {
    if (selectedPlatform && selectedPlatform.id !== 'steam') {
      console.log('Saving credentials for', selectedPlatform.name, credentials);
      // Actual logic for other platforms...
      setSelectedPlatform(null);
      setCredentials({});
    }
  };

  const currentSteamError = localSteamError || contextSteamProfileError;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Platform Connections</h2>
        <p className="text-muted-foreground">
          Connect your gaming platforms to unify your game library. Each platform requires specific 
          credentials for API access.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {platformsState.map((platform) => {
          const isSteam = platform.id === 'steam';
          const isSteamConnected = isSteam && !!contextSteamId;
          const currentSteamPlatformData = platforms.find(p => p.id === 'steam');


          return (
            <Card key={platform.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{platform.icon}</div>
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <span>{platform.name}</span>
                        {(isSteam ? isSteamConnected : platform.connected) ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </CardTitle>
                      <Badge variant={(isSteam ? isSteamConnected : platform.connected) ? "default" : "secondary"}>
                        {(isSteam ? isSteamConnected : platform.connected) ? "Connected" : "Not Connected"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <CardDescription>
                  {isSteam && contextSteamUser
                    ? `Connected as ${contextSteamUser.personaName}. `
                    : isSteam && isContextLoadingSteamProfile
                    ? 'Connecting Steam account...'
                    : platform.description}
                  {isSteam && contextSteamUser && (
                    <a href={contextSteamUser.profileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">View Profile</a>
                  )}
                </CardDescription>
                 {isSteam && currentSteamError && (
                    <p className="text-sm text-red-500 bg-red-100 p-2 rounded mt-1">{currentSteamError}</p>
                  )}
              </CardHeader>
              
              <CardContent className="space-y-4">
                {isSteam ? (
                  // Steam specific connect/disconnect UI
                  <div className="flex flex-col sm:flex-row gap-2">
                    {isSteamConnected ? (
                       <div className="flex-1 space-y-2">
                        {contextSteamUser?.avatarFull && (
                           <img src={contextSteamUser.avatarFull} alt={contextSteamUser.personaName} className="w-16 h-16 rounded-full border-2 border-green-500" />
                        )}
                        <Button onClick={handleSteamDisconnect} variant="outline" className="w-full">
                          <XCircle className="h-4 w-4 mr-2" /> Disconnect Steam
                        </Button>
                       </div>
                    ) : (
                      <Button onClick={handleSteamAuthRedirect} className="flex-1" disabled={isContextLoadingSteamProfile}>
                        <Plug className="h-4 w-4 mr-2" />
                        {isContextLoadingSteamProfile ? 'Connecting...' : 'Connect Steam'}
                      </Button>
                    )}
                  </div>
                ) : (
                  // UI for other platforms (existing dialog logic)
                  <>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Required Credentials:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {platform.requiredCredentials.map((cred) => (
                          <li key={cred} className="flex items-center space-x-2">
                            <div className="w-1 h-1 bg-current rounded-full" />
                            <span>{cred}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => handleConnect(platform)}
                            variant={platform.connected ? "outline" : "default"}
                            className="flex-1"
                          >
                            <Plug className="h-4 w-4 mr-2" />
                            {platform.connected ? "Reconfigure" : "Connect"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Connect {platform.name}</DialogTitle>
                            <DialogDescription>
                              Enter your {platform.name} API credentials to connect your account.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            {platform.requiredCredentials.map((credentialName) => (
                              <div key={credentialName} className="space-y-2">
                                <Label htmlFor={`${platform.id}-${credentialName}`}>{credentialName}</Label>
                                <Input
                                  id={`${platform.id}-${credentialName}`}
                                  type="password"
                                  placeholder={`Enter your ${credentialName}`}
                                  value={credentials[credentialName] || ''}
                                  onChange={(e) => setCredentials(prev => ({ ...prev, [credentialName]: e.target.value }))}
                                />
                              </div>
                            ))}
                            <div className="flex space-x-2 pt-4">
                              <Button onClick={handleSaveCredentials} className="flex-1">
                                Save & Connect
                              </Button>
                              <DialogTrigger asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogTrigger>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                
                      <Button variant="ghost" size="icon" asChild>
                        <a href={platform.apiDocUrl} target="_blank" rel="noopener noreferrer" title={`${platform.name} API Docs`}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Integration Status</span>
          </CardTitle>
          <CardDescription>
            Overview of available data from each connected platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {platformsState.filter(p => (p.id === 'steam' ? !!contextSteamId : p.connected)).map((platform) => (
              <div key={platform.id} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="text-lg">{platform.icon}</div>
                  <span className="font-medium">{platform.name}</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>✓ Game Library</div>
                  <div>✓ Playtime Data</div>
                  <div>✓ Achievements</div>
                  <div>✓ Last Played</div>
                </div>
                {platform.id === 'steam' && contextSteamUser && (
                  <div className="text-xs p-2 bg-blue-50 rounded border border-blue-200">
                    <p className="font-medium">User: {contextSteamUser.personaName}</p>
                    <p>SteamID: {contextSteamId}</p>
                  </div>
                )}
              </div>
            ))}
             {platformsState.filter(p => !(p.id === 'steam' ? !!contextSteamId : p.connected)).length === platformsState.length && (
              <p className="text-muted-foreground col-span-full">No platforms connected yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
