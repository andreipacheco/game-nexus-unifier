import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast'; // Assuming you have a toast hook

const PsnConnections: React.FC = () => {
  const [npsso, setNpsso] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast(); // For user feedback

  // In a real app, you'd store these tokens securely, perhaps in AuthContext or encrypted local storage
  const [psnAccessCode, setPsnAccessCode] = useState<string | null>(null);
  const [psnAuthorization, setPsnAuthorization] = useState<any | null>(null); // Store the full auth object

  const handleInitiateAuth = async () => {
    if (!npsso.trim()) {
      setError('NPSSO token cannot be empty.');
      toast({ title: 'Error', description: 'NPSSO token cannot be empty.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    setError(null);
    setPsnAccessCode(null); // Reset previous access code
    setPsnAuthorization(null); // Reset previous authorization

    try {
      const response = await fetch('/api/psn/initiate-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npsso }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      setPsnAccessCode(data.accessCode);
      toast({ title: 'Step 1 Complete', description: 'NPSSO exchanged for access code. Now exchanging for auth tokens.' });
      // Automatically proceed to exchange the access code for auth tokens
      await handleExchangeCode(data.accessCode);

    } catch (err: any) {
      console.error('Error initiating PSN auth:', err);
      const errorMessage = err.message || 'Failed to initiate PSN authentication.';
      setError(errorMessage);
      toast({ title: 'Authentication Error', description: errorMessage, variant: 'destructive' });
    } finally {
      // setIsLoading(false); // isLoading will be set to false in handleExchangeCode
    }
  };

  const handleExchangeCode = async (accessCode: string) => {
    if (!accessCode) {
      // This case should ideally not be reached if handleInitiateAuth was successful
      setError('Access code is missing.');
      toast({ title: 'Error', description: 'Access code is missing.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    // No need to set isLoading here as it's part of the same flow from handleInitiateAuth

    try {
      const response = await fetch('/api/psn/exchange-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      setPsnAuthorization(data.authorization);
      // Securely store data.authorization (e.g., in localStorage or context)
      localStorage.setItem('psnAuthToken', data.authorization.accessToken);
      // localStorage.setItem('psnRefreshToken', data.authorization.refreshToken);
      // localStorage.setItem('psnTokenExpiry', Date.now() + data.authorization.expiresIn * 1000);

      toast({ title: 'PSN Authentication Successful!', description: 'Access and refresh tokens obtained.' });
      setError(null); // Clear any previous errors

    } catch (err: any) {
      console.error('Error exchanging access code for auth tokens:', err);
      const errorMessage = err.message || 'Failed to exchange access code for auth tokens.';
      setError(errorMessage); // Set error for display
      toast({ title: 'Authentication Error', description: errorMessage, variant: 'destructive' });
      setPsnAuthorization(null); // Clear any partial auth data
    } finally {
      setIsLoading(false); // End loading state after this step
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Connect to PlayStation Network</h3>
      {psnAuthorization ? (
        <div>
          <p className="text-green-600">Successfully connected to PSN!</p>
          <p className="text-sm text-muted-foreground">You can now sync your PSN library and trophies.</p>
          {/* Optionally, add a button to disconnect or refresh token */}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            To connect your PlayStation Network account, you need to provide your NPSSO token.
            Follow the instructions <a href="https://psn-api.achievements.app/authentication/authenticating-manually#how-to-obtain-an-npsso" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">here</a> to get your NPSSO token.
          </p>
          <div className="space-y-2">
            <Label htmlFor="npsso">NPSSO Token</Label>
            <Input
              id="npsso"
              type="password" // Use password type to obscure the token
              value={npsso}
              onChange={(e) => setNpsso(e.target.value)}
              placeholder="Enter your NPSSO token"
              disabled={isLoading}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleInitiateAuth} disabled={isLoading || !npsso}>
            {isLoading ? 'Connecting...' : 'Connect to PSN'}
          </Button>
        </>
      )}
    </div>
  );
};

export default PsnConnections;
