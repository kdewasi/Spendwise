const API_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Complete sync: Fetch → Parse → Save to database
 * Design Decision: One API call does everything (backend handles complexity)
 */
export async function fullSync(accessToken, userEmail, maxEmails = 50) {
  try {
    console.log('🔄 Starting full sync...');

    const response = await fetch(`${API_URL}/sync/full-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken,
        userEmail,
        maxEmails
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Sync failed');
    }

    console.log('✅ Sync complete:', data.stats);
    return data;

  } catch (error) {
    console.error('❌ Sync error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all transactions from database
 * Design Decision: Load from database, not memory
 */
export async function getTransactions(userId, filters = {}, page = 1, limit = 50) {
  try {
    const response = await fetch(`${API_URL}/transactions/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        filters,
        page,
        limit
      })
    });

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error getting transactions:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get transaction statistics
 */
export async function getTransactionStats(userId) {
  try {
    const response = await fetch(`${API_URL}/transactions/stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    });

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error getting stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get spending by category
 */
export async function getSpendingByCategory(userId, startDate, endDate) {
  try {
    const response = await fetch(`${API_URL}/transactions/analytics/by-category`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        startDate,
        endDate
      })
    });

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error getting spending by category:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update transaction
 */
export async function updateTransaction(userId, transactionId, updates) {
  try {
    const response = await fetch(`${API_URL}/transactions/${transactionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        updates
      })
    });

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error updating transaction:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete transaction
 */
export async function deleteTransaction(userId, transactionId) {
  try {
    const response = await fetch(`${API_URL}/transactions/${transactionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    });

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error deleting transaction:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get user email from access token (for Gmail API)
 */
export async function getUserEmail(accessToken) {
  try {
    const response = await fetch(`${API_URL}/gmail/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessToken })
    });

    const data = await response.json();
    return data.success ? data.email : null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
}