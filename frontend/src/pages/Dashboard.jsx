import { useState, useEffect } from 'react';
import { syncEmails, getUserEmail } from '../utils/api';
import TransactionCard from '../components/TransactionCard';

function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalSpent: 0,
    lastSync: null
  });

  useEffect(() => {
    // Get user email on load
    const token = localStorage.getItem('access_token');
    if (token) {
      getUserEmail(token).then(email => {
        if (email) setUserEmail(email);
      });
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const token = localStorage.getItem('access_token');

    try {
      const result = await syncEmails(token, 20);

      if (result.success) {
        setTransactions(result.transactions);
        
        // Calculate stats
        const totalSpent = result.transactions
          .filter(t => t.transaction_type === 'debit')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        setStats({
          totalTransactions: result.totalTransactions,
          totalSpent: totalSpent,
          lastSync: new Date().toLocaleString()
        });

        alert(`✅ Successfully synced ${result.totalTransactions} transactions!`);
      } else {
        alert(`❌ Sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('❌ Failed to sync emails');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#111',
              marginBottom: '0.25rem'
            }}>
              Spendwise Dashboard
            </h1>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
              {userEmail || 'Loading...'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: syncing ? '#ccc' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '500',
                cursor: syncing ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem'
              }}
            >
              {syncing ? '🔄 Syncing...' : '🔄 Sync Emails'}
            </button>

            <button
              onClick={handleLogout}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Total Transactions
            </p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111' }}>
              {stats.totalTransactions}
            </p>
          </div>

          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Total Spent
            </p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>
              ${stats.totalSpent.toFixed(2)}
            </p>
          </div>

          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Last Sync
            </p>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: '#111' }}>
              {stats.lastSync || 'Never'}
            </p>
          </div>
        </div>

        {/* Transactions List */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#111',
            marginBottom: '1rem'
          }}>
            Recent Transactions
          </h2>

          {transactions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#666'
            }}>
              <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</p>
              <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                No transactions yet
              </p>
              <p style={{ fontSize: '0.875rem' }}>
                Click "Sync Emails" to fetch your transaction emails
              </p>
            </div>
          ) : (
            <div>
              {transactions.map((transaction, index) => (
                <TransactionCard key={index} transaction={transaction} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;