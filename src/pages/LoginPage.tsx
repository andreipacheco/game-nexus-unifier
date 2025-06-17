import React from 'react';
import { Button } from '@/components/ui/button'; // Assuming this path is correct based on typical Shadcn/UI structure
import { FaGoogle } from 'react-icons/fa'; // Using react-icons for the Google logo

const LoginPage: React.FC = () => {
  const handleGoogleLogin = () => {
    // Redirect to the backend Google authentication route
    // Assuming backend is running on port 3001 as per previous configurations
    window.location.href = 'http://localhost:3001/auth/google';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh', // Full viewport height
      textAlign: 'center',
      padding: '20px',
      backgroundColor: '#f0f2f5' // A light background color
    }}>
      <div style={{
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        backgroundColor: 'white'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: '#333'
        }}>
          Welcome!
        </h1>
        <p style={{
          marginBottom: '2rem',
          color: '#666'
        }}>
          Please log in to continue to your dashboard.
        </p>
        <Button
          onClick={handleGoogleLogin}
          variant="outline" // Using outline variant for a less intrusive look
          size="lg" // Using large size for better clickability
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem' // Space between icon and text
          }}
        >
          <FaGoogle /> {/* Google Icon */}
          Login with Google
        </Button>
      </div>
    </div>
  );
};

export default LoginPage;
