import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner'; // For toast notifications

const ConfigurationPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validatePasswords = (): boolean => {
    if (!newPassword || !confirmNewPassword) {
      setError('New password fields cannot be empty.');
      return false;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return false;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return false;
    }
    // Potentially more password strength rules here
    setError(null);
    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!validatePasswords()) {
      return;
    }

    setIsLoading(true);

    try {
      // Assuming the API endpoint is /api/user/change-password
      // And backend is running on port 3001 (adjust if different)
      const response = await fetch('http://localhost:3001/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include Authorization header if your API requires authentication
          // 'Authorization': `Bearer ${your_auth_token_here}`,
        },
        body: JSON.stringify({
          currentPassword: currentPassword || undefined, // Send undefined if empty
          newPassword,
        }),
      });

      setIsLoading(false);
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setError(data.message || 'Failed to change password.');
        toast.error(data.message || 'Failed to change password.');
      }
    } catch (err) {
      setIsLoading(false);
      setError('An unexpected error occurred. Please try again.');
      toast.error('An unexpected error occurred. Please try again.');
      console.error('Password change error:', err);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem',
      maxWidth: '500px',
      margin: '2rem auto',
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
    }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#333' }}>
        Change Password
      </h1>
      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <div style={{ marginBottom: '1rem' }}>
          <Label htmlFor="currentPassword" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Current Password (optional, required if you have one)
          </Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter your current password"
            disabled={isLoading}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <Label htmlFor="newPassword" style={{ display: 'block', marginBottom: '0.5rem' }}>
            New Password
          </Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (error) validatePasswords(); // Re-validate on change if there was an error
            }}
            placeholder="Enter your new password (min. 8 characters)"
            required
            disabled={isLoading}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <Label htmlFor="confirmNewPassword" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Confirm New Password
          </Label>
          <Input
            id="confirmNewPassword"
            type="password"
            value={confirmNewPassword}
            onChange={(e) => {
              setConfirmNewPassword(e.target.value);
              if (error) validatePasswords(); // Re-validate on change if there was an error
            }}
            placeholder="Confirm your new password"
            required
            disabled={isLoading}
          />
        </div>
        {error && (
          <p style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>
            {error}
          </p>
        )}
        <Button type="submit" disabled={isLoading} style={{ width: '100%' }}>
          {isLoading ? 'Changing...' : 'Change Password'}
        </Button>
      </form>
    </div>
  );
};

export default ConfigurationPage;
