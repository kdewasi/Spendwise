require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');
const gmailRoutes = require('./routes/gmail');
const parserRoutes = require('./routes/parser');
const databaseRoutes = require('./routes/database');
const syncRoutes = require('./routes/sync');
const transactionRoutes = require('./routes/transactions');

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Spendwise API'
  });
});

// API routes
app.use('/auth', authRoutes);
app.use('/gmail', gmailRoutes);
app.use('/parser', parserRoutes);
app.use('/database', databaseRoutes);
app.use('/sync', syncRoutes);
app.use('/transactions', transactionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Spendwise API running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});