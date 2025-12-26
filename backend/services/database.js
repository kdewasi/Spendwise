const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Create or update user
 * @param {Object} userData - User data from Google OAuth
 * @returns {Object} - User record
 */
async function upsertUser(userData) {
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        email: userData.email,
        google_id: userData.google_id,
        access_token: userData.access_token,
        refresh_token: userData.refresh_token,
        token_expiry: userData.token_expiry,
        last_login: new Date().toISOString()
      }, {
        onConflict: 'email'
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, user: data };
  } catch (error) {
    console.error('Error upserting user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user by email
 */
async function getUserByEmail(email) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    return { success: true, user: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Save transactions to database
 * @param {String} userId - User UUID
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} - Result with saved transactions
 */
async function saveTransactions(userId, transactions) {
  try {
    // Prepare transactions for insertion
    const transactionsToInsert = transactions.map(t => ({
      user_id: userId,
      amount: t.amount,
      currency: t.currency || 'CAD',
      merchant: t.merchant,
      category: t.category,
      transaction_date: t.date,
      transaction_time: t.time,
      institution: t.institution,
      card_last4: t.card_last4,
      account_last4: t.account_last4,
      transaction_type: t.transaction_type,
      description: t.description,
      location: t.location,
      email_id: t.email_id,
      email_subject: t.email_subject,
      email_date: t.email_date
    }));

    // Insert transactions (ignore duplicates based on email_id)
    const { data, error } = await supabase
      .from('transactions')
      .upsert(transactionsToInsert, {
        onConflict: 'email_id',
        ignoreDuplicates: true
      })
      .select();

    if (error) throw error;

    return {
      success: true,
      saved: data ? data.length : 0,
      transactions: data
    };
  } catch (error) {
    console.error('Error saving transactions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all transactions for a user
 */
async function getTransactions(userId, options = {}) {
  try {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false });

    // Apply filters if provided
    if (options.category) {
      query = query.eq('category', options.category);
    }
    if (options.institution) {
      query = query.eq('institution', options.institution);
    }
    if (options.startDate) {
      query = query.gte('transaction_date', options.startDate);
    }
    if (options.endDate) {
      query = query.lte('transaction_date', options.endDate);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      count: data.length,
      transactions: data
    };
  } catch (error) {
    console.error('Error getting transactions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get spending summary by category
 */
async function getSpendingSummary(userId, startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('user_id', userId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (error) throw error;

    // Group by category and sum amounts
    const summary = data.reduce((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = 0;
      }
      acc[t.category] += parseFloat(t.amount);
      return acc;
    }, {});

    return {
      success: true,
      summary: summary,
      total: Object.values(summary).reduce((a, b) => a + b, 0)
    };
  } catch (error) {
    console.error('Error getting spending summary:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) throw error;

    return {
      success: true,
      message: 'Database connected successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  upsertUser,
  getUserByEmail,
  saveTransactions,
  getTransactions,
  getSpendingSummary,
  testConnection
};