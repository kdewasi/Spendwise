const express = require('express');
const GmailService = require('../services/gmail');
const router = express.Router();

// Test Gmail connection
router.post('/test-connection', async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token required' });
  }

  try {
    const gmailService = new GmailService(accessToken);
    const result = await gmailService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch potential transaction emails
router.post('/fetch-emails', async (req, res) => {
  const { accessToken, maxResults = 20 } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token required' });
  }

  try {
    const gmailService = new GmailService(accessToken);
    const emails = await gmailService.fetchPotentialTransactionEmails(maxResults);
    
    res.json({
      success: true,
      count: emails.length,
      emails: emails
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;