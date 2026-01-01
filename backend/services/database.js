const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Parse email date from Gmail format to PostgreSQL format
 * Gmail: "Wed, 31 Dec 2025 17:57:42 +0000 (UTC)"
 * PostgreSQL: "2025-12-31T17:57:42Z"
 */
function parseEmailDate(emailDateString) {
  try {
    const date = new Date(emailDateString);
    return date.toISOString();
  } catch (error) {
    console.warn('Failed to parse email date:', emailDateString);
    return null;
  }
}

// ====================================
// USER OPERATIONS
// ====================================

/**
 * Create or update user (upsert)
 * Design Decision: Upsert = insert if new, update if exists
 * This handles both first login and subsequent logins
 */
async function upsertUser(userData) {
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        email: userData.email,
        google_id: userData.google_id,
        full_name: userData.full_name,
        profile_picture_url: userData.profile_picture_url,
        access_token: userData.access_token,
        refresh_token: userData.refresh_token,
        token_expiry: userData.token_expiry,
        last_login_at: new Date().toISOString()
      }, {
        onConflict: 'email', // if email exists, update instead of insert
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) throw error;

    // Create default preferences for new users
    if (data) {
      await createDefaultPreferences(data.id);
    }

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
 * Get user by ID
 */
async function getUserById(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return { success: true, user: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update user profile
 */
async function updateUser(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, user: data };
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update last sync time
 */
async function updateLastSync(userId) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating last sync:', error);
    return { success: false, error: error.message };
  }
}

// ====================================
// TRANSACTION OPERATIONS
// ====================================

/**
 * Save transactions with duplicate detection
 * Design Decision: Check email_id to prevent duplicates
 */
