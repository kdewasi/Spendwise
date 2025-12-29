function TransactionCard({ transaction }) {
  // Category emoji mapping
  const categoryEmojis = {
    groceries: '🛒',
    dining: '🍽️',
    transport: '🚗',
    shopping: '🛍️',
    bills: '💡',
    entertainment: '🎬',
    health: '🏥',
    transfer: '💸',
    other: '📌'
  };

  // Category colors
  const categoryColors = {
    groceries: '#10b981',
    dining: '#f59e0b',
    transport: '#3b82f6',
    shopping: '#ec4899',
    bills: '#8b5cf6',
    entertainment: '#ef4444',
    health: '#06b6d4',
    transfer: '#6366f1',
    other: '#6b7280'
  };

  const emoji = categoryEmojis[transaction.category] || '📌';
  const color = categoryColors[transaction.category] || '#6b7280';

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '1rem',
      borderRadius: '8px',
      marginBottom: '0.75rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      {/* Left side - Icon and details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: color + '20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem'
        }}>
          {emoji}
        </div>
        
        <div>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: '#111',
            marginBottom: '0.25rem'
          }}>
            {transaction.merchant}
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: '#666'
          }}>
            {transaction.date} {transaction.time ? `• ${transaction.time}` : ''}
          </p>
          <p style={{
            fontSize: '0.75rem',
            color: '#999',
            marginTop: '0.25rem'
          }}>
            {transaction.institution} {transaction.card_last4 ? `••${transaction.card_last4}` : ''}
          </p>
        </div>
      </div>

      {/* Right side - Amount and category */}
      <div style={{ textAlign: 'right' }}>
        <p style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: transaction.transaction_type === 'credit' ? '#10b981' : '#111',
          marginBottom: '0.25rem'
        }}>
          {transaction.transaction_type === 'credit' ? '+' : '-'}
          ${parseFloat(transaction.amount).toFixed(2)}
        </p>
        <p style={{
          fontSize: '0.75rem',
          color: color,
          fontWeight: '500',
          textTransform: 'capitalize'
        }}>
          {transaction.category}
        </p>
      </div>
    </div>
  );
}

export default TransactionCard;