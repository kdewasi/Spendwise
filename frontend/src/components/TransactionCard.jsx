function TransactionCard({ transaction }) {
  // Safely get category info from the joined categories table
  const category = transaction.categories || {};
  const categoryName = category.name || 'other';
  const categoryDisplay = category.display_name || 'Other';
  const categoryIcon = category.icon || '📌';
  const categoryColor = category.color || '#6b7280';

  // Safely get transaction details
  const merchant = transaction.merchant_name || 'Unknown';
  const amount = transaction.amount || 0;
  const date = transaction.transaction_date || '';
  const time = transaction.transaction_time || null;
  const institution = transaction.institution || '';
  const cardLast4 = transaction.card_last4 || null;
  const transactionType = transaction.transaction_type || 'debit';

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
          backgroundColor: categoryColor + '20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem'
        }}>
          {categoryIcon}
        </div>
        
        <div>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: '#111',
            marginBottom: '0.25rem'
          }}>
            {merchant}
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: '#666'
          }}>
            {date} {time ? `• ${time}` : ''}
          </p>
          <p style={{
            fontSize: '0.75rem',
            color: '#999',
            marginTop: '0.25rem'
          }}>
            {institution} {cardLast4 ? `••${cardLast4}` : ''}
          </p>
        </div>
      </div>

      {/* Right side - Amount and category */}
      <div style={{ textAlign: 'right' }}>
        <p style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: transactionType === 'credit' ? '#10b981' : '#111',
          marginBottom: '0.25rem'
        }}>
          {transactionType === 'credit' ? '+' : '-'}
          ${parseFloat(amount).toFixed(2)}
        </p>
        <p style={{
          fontSize: '0.75rem',
          color: categoryColor,
          fontWeight: '500',
          textTransform: 'capitalize'
        }}>
          {categoryDisplay}
        </p>
      </div>
    </div>
  );
}

export default TransactionCard;