import { useState } from 'react';

function Login() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    
    try {
      // Get Google OAuth URL from backend
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/google-url`);
      const data = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = data.url;
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '3rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        {/* Logo/Title */}
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          color: '#3b82f6',
          marginBottom: '0.5rem'
        }}>
          Spendwise
        </h1>
        
        <p style={{
          color: '#666',
          marginBottom: '2rem',
          fontSize: '1rem'
        }}>
          AI-powered expense tracker
        </p>

        {/* Features List */}
        <div style={{
          textAlign: 'left',
          marginBottom: '2rem',
          color: '#555'
        }}>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '0.5rem' }}>✉️</span>
            <span>Automatically parse transaction emails</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '0.5rem' }}>🤖</span>
            <span>AI-powered categorization</span>
          </div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '0.5rem' }}>📊</span>
            <span>Spending analytics & insights</span>
          </div>
        </div>

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.875rem',
            backgroundColor: loading ? '#ccc' : '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            if (!loading) e.target.style.backgroundColor = '#357ae8';
          }}
          onMouseOut={(e) => {
            if (!loading) e.target.style.backgroundColor = '#4285f4';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Connecting...' : 'Continue with Google'}
        </button>

        {/* Privacy Note */}
        <p style={{
          marginTop: '1.5rem',
          fontSize: '0.75rem',
          color: '#999'
        }}>
          We'll only access your transaction emails. Your data is encrypted and secure.
        </p>
      </div>
    </div>
  );
}

export default Login;