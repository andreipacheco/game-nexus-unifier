
import { useState } from "react";
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
    description: 'Connect your Steam library to access game data, playtime, and achievements.',
    connected: true,
    apiDocUrl: 'https://developer.valvesoftware.com/wiki/Steam_Web_API',
    requiredCredentials: ['API Key'],
    icon: '🟦',
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

export const PlatformConnections = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const handleConnect = (platform: Platform) => {
    setSelectedPlatform(platform);
    setCredentials({});
  };

  const handleSaveCredentials = () => {
    console.log('Saving credentials for', selectedPlatform?.name, credentials);
    setSelectedPlatform(null);
    setCredentials({});
  };

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
        {platforms.map((platform) => (
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
                        Enter your {platform.name} API credentials to connect your account.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      {platform.requiredCredentials.map((credentialName) => (
                        <div key={credentialName} className="space-y-2">
                          <Label htmlFor={credentialName}>{credentialName}</Label>
                          <Input
                            id={credentialName}
                            type="password"
                            placeholder={`Enter your ${credentialName}`}
                            value={credentials[credentialName] || ''}
                            onChange={(e) => setCredentials(prev => ({
                              ...prev,
                              [credentialName]: e.target.value
                            }))}
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
                  <a href={platform.apiDocUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
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
            {platforms.filter(p => p.connected).map((platform) => (
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
