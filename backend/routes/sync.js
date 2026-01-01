const express = require('express');
const GmailService = require('../services/gmail');
const { parseMultipleEmails } = require('../services/parser');
const { 
  saveTransactions, 
  updateLastSync,
  createSyncLog,
  updateSyncLog,
  getUserByEmail
} = require('../services/database');
const router = express.Router();

// ====================================
// COMPLETE SYNC FLOW
// ====================================

/**
 * Full sync: Fetch emails → Parse with AI → Save to database
 * Design Decision: One endpoint does everything (simplicity)
 */
router.post('/full-sync', async (req, res) => {
  const { accessToken, userEmail, maxEmails = 50 } = req.body;

  if (!accessToken || !userEmail) {
    return res.status(400).json({
      success: false,
      error: 'Access token and user email required'
    });
  }

  const startTime = new Date();
  let syncLogId = null;

  try {
    console.log(`🔄 Starting full sync for ${userEmail}...`);

    // Get user from database
    const userResult = await getUserByEmail(userEmail);
    if (!userResult.success) {
      throw new Error('User not found in database');
    }
    const userId = userResult.user.id;

    // Create sync log
    const logResult = await createSyncLog(userId, {
      startedAt: startTime,
      syncType: 'manual'
    });
    
    if (logResult.success) {
      syncLogId = logResult.log.id;
    }

    // STEP 1: Fetch emails from Gmail
    console.log('📧 Step 1/3: Fetching emails from Gmail...');
    const gmailService = new GmailService(accessToken);
    const emails = await gmailService.fetchPotentialTransactionEmails(maxEmails);

    if (emails.length === 0) {
      const endTime = new Date();
      
      // Update sync log
      if (syncLogId) {
        await updateSyncLog(syncLogId, {
          completedAt: endTime,
          startedAt: startTime,
          emailsFetched: 0,
          emailsProcessed: 0,
          transactionsFound: 0,
          transactionsSaved: 0,
          duplicatesSkipped: 0,
          errorsCount: 0,
          status: 'success'
        });
      }

      return res.json({
        success: true,
        message: 'No transaction emails found',
        stats: {
          emailsFetched: 0,
          transactionsFound: 0,
          transactionsSaved: 0
        }
      });
    }

    console.log(`✅ Fetched ${emails.length} emails`);

    // STEP 2: Parse emails with AI
    console.log('🤖 Step 2/3: Parsing emails with AI...');
    const parseResult = await parseMultipleEmails(emails);

    console.log(`✅ Parsed ${parseResult.total_transactions} transactions`);

    // STEP 3: Save to database
    console.log('💾 Step 3/3: Saving to database...');
    let saveResult = { saved: 0, duplicates: 0 };
    
    if (parseResult.all_transactions.length > 0) {
      saveResult = await saveTransactions(userId, parseResult.all_transactions);
    }

    console.log(`✅ Saved ${saveResult.saved} new transactions (${saveResult.duplicates} duplicates skipped)`);

    // Update last sync time
    await updateLastSync(userId);

    const endTime = new Date();

    // Update sync log with results
    if (syncLogId) {
      await updateSyncLog(syncLogId, {
        completedAt: endTime,
        startedAt: startTime,
        emailsFetched: emails.length,
        emailsProcessed: parseResult.total_emails,
        transactionsFound: parseResult.total_transactions,
        transactionsSaved: saveResult.saved,
        duplicatesSkipped: saveResult.duplicates,
        errorsCount: parseResult.failed.length,
        status: 'success',
        errors: parseResult.failed.length > 0 ? parseResult.failed : null
      });
    }

    console.log(`🎉 Sync complete for ${userEmail}`);

    res.json({
      success: true,
      message: `Successfully synced ${saveResult.saved} new transactions`,
      stats: {
        emailsFetched: emails.length,
        emailsProcessed: parseResult.total_emails,
        transactionsFound: parseResult.total_transactions,
        transactionsSaved: saveResult.saved,
        duplicatesSkipped: saveResult.duplicates,
        nonTransactionEmails: parseResult.non_transaction_emails.length,
        failed: parseResult.failed.length,
        processingTime: parseResult.processing_time
      }
    });

  } catch (error) {
    console.error('❌ Sync failed:', error);

    const endTime = new Date();

    // Update sync log with error
    if (syncLogId) {
      await updateSyncLog(syncLogId, {
        completedAt: endTime,
        startedAt: startTime,
        status: 'failed',
        errors: [{ message: error.message, timestamp: endTime }]
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// GET SYNC STATUS
// ====================================

router.post('/status', async (req, res) => {
  const { userEmail } = req.body;

  if (!userEmail) {
    return res.status(400).json({
      success: false,
      error: 'User email required'
    });
  }

  try {
    const userResult = await getUserByEmail(userEmail);
    if (!userResult.success) {
      throw new Error('User not found');
    }

    const user = userResult.user;

    res.json({
      success: true,
      lastSync: user.last_sync_at,
      syncEnabled: user.email_sync_enabled,
      autoSyncFrequency: user.auto_sync_frequency
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;