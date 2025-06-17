import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { FaGoogle } from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

const LoginPage: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const { fetchUser } = useAuth();
  const navigate = useNavigate();

  // State for Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // State for Registration form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3000/auth/google';
  };

  const validateRegistration = (): boolean => {
    setError(null); // Clear previous errors
    if (!regEmail || !regPassword || !regConfirmPassword) {
      setError('Please fill in all required registration fields.');
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(regEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return false;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!loginEmail || !loginPassword) {
      setError('Please enter both email and password to log in.');
      return;
    }
    setIsLoginLoading(true);
    try {
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        credentials: 'include', // Important for session cookie handling
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || 'Login successful!');
        await fetchUser(); // Refresh user state in context
        navigate('/dashboard');
      } else {
        setError(data.message || 'Login failed. Please check your credentials.');
        toast.error(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('An unexpected error occurred during login. Please try again.');
      toast.error('An unexpected error occurred during login.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateRegistration()) {
      return;
    }
    setIsRegisterLoading(true);
    try {
      const response = await fetch('http://localhost:3000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }),
        credentials: 'include', // Important for session cookie handling
      });
      const data = await response.json();
      if (response.status === 201) { // Registration successful and user logged in
        toast.success(data.message || 'Registration successful! You are now logged in.');
        await fetchUser(); // Refresh user state in context
        navigate('/dashboard');
      } else {
        setError(data.message || 'Registration failed. Please try again.');
        toast.error(data.message || 'Registration failed.');
      }
    } catch (err) {
      setError('An unexpected error occurred during registration. Please try again.');
      toast.error('An unexpected error occurred during registration.');
    } finally {
      setIsRegisterLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f0f2f5',
      padding: '20px',
    }}>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            {isRegistering ? 'Create an Account' : 'Welcome Back!'}
          </CardTitle>
          <CardDescription className="text-center">
            {isRegistering ? 'Fill in the details below to register.' : 'Log in to access your dashboard.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRegistering ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <Label htmlFor="regName">Name (Optional)</Label>
                <Input id="regName" type="text" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Your Name" disabled={isRegisterLoading} />
              </div>
              <div>
                <Label htmlFor="regEmail">Email</Label>
                <Input id="regEmail" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="you@example.com" required disabled={isRegisterLoading} />
              </div>
              <div>
                <Label htmlFor="regPassword">Password</Label>
                <Input id="regPassword" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Min. 8 characters" required disabled={isRegisterLoading} />
              </div>
              <div>
                <Label htmlFor="regConfirmPassword">Confirm Password</Label>
                <Input id="regConfirmPassword" type="password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} placeholder="Re-enter your password" required disabled={isRegisterLoading} />
              </div>
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <Button type="submit" className="w-full" disabled={isRegisterLoading}>
                {isRegisterLoading ? 'Registering...' : 'Register'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <Label htmlFor="loginEmail">Email</Label>
                <Input id="loginEmail" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@example.com" required disabled={isLoginLoading} />
              </div>
              <div>
                <Label htmlFor="loginPassword">Password</Label>
                <Input id="loginPassword" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Your Password" required disabled={isLoginLoading} />
              </div>
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoginLoading}>
                {isLoginLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          )}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button onClick={handleGoogleLogin} variant="outline" className="w-full flex items-center justify-center gap-2">
            <FaGoogle /> Login with Google
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="link" onClick={() => { setIsRegistering(!isRegistering); setError(null); }}>
            {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
