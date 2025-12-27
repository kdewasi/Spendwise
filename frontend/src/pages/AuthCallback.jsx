import { useEffect, useState } from 'react';

function AuthCallback() {
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from URL
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (!code) {
          setStatus('Error: No authorization code found');
          return;
        }

        setStatus('Exchanging code for tokens...');

        // Exchange code for tokens
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/google-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code })
        });

        const data = await response.json();

        if (data.success) {
          // Save tokens to localStorage
          localStorage.setItem('access_token', data.access_token);
          if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
          }

          setStatus('Success! Redirecting...');
          
          // Redirect to dashboard
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1000);
        } else {
          setStatus(`Error: ${data.error}`);
        }
      } catch (error) {
        console.error('Callback error:', error);
        setStatus(`Error: ${error.message}`);
      }
    };

    handleCallback();
  }, []);

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
        textAlign: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1.5rem'
        }}></div>
        
        <h2 style={{
          fontSize: '1.5rem',
          color: '#333',
          marginBottom: '0.5rem'
        }}>
          {status}
        </h2>
        
        <p style={{ color: '#666' }}>
          Please wait...
        </p>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default AuthCallback;