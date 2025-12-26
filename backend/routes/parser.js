const express = require('express');
const { parseTransactionEmail, testClaudeConnection } = require('../services/parser');
const router = express.Router();

// Test Claude AI connection
router.get('/test-claude', async (req, res) => {
  try {
    const result = await testClaudeConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Parse a single email (for testing)
router.post('/parse-email', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.body) {
    return res.status(400).json({ 
      error: 'Email object with body required' 
    });
  }

  try {
    const result = await parseTransactionEmail(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;