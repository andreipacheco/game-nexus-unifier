import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import PsnConnections from '@/components/dashboard/PsnConnections'; // Added import

const ConfigurationPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);

  const { user, logout } = useAuth(); // Get user object from useAuth
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const validatePasswords = (): boolean => {
    setPasswordChangeError(null);
    if (!newPassword || !confirmNewPassword) {
      setPasswordChangeError('New password fields cannot be empty.');
      return false;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('New passwords do not match.');
      return false;
    }
    if (newPassword.length < 8) {
      setPasswordChangeError('New password must be at least 8 characters long.');
      return false;
    }
    return true;
  };

  const handleChangePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validatePasswords()) {
      return;
    }

    setIsPasswordChanging(true);
    setPasswordChangeError(null);

    try {
      const response = await fetch('http://localhost:3000/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          newPassword,
        }),
      });

      setIsPasswordChanging(false);
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordChangeError(data.message || 'Failed to change password.');
        toast.error(data.message || 'Failed to change password.');
      }
    } catch (err) {
      setIsPasswordChanging(false);
      setPasswordChangeError('An unexpected error occurred. Please try again.');
      toast.error('An unexpected error occurred. Please try again.');
      console.error('Password change error:', err);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success('You have been logged out.');
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Logout failed. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Display name logic: use user.name, fallback to user.personaName, then 'N/A'
  const displayName = user?.name || user?.personaName || 'N/A';
  const displayEmail = user?.email || 'N/A';

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-100 p-4 pt-10 md:pt-16">
      <div className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">User Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-700">Name</Label>
              <p className="text-lg text-gray-900 p-2 border-b">{displayName}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Email</Label>
              <p className="text-lg text-gray-900 p-2 border-b">{displayEmail}</p>
            </div>
            {/* Add more profile information here if needed */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PlayStation Network</CardTitle>
            <CardDescription>Connect your PSN account to sync your games and trophies.</CardDescription>
          </CardHeader>
          <CardContent>
            <PsnConnections />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Change Password</CardTitle>
            <CardDescription className="text-center">
              Update your password below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">
                  Current Password (optional, if you have one)
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  disabled={isPasswordChanging}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordChangeError) validatePasswords();
                  }}
                  placeholder="Min. 8 characters"
                  required
                  disabled={isPasswordChanging}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => {
                    setConfirmNewPassword(e.target.value);
                    if (passwordChangeError) validatePasswords();
                  }}
                  placeholder="Re-enter your new password"
                  required
                  disabled={isPasswordChanging}
                  className="mt-1"
                />
              </div>
              {passwordChangeError && (
                <p className="text-sm text-red-600 text-center">{passwordChangeError}</p>
              )}
              <Button type="submit" disabled={isPasswordChanging} className="w-full">
                {isPasswordChanging ? 'Changing...' : 'Change Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Account Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4"> {/* Added space-y-4 for spacing between buttons */}
            <Button
              variant="secondary" // Secondary variant for less emphasis than logout's outline
              onClick={() => navigate('/dashboard')}
              className="w-full"
            >
              Back to Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full"
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConfigurationPage;
