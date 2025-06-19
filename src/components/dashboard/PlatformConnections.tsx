
import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSteam } from "@/contexts/SteamContext";
import { useGog } from "@/contexts/GogContext";
import { useXbox } from "@/contexts/XboxContext"; // Import useXbox
import { usePsn } from "@/contexts/PsnContext"; // Import usePsn
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plug, CheckCircle, XCircle, ExternalLink, Settings, Gamepad2 } from "lucide-react"; // Import Gamepad2

interface Platform {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  apiDocUrl: string;
  requiredCredentials: string[];
  icon: string;
  color: string;
  isLoading?: boolean; // Optional: for platform-specific loading states
  profileInfo?: string | null; // Optional: for displaying user ID or name
  error?: string | null; // Optional: for platform-specific errors
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
    name: 'Xbox (xbl.io)',
    description: 'Connect via xbl.io using your Xbox User ID (XUID) to load your game library and achievements.',
    connected: false,
    apiDocUrl: 'https://xbl.io/console', // Link to xbl.io console or docs
    requiredCredentials: ['Xbox User ID (XUID)'], // Updated credentials
    icon: '🟢', // Placeholder, will use Gamepad2 icon in render
    color: 'bg-green-600'
  },
  {
    id: 'gog',
    name: 'GOG Galaxy',
    description: 'Access your GOG game library and player data.',
    connected: false,
    apiDocUrl: 'https://gogapidocs.readthedocs.io/',
    requiredCredentials: ['Client ID', 'Client Secret'],
    icon: '🟣',
    color: 'bg-purple-600'
  },
  {
    id: 'psn',
    name: 'PlayStation Network',
    description: 'Connect your PlayStation Network account using your NPSSO token to sync your games and trophies.',
    connected: false, // Will be updated by context
    apiDocUrl: 'https://psn-api.achievements.app/authentication/authenticating-manually/#how-to-obtain-an-npsso-token',
    requiredCredentials: ['NPSSO Token'],
    icon: '🎮', // Using Gamepad2 icon in render logic like Xbox
    color: 'bg-blue-700'
  }
];

// Keep other platform definitions as they are

