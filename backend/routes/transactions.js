const express = require('express');
const {
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getSpendingByCategory,
  getTransactionStats
} = require('../services/database');
const router = express.Router();

// ====================================
// GET ALL TRANSACTIONS (with filters)
// ====================================

router.post('/list', async (req, res) => {
  const { userId, filters = {}, page = 1, limit = 50 } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID required'
    });
  }

  try {
    const options = {
      ...filters,
      page,
      limit
    };

    const result = await getTransactions(userId, options);

    res.json(result);

  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// GET SINGLE TRANSACTION
// ====================================

router.post('/:id', async (req, res) => {
  const { userId } = req.body;
  const { id } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID required'
    });
  }

  try {
    const result = await getTransactionById(userId, id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);

  } catch (error) {
    console.error('Error getting transaction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// UPDATE TRANSACTION
// ====================================

router.put('/:id', async (req, res) => {
  const { userId, updates } = req.body;
  const { id } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID required'
    });
  }

  try {
    const result = await updateTransaction(userId, id, updates);

    res.json(result);

  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// DELETE TRANSACTION
// ====================================

router.delete('/:id', async (req, res) => {
  const { userId } = req.body;
  const { id } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID required'
    });
  }

  try {
    const result = await deleteTransaction(userId, id);

    res.json(result);

  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// GET SPENDING BY CATEGORY
// ====================================

router.post('/analytics/by-category', async (req, res) => {
  const { userId, startDate, endDate } = req.body;

  if (!userId || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'User ID, start date, and end date required'
    });
  }

  try {
    const result = await getSpendingByCategory(userId, startDate, endDate);

    res.json(result);

  } catch (error) {
    console.error('Error getting spending by category:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// GET TRANSACTION STATISTICS
// ====================================

router.post('/stats', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID required'
    });
  }

  try {
    const result = await getTransactionStats(userId);

    res.json(result);

  } catch (error) {
    console.error('Error getting transaction stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;