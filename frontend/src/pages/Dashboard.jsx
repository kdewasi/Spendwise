import { useState, useEffect } from 'react';
import { fullSync, getTransactions } from '../utils/api';
import TransactionCard from '../components/TransactionCard';

function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalSpent: 0,
    totalIncome: 0,
    lastSync: null
  });

  // Get user info from localStorage
  const userId = localStorage.getItem('user_id');
  const userEmail = localStorage.getItem('user_email');
  const userName = localStorage.getItem('user_name');
  const accessToken = localStorage.getItem('access_token');

  // Load transactions from database on mount
  useEffect(() => {
    loadTransactions();
  }, []);

  /**
   * Calculate statistics from loaded transactions
   * Design Decision: Calculate in frontend since we already have the data
   */
  const calculateStats = (transactions) => {
    const totalTransactions = transactions.length;
    
    const totalSpent = transactions
      .filter(t => t.transaction_type === 'debit')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const totalIncome = transactions
      .filter(t => t.transaction_type === 'credit')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    setStats({
      totalTransactions,
      totalSpent,
      totalIncome,
      lastSync: new Date().toLocaleString()
    });
  };

  /**
   * Load transactions from database
   * Design Decision: Always load from database, not memory
   */
  const loadTransactions = async () => {
    setLoading(true);
    
    try {
      console.log('Loading transactions for user:', userId);
      
      const result = await getTransactions(userId, {}, 1, 50);

      console.log('API response:', result);

      if (result.success && result.transactions) {
        console.log('Transactions loaded:', result.transactions);
        setTransactions(result.transactions);
        calculateStats(result.transactions); // Calculate stats from loaded data
      } else {
        console.error('Failed to load transactions:', result.error);
        setTransactions([]);
        setStats({
          totalTransactions: 0,
          totalSpent: 0,
          totalIncome: 0,
          lastSync: null
        });
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sync emails: Fetch → Parse → Save to database
   */
  const handleSync = async () => {
    setSyncing(true);

    try {
      const result = await fullSync(accessToken, userEmail, 50);

      if (result.success) {
        // Reload data from database
        await loadTransactions();

        // Show success message
        alert(`✅ Successfully synced!\n\n` +
          `Emails fetched: ${result.stats.emailsFetched}\n` +
          `Transactions found: ${result.stats.transactionsFound}\n` +
          `New transactions saved: ${result.stats.transactionsSaved || 0}\n` +
          `Duplicates skipped: ${result.stats.duplicatesSkipped || 0}`
        );
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

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#666' }}>Loading your transactions...</p>
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
              Welcome back, {userName || userEmail}
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
                Click "Sync Emails" to fetch your transaction emails from Gmail
              </p>
            </div>
          ) : (
            <div>
              {transactions.map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;