export const PlatformConnections = () => {
  const {
    steamId: contextSteamId,
    steamUser: contextSteamUser,
    isAuthenticated, // Use isAuthenticated from context
    isLoadingSteamProfile: isContextLoadingSteamProfile,
    steamProfileError: contextSteamProfileError,
    // setSteamConnection, // No longer directly setting like this from here
    // fetchSteamProfile, // No longer directly calling this from here after redirect
    clearSteamConnection,
    checkUserSession // Get checkUserSession to refresh context if needed
  } = useSteam();

  const location = useLocation();
  const navigate = useNavigate(); // To clean URL params

  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [platformsState, setPlatformsState] = useState<Platform[]>(platforms);
  const [localSteamError, setLocalSteamError] = useState<string | null>(null);
  const [gogIdInput, setGogIdInput] = useState<string>("");
  const [xuidInput, setXuidInput] = useState<string>(""); // For XUID input
  const [npssoInput, setNpssoInput] = useState<string>(""); // For NPSSO input

  // GOG Context
  const {
    gogUserId,
    connectGogUser,
    disconnectGogUser,
    isLoadingGogUserId,
    gogUserError
  } = useGog();

  // Xbox Context
  const {
    xboxGames,
    fetchXboxGames,
    isLoading: isLoadingXbox,
    error: errorXbox
  } = useXbox();

  // PSN Context
  const {
    psnProfile,
    isConnected: isPsnConnected,
    isLoadingGames: isLoadingPsnGames,
    errorGames: errorPsnGames,
    isConnecting: isConnectingPsn,
    errorConnect: errorConnectPsn,
    connectPsn,
    disconnectPsn,
    psnGames, // Ensure psnGames is destructured
    // fetchPsnGames, // Not called directly from button here
  } = usePsn();

  // Effect to handle Steam OpenID callback
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search); // Keep first occurrence
    // const queryParams = new URLSearchParams(location.search); // Remove second occurrence
    const steamLoginSuccess = queryParams.get('steam_login_success');
    // const returnedSteamId = queryParams.get('steamid'); // No longer primary driver for fetch here
    const errorParam = queryParams.get('error');

    if (errorParam) {
      setLocalSteamError(`Steam connection attempt failed: ${errorParam}`);
      // Clean URL params - use navigate to truly clear search params
      navigate(location.pathname, { replace: true });
      return;
    }

    if (steamLoginSuccess === 'true') {
      // Login was successful according to backend redirect.
      // SteamContext's initial load (useEffect calling checkUserSession) should fetch the user.
      // We can optionally trigger another checkUserSession here if we want to be absolutely sure
      // or if we want to handle a "login success" toast/message.
      console.log('Steam login successful redirect detected. Context should be updating/updated.');
      // For now, we rely on the initial load of SteamContext.
      // If a toast message is desired: e.g. toast("Steam connected successfully!")

      // Optionally, force a refresh of user session data if context hasn't updated yet
      // This might be useful if the component loads before SteamContext's initial checkUserSession completes
      if (!isAuthenticated && !isContextLoadingSteamProfile) {
         checkUserSession();
      }

      // Clean URL params
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, navigate, checkUserSession, isAuthenticated, isContextLoadingSteamProfile]); // Added dependencies

  // Update platformsState based on context's isAuthenticated for Steam
  useEffect(() => {
    setPlatformsState(prevPlatforms =>
      prevPlatforms.map(p => {
        if (p.id === 'steam') {
          return { ...p, connected: isAuthenticated };
        }
        if (p.id === 'gog') {
          return { ...p, connected: !!gogUserId };
        }
        if (p.id === 'xbox') {
          // Xbox is connected if there are games and no error
          return { ...p, connected: xboxGames.length > 0 && !errorXbox, isLoading: isLoadingXbox, error: errorXbox, profileInfo: xboxGames.length > 0 ? `${xboxGames.length} games` : null };
        }
        if (p.id === 'psn') {
          return {
            ...p,
            connected: isPsnConnected,
            profileInfo: psnProfile?.onlineId,
            // Prioritize connection error, then game fetch error
            error: errorConnectPsn || errorPsnGames,
            isLoading: isConnectingPsn || isLoadingPsnGames
          };
        }
        return p;
      })
    );
  }, [isAuthenticated, gogUserId, xboxGames, errorXbox, isLoadingXbox, isPsnConnected, psnProfile, errorConnectPsn, errorPsnGames, isConnectingPsn, isLoadingPsnGames]); // Add PSN dependencies


  const handleSteamAuthRedirect = () => {
    window.location.href = 'http://localhost:3000/auth/steam';
  };

  const handleSteamDisconnect = async () => {
    try {
      const response = await fetch('/auth/logout'); // Backend logout
      if (response.ok) {
        clearSteamConnection(); // Clear context and localStorage
        console.log('Successfully logged out from backend and cleared Steam connection.');
        // Optionally redirect to home or login page via navigate('/')
      } else {
        console.error('Backend logout failed. Status:', response.status);
        setLocalSteamError('Logout failed on the server. Please try again.');
        // Still clear local connection as a fallback
        clearSteamConnection();
      }
    } catch (error) {
      console.error('Error during logout request:', error);
      setLocalSteamError('An error occurred during logout. Please try again.');
      // Still clear local connection
      clearSteamConnection();
    }
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
          const isGog = platform.id === 'gog';
          const isXbox = platform.id === 'xbox';
          const isPsn = platform.id === 'psn';

          // Determine connected status from the centrally updated platformsState
          const currentPlatformState = platformsState.find(p => p.id === platform.id) || platform;
          const isPlatformConnected = currentPlatformState.connected;

          const platformIcon = isXbox || isPsn ? <Gamepad2 className="h-6 w-6" /> : <span className="text-2xl">{platform.icon}</span>;

          return (
            <Card key={platform.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {platformIcon}
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <span>{platform.name}</span>
                        {isPlatformConnected ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </CardTitle>
                      <Badge variant={isPlatformConnected ? "default" : "secondary"}>
                        {isPlatformConnected ? "Connected" : "Not Connected"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <CardDescription>
                  {isSteam && contextSteamUser ? `Connected as ${contextSteamUser.personaName}. `
                    : isSteam && isContextLoadingSteamProfile && !contextSteamUser ? 'Verifying Steam connection...'
                    : isGog && gogUserId && !isLoadingGogUserId ? `Connected with GOG User ID: ${gogUserId}. `
                    : isGog && isLoadingGogUserId ? 'Verifying GOG connection...'
                    : isXbox && isPlatformConnected ? `Xbox Connected (${xboxGames.length} games loaded). `
                    : isXbox && isLoadingXbox ? 'Loading Xbox games...'
                    : isPsn && isPsnConnected && psnProfile ? `Connected as ${psnProfile.onlineId}. `
                    : isPsn && isConnectingPsn ? 'Connecting to PSN...'
                    : platform.description}
                  {isSteam && contextSteamUser && (
                    <a href={contextSteamUser.profileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">View Profile</a>
                  )}
                </CardDescription>
                {(isSteam && (currentSteamError || contextSteamProfileError)) && (
                  <p className="text-sm text-red-500 bg-red-100 p-2 rounded mt-1">{currentSteamError || contextSteamProfileError}</p>
                )}
                {(isGog && gogUserError) && (
                  <p className="text-sm text-red-500 bg-red-100 p-2 rounded mt-1">{gogUserError}</p>
                )}
                {(isXbox && errorXbox) && (
                  <p className="text-sm text-red-500 bg-red-100 p-2 rounded mt-1">{errorXbox}</p>
                )}
                {(isPsn && errorConnectPsn) && (
                  <p className="text-sm text-red-500 bg-red-100 p-2 rounded mt-1">{errorConnectPsn}</p>
                )}
                {(isPsn && !errorConnectPsn && errorPsnGames) && ( // Only show game error if no connection error
                  <p className="text-sm text-red-500 bg-red-100 p-2 rounded mt-1">Error fetching PSN games: {errorPsnGames}</p>
                )}
              </CardHeader>
              
              <CardContent className="space-y-4">
                {isSteam && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    {isAuthenticated && contextSteamUser ? (
                       <div className="flex-1 space-y-2 text-center">
                        {contextSteamUser.avatarFull && (
                           <img src={contextSteamUser.avatarFull} alt={contextSteamUser.personaName} className="w-16 h-16 rounded-full border-2 border-green-500 mx-auto" />
                        )}
                        <p className="text-sm font-medium">{contextSteamUser.personaName}</p>
                        <Button onClick={handleSteamDisconnect} variant="outline" className="w-full">
                          <XCircle className="h-4 w-4 mr-2" /> Disconnect Steam
                        </Button>
                       </div>
                    ) : (
                      <Button
                        onClick={handleSteamAuthRedirect}
                        className="flex-1"
                        disabled={isContextLoadingSteamProfile}
                      >
                        <Plug className="h-4 w-4 mr-2" />
                        {isContextLoadingSteamProfile ? 'Connecting...' : 'Connect Steam'}
                      </Button>
                    )}
                  </div>
                )}

                {isGog && (
                  // GOG UI
                  <div className="space-y-3">
                    {gogUserId && !isLoadingGogUserId ? (
                      <div className="flex flex-col items-center space-y-2">
                        <p className="text-sm text-green-600">Connected with GOG User ID: <strong>{gogUserId}</strong></p>
                        <Button onClick={disconnectGogUser} variant="outline" className="w-full">
                          <XCircle className="h-4 w-4 mr-2" /> Disconnect GOG
                        </Button>
                      </div>
                    ) : isLoadingGogUserId ? (
                      <p className="text-sm text-muted-foreground">Loading GOG status...</p>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="gogUserIdInput">GOG User ID</Label>
                          <Input
                            id="gogUserIdInput"
                            type="text"
                            placeholder="Enter your GOG User ID"
                            value={gogIdInput}
                            onChange={(e) => setGogIdInput(e.target.value)}
                            className="mt-1"
                          />
                           <p className="text-xs text-muted-foreground mt-1">
                            Note: This is typically a numerical ID. Public GOG data access is limited.
                          </p>
                        </div>
                        <Button onClick={() => connectGogUser(gogIdInput)} className="w-full" disabled={!gogIdInput.trim() || isLoadingGogUserId}>
                          <Plug className="h-4 w-4 mr-2" /> {isLoadingGogUserId ? 'Connecting...' : 'Connect GOG'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {isXbox && (
                  <div className="space-y-3">
                    {isPlatformConnected ? ( // Use isPlatformConnected derived from platformsState
                       <div className="flex flex-col items-center space-y-2">
                        <p className="text-sm text-green-600">
                          Xbox Connected ({xboxGames.length} games loaded).
                        </p>
                         <Label htmlFor="xuidInputXbox" className="sr-only">Xbox User ID (XUID)</Label>
                         <Input
                            id="xuidInputXbox" // Ensure unique ID
                            type="text"
                            placeholder="Enter new XUID to update"
                            value={xuidInput} // This state is component-wide, might want to scope or clear
                            onChange={(e) => setXuidInput(e.target.value)}
                            className="mt-1"
                            disabled={isLoadingXbox}
                          />
                          <Button
                            onClick={() => fetchXboxGames(xuidInput)}
                            className="w-full"
                            disabled={isLoadingXbox || !xuidInput.trim()}
                          >
                            {isLoadingXbox ? 'Loading Games...' : 'Update/Reload Xbox Games'}
                          </Button>
                       </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="xuidInputXboxConnect">Xbox User ID (XUID)</Label>
                          <Input
                            id="xuidInputXboxConnect" // Ensure unique ID
                            type="text"
                            placeholder="Enter your XUID"
                            value={xuidInput}
                            onChange={(e) => setXuidInput(e.target.value)}
                            className="mt-1"
                            disabled={isLoadingXbox}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            You can find your XUID using online tools (e.g., search "find my XUID").
                          </p>
                        </div>
                        <Button
                          onClick={() => fetchXboxGames(xuidInput)}
                          className="w-full"
                          disabled={isLoadingXbox || !xuidInput.trim()}
                        >
                          <Plug className="h-4 w-4 mr-2" />
                          {isLoadingXbox ? 'Loading Xbox Games...' : 'Load Xbox Games'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {isPsn && (
                  <div className="space-y-3">
                    {isPsnConnected && psnProfile ? (
                      <div className="flex flex-col items-center space-y-2">
                        <p className="text-sm text-green-600">Connected as PSN ID: <strong>{psnProfile.onlineId}</strong></p>
                        {isLoadingPsnGames && <p className="text-xs text-muted-foreground">Loading PSN games...</p>}
                        <Button onClick={disconnectPsn} variant="outline" className="w-full" disabled={isConnectingPsn || isLoadingPsnGames}>
                          <XCircle className="h-4 w-4 mr-2" /> Disconnect PSN
                        </Button>
                      </div>
                    ) : isConnectingPsn ? (
                      <p className="text-sm text-muted-foreground">Connecting to PSN...</p>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="npssoInput">NPSSO Token</Label>
                          <Input
                            id="npssoInput"
                            type="password" // Keep it as password for sensitivity
                            placeholder="Enter your NPSSO Token"
                            value={npssoInput}
                            onChange={(e) => setNpssoInput(e.target.value)}
                            className="mt-1"
                          />
                           <p className="text-xs text-muted-foreground mt-1">
                             Obtain your NPSSO token by following{' '}
                             <a href={platform.apiDocUrl} target="_blank" rel="noopener noreferrer" className="underline text-blue-500 hover:text-blue-600">
                               this guide
                             </a>. Keep it secure.
                           </p>
                        </div>
                        <Button
                          onClick={() => connectPsn(npssoInput)}
                          className="w-full"
                          disabled={!npssoInput.trim() || isConnectingPsn}
                        >
                          <Plug className="h-4 w-4 mr-2" /> {isConnectingPsn ? 'Connecting...' : 'Connect PSN'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* UI for other platforms (non-Steam, non-GOG, non-Xbox, non-PSN) */}
                {!isSteam && !isGog && !isXbox && !isPsn && (
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
                            variant={isPlatformConnected ? "outline" : "default"}
                            className="flex-1"
                          >
                            <Plug className="h-4 w-4 mr-2" />
                            {isPlatformConnected ? "Reconfigure" : "Connect"}
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
      
      {/* Integration Status Card - Updated to reflect GOG connection */}
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
            {platformsState.filter(p => {
              if (p.id === 'steam') return isAuthenticated;
              if (p.id === 'gog') return !!gogUserId;
              if (p.id === 'xbox') return xboxGames.length > 0 && !errorXbox;
              if (p.id === 'psn') return isPsnConnected;
              return p.connected;
            }).map((platform) => (
              <div key={platform.id} className="space-y-2">
                <div className="flex items-center space-x-2">
                  {platform.id === 'xbox' || platform.id === 'psn' ? <Gamepad2 className="h-5 w-5" /> : <div className="text-lg">{platform.icon}</div>}
                  <span className="font-medium">{platform.name}</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>✓ Game Library</div>
                  {/* <div>✓ Playtime Data</div> Playtime might not be available for Xbox via this API */}
                  <div>✓ Achievements</div>
                  {/* <div>✓ Last Played</div> Last Played might not be available */}
                </div>
                {platform.id === 'steam' && contextSteamUser && isAuthenticated && (
                  <div className="text-xs p-2 bg-blue-50 rounded border border-blue-200">
                    <p className="font-medium">User: {contextSteamUser.personaName}</p>
                    <p>SteamID: {contextSteamId}</p>
                  </div>
                )}
                {platform.id === 'gog' && gogUserId && (
                  <div className="text-xs p-2 bg-purple-50 rounded border border-purple-200">
                    <p className="font-medium">GOG User ID: {gogUserId}</p>
                  </div>
                )}
                {platform.id === 'xbox' && xboxGames.length > 0 && !errorXbox && (
                  <div className="text-xs p-2 bg-green-50 rounded border border-green-200">
                    <p className="font-medium">Xbox Games: {xboxGames.length}</p>
                  </div>
                )}
                {platform.id === 'psn' && psnProfile && isPsnConnected && (
                  <div className="text-xs p-2 bg-blue-50 rounded border border-blue-200">
                    <p className="font-medium">PSN ID: {psnProfile.onlineId}</p>
                    {isLoadingPsnGames && <p className="text-xs">Loading games...</p>}
                    {!isLoadingPsnGames && psnGames && (
                      <p className="text-xs">Games: {psnGames.length}</p>
                    )}
                    {!isLoadingPsnGames && psnGames && psnGames.length === 0 && !errorPsnGames && (
                      <p className="text-xs">No PSN games found or synced yet.</p>
                    )}
                    {errorPsnGames && (
                         <p className="text-xs text-red-500">Error loading games: {String(errorPsnGames).substring(0,100)}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
             {platformsState.filter(p => {
               if (p.id === 'steam') return !isAuthenticated;
               if (p.id === 'gog') return !gogUserId;
               if (p.id === 'xbox') return !(xboxGames.length > 0 && !errorXbox);
               if (p.id === 'psn') return !isPsnConnected;
               return !p.connected;
             }).length === platformsState.length && (
              <p className="text-muted-foreground col-span-full">No platforms connected yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
