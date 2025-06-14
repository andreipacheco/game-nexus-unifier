
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface SteamUserData {
  avatarFull: string;
  personaName: string;
  profileUrl: string;
}

export const PlatformConnections = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [steamUser, setSteamUser] = useState<SteamUserData | null>(null);
  const [steamConnectError, setSteamConnectError] = useState<string | null>(null);
  const [isSteamConnecting, setIsSteamConnecting] = useState<boolean>(false);
  const [platformsState, setPlatformsState] = useState<Platform[]>(platforms); // Manage platforms in state

  const handleConnect = (platform: Platform) => {
    setSelectedPlatform(platform);
    setCredentials({});
    if (platform.id === 'steam') {
      setSteamConnectError(null); // Clear previous Steam errors
      // For Steam, we might not need to open the generic dialog immediately
      // or adapt the dialog to specifically ask for SteamID
    }
  };

  const handleSteamConnect = async () => {
    if (!credentials['Steam ID']) {
      setSteamConnectError('Please enter your Steam ID.');
      return;
    }
    setIsSteamConnecting(true);
    setSteamConnectError(null);
    setSteamUser(null);
    try {
      const response = await fetch(`/api/steam/user/${credentials['Steam ID']}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }
      const data: SteamUserData = await response.json();
      setSteamUser(data);
      // Update Steam platform connected status
      setPlatformsState(prevPlatforms => prevPlatforms.map(p => p.id === 'steam' ? {...p, connected: true} : p));
      setSelectedPlatform(null); // Close dialog
    } catch (err) {
      setSteamConnectError(err instanceof Error ? err.message : 'Failed to fetch Steam user data');
      console.error(err);
      setPlatformsState(prevPlatforms => prevPlatforms.map(p => p.id === 'steam' ? {...p, connected: false} : p));
    } finally {
      setIsSteamConnecting(false);
    }
  };

  const handleSaveCredentials = () => {
    if (selectedPlatform?.id === 'steam') {
      handleSteamConnect(); // Use specific Steam connection logic
    } else {
      // Generic credential saving logic for other platforms
      console.log('Saving credentials for', selectedPlatform?.name, credentials);
      // Here you would typically make an API call to your backend to store/validate these credentials
      // For now, just closing the dialog
      setSelectedPlatform(null);
      setCredentials({});
    }
  };

  // Update connected status for Steam if steamUser data is present
  useEffect(() => {
    if (steamUser) {
      setPlatformsState(prevPlatforms => prevPlatforms.map(p => p.id === 'steam' ? {...p, connected: true} : p));
    }
  }, [steamUser]);

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
        {platformsState.map((platform) => (
          <Card key={platform.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{platform.icon}</div>
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{platform.name}</span>
                      {platform.connected ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </CardTitle>
                    <Badge variant={platform.connected ? "default" : "secondary"}>
                      {platform.connected ? "Connected" : "Not Connected"}
                    </Badge>
                  </div>
                </div>
              </div>
              <CardDescription>{platform.description}</CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
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
                        {platform.id === 'steam' && steamUser ?
                          `Connected as ${steamUser.personaName}. You can reconfigure by entering a new Steam ID.` :
                          `Enter your ${platform.name} ${platform.id === 'steam' ? 'ID' : 'API credentials'} to connect your account.`
                        }
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      {platform.id === 'steam' && steamConnectError && (
                        <p className="text-sm text-red-600 bg-red-100 p-2 rounded">{steamConnectError}</p>
                      )}
                      {platform.id === 'steam' && steamUser && !steamConnectError && (
                         <div className="mt-2 p-3 border rounded-md bg-green-50">
                           <h4 className="font-semibold text-green-700">Steam User Connected:</h4>
                           <div className="flex items-center space-x-2 mt-1">
                             <img src={steamUser.avatarFull} alt={steamUser.personaName} className="w-10 h-10 rounded-full" />
                             <div>
                               <p className="text-sm font-medium">{steamUser.personaName}</p>
                               <a href={steamUser.profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">View Profile</a>
                             </div>
                           </div>
                         </div>
                      )}
                      {platform.requiredCredentials.map((credentialName) => (
                        <div key={credentialName} className="space-y-2">
                          <Label htmlFor={`${platform.id}-${credentialName}`}>{credentialName}</Label>
                          <Input
                            id={`${platform.id}-${credentialName}`}
                            type={platform.id === 'steam' ? 'text' : 'password'}
                            placeholder={`Enter your ${credentialName}`}
                            value={credentials[credentialName] || ''}
                            onChange={(e) => {
                              setCredentials(prev => ({ ...prev, [credentialName]: e.target.value }));
                              if (platform.id === 'steam') setSteamConnectError(null); // Clear error on input change
                            }}
                          />
                        </div>
                      ))}
                      
                      <div className="flex space-x-2 pt-4">
                        <Button
                          onClick={handleSaveCredentials}
                          className="flex-1"
                          disabled={platform.id === 'steam' && isSteamConnecting}
                        >
                          {platform.id === 'steam' && isSteamConnecting ? 'Connecting...' : 'Save & Connect'}
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
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Display Steam User Info if connected, outside the specific card's dialog but within the component */}
      {/* This section could be removed if the info is shown adequately within the dialog or a global notification system */}
      {/* For now, let's keep it simple and show it primarily in the dialog */}

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
            {platformsState.filter(p => p.connected).map((platform) => ( // Use platformsState here
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
                {platform.id === 'steam' && steamUser && (
                  <div className="text-xs p-2 bg-blue-50 rounded border border-blue-200">
                    <p className="font-medium">User: {steamUser.personaName}</p>
                    <p>SteamID: {credentials['Steam ID']}</p> {/* Displaying the entered Steam ID */}
                  </div>
                )}
              </div>
            ))}
             {platformsState.filter(p => !p.connected).length === platformsState.length && (
              <p className="text-muted-foreground col-span-full">No platforms connected yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