async function saveTransactions(userId, transactions) {
  try {
    // Prepare transactions for insertion
    const transactionsToInsert = transactions.map(t => ({
      user_id: userId,
      amount: t.amount,
      original_amount: t.original_amount || t.amount,
      original_currency: t.currency || t.original_currency || 'CAD',
      display_currency: t.currency || 'CAD',
      merchant_name: t.merchant,
      category_id: null, // Will be set by category lookup
      transaction_date: t.date,
      transaction_time: t.time,
      transaction_type: t.transaction_type,
      institution: t.institution,
      card_last4: t.card_last4,
      account_last4: t.account_last4,
      description: t.description,
      location: t.location,
      email_id: t.email_id,
      email_subject: t.email_subject,
      email_date: t.email_date ? parseEmailDate(t.email_date) : null,
      parsing_confidence: t.confidence || 0.85
    }));

    // Get category IDs based on category names
    for (let transaction of transactionsToInsert) {
      const categoryName = transactions.find(t => t.email_id === transaction.email_id)?.category;
      if (categoryName) {
        const { data: category } = await supabase
          .from('categories')
          .select('id')
          .eq('name', categoryName)
          .single();
        
        if (category) {
          transaction.category_id = category.id;
        }
      }
    }

    // Insert with conflict resolution
    // Design Decision: ON CONFLICT DO NOTHING prevents duplicate errors
    const { data, error } = await supabase
      .from('transactions')
      .upsert(transactionsToInsert, {
        onConflict: 'email_id',
        ignoreDuplicates: true // Skip duplicates silently
      })
      .select();

    if (error) throw error;

    const savedCount = data ? data.length : 0;
    const duplicateCount = transactionsToInsert.length - savedCount;

    return {
      success: true,
      saved: savedCount,
      duplicates: duplicateCount,
      transactions: data
    };
  } catch (error) {
    console.error('Error saving transactions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get transactions with advanced filtering
 * Design Decision: One function for all queries (simplicity)
 */
async function getTransactions(userId, options = {}) {
  try {
    let query = supabase
  .from('transactions')
  .select(`
    *,
    categories!category_id (
      name,
      display_name,
      icon,
      color
    )
  `)
  .eq('user_id', userId);

    // Apply filters
    if (options.category) {
      query = query.eq('category_id', options.category);
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
    
    if (options.minAmount) {
      query = query.gte('amount', options.minAmount);
    }
    
    if (options.maxAmount) {
      query = query.lte('amount', options.maxAmount);
    }
    
    if (options.transactionType) {
      query = query.eq('transaction_type', options.transactionType);
    }
    
    if (options.search) {
      query = query.or(`merchant_name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
    }

    // Sorting
    const sortBy = options.sortBy || 'transaction_date';
    const sortOrder = options.sortOrder === 'asc' ? { ascending: true } : { ascending: false };
    query = query.order(sortBy, sortOrder);

    // Pagination
    // Design Decision: Always paginate to prevent loading 100k records
    const page = options.page || 1;
    const limit = options.limit || 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      success: true,
      transactions: data,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    };
  } catch (error) {
    console.error('Error getting transactions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get single transaction by ID
 */
async function getTransactionById(userId, transactionId) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        categories (
          name,
          display_name,
          icon,
          color
        )
      `)
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return { success: true, transaction: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update transaction
 */
async function updateTransaction(userId, transactionId, updates) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transactionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, transaction: data };
  } catch (error) {
    console.error('Error updating transaction:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete transaction
 */
async function deleteTransaction(userId, transactionId) {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return { success: false, error: error.message };
  }
}

// ====================================
// ANALYTICS OPERATIONS
// ====================================

/**
 * Get spending summary by category
 */
async function getSpendingByCategory(userId, startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        amount,
        transaction_type,
        categories!category_id (
          name,
          display_name,
          icon,
          color
        )
      `)
      .eq('user_id', userId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (error) throw error;

    // Group by category and calculate totals
    const summary = {};
    let totalSpent = 0;
    let totalIncome = 0;

    data.forEach(transaction => {
      const categoryName = transaction.categories?.name || 'other';
      const amount = parseFloat(transaction.amount);

      if (!summary[categoryName]) {
        summary[categoryName] = {
          name: categoryName,
          displayName: transaction.categories?.display_name || 'Other',
          icon: transaction.categories?.icon || '📌',
          color: transaction.categories?.color || '#6b7280',
          total: 0,
          count: 0
        };
      }

      if (transaction.transaction_type === 'debit') {
        summary[categoryName].total += amount;
        totalSpent += amount;
      } else if (transaction.transaction_type === 'credit') {
        totalIncome += amount;
      }

      summary[categoryName].count += 1;
    });

    return {
      success: true,
      summary: Object.values(summary),
      totalSpent,
      totalIncome,
      netSpending: totalSpent - totalIncome
    };
  } catch (error) {
    console.error('Error getting spending summary:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get transaction statistics
 */
/**
 * Get transaction statistics
 */
async function getTransactionStats(userId) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('amount, transaction_type, transaction_date')
      .eq('user_id', userId);

    if (error) throw error;

    const stats = {
      totalTransactions: data.length,
      totalSpent: 0,
      totalIncome: 0,
      averageTransaction: 0,
      largestTransaction: 0,
      smallestTransaction: data.length > 0 ? Infinity : 0,
      transactionsThisMonth: 0,
      spendingThisMonth: 0
    };

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    data.forEach(t => {
      const amount = parseFloat(t.amount);
      
      if (t.transaction_type === 'debit') {
        stats.totalSpent += amount;
        if (amount > stats.largestTransaction) stats.largestTransaction = amount;
        if (amount < stats.smallestTransaction) stats.smallestTransaction = amount;
      } else if (t.transaction_type === 'credit') {
        stats.totalIncome += amount;
      }

      // This month stats
      if (t.transaction_date && t.transaction_date.startsWith(currentMonth)) {
        stats.transactionsThisMonth += 1;
        if (t.transaction_type === 'debit') {
          stats.spendingThisMonth += amount;
        }
      }
    });

    if (stats.totalTransactions > 0) {
      stats.averageTransaction = stats.totalSpent / stats.totalTransactions;
    }
    
    stats.netBalance = stats.totalIncome - stats.totalSpent;

    return { success: true, stats };
  } catch (error) {
    console.error('Error getting transaction stats:', error);
    return { success: false, error: error.message };
  }
}

// ====================================
// SYNC LOG OPERATIONS
// ====================================

/**
 * Create sync log
 */
async function createSyncLog(userId, syncData) {
  try {
    const { data, error } = await supabase
      .from('sync_logs')
      .insert({
        user_id: userId,
        sync_started_at: syncData.startedAt,
        sync_type: syncData.syncType || 'manual'
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, log: data };
  } catch (error) {
    console.error('Error creating sync log:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update sync log with results
 */
async function updateSyncLog(logId, results) {
  try {
    const duration = results.completedAt && results.startedAt
      ? Math.floor((new Date(results.completedAt) - new Date(results.startedAt)) / 1000)
      : null;

    const { data, error } = await supabase
      .from('sync_logs')
      .update({
        sync_completed_at: results.completedAt,
        duration_seconds: duration,
        emails_fetched: results.emailsFetched,
        emails_processed: results.emailsProcessed,
        transactions_found: results.transactionsFound,
        transactions_saved: results.transactionsSaved,
        duplicates_skipped: results.duplicatesSkipped,
        errors_count: results.errorsCount,
        status: results.status,
        error_details: results.errors
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, log: data };
  } catch (error) {
    console.error('Error updating sync log:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get sync history for user
 */
async function getSyncHistory(userId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, logs: data };
  } catch (error) {
    console.error('Error getting sync history:', error);
    return { success: false, error: error.message };
  }
}

// ====================================
// CATEGORY OPERATIONS
// ====================================

/**
 * Get all categories
 */
async function getCategories() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return { success: true, categories: data };
  } catch (error) {
    console.error('Error getting categories:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get category by name
 */
async function getCategoryByName(name) {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('name', name)
      .single();

    if (error) throw error;
    return { success: true, category: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ====================================
// USER PREFERENCES
// ====================================

/**
 * Create default preferences for new users
 */
async function createDefaultPreferences(userId) {
  try {
    const { error } = await supabase
      .from('user_preferences')
      .insert({
        user_id: userId,
        email_notifications: true,
        budget_alerts: true,
        weekly_summary: true,
        theme: 'light',
        date_format: 'MM/DD/YYYY',
        number_format: 'en-US'
      });

    if (error && error.code !== '23505') { // Ignore duplicate error
      throw error;
    }
    return { success: true };
  } catch (error) {
    console.error('Error creating default preferences:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user preferences
 */
async function getUserPreferences(userId) {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return { success: true, preferences: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update user preferences
 */
async function updateUserPreferences(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, preferences: data };
  } catch (error) {
    console.error('Error updating preferences:', error);
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
  // User operations
  upsertUser,
  getUserByEmail,
  getUserById,
  updateUser,
  updateLastSync,
  
  // Transaction operations
  saveTransactions,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  
  // Analytics
  getSpendingByCategory,
  getTransactionStats,
  
  // Sync logs
  createSyncLog,
  updateSyncLog,
  getSyncHistory,
  
  // Categories
  getCategories,
  getCategoryByName,
  
  // Preferences
  getUserPreferences,
  updateUserPreferences,
  
  // Utility
  testConnection
};