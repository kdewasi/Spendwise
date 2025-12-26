const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');
const gmailRoutes = require('./routes/gmail');
const parserRoutes = require('./routes/parser');

// Use routes
app.use('/auth', authRoutes);
app.use('/gmail', gmailRoutes);
app.use('/parser', parserRoutes);

// Test route - Check if server is running
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Server is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Spendwise API is working!',
    version: '1.0.0'
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📍 Test it: http://localhost:${PORT}/health`);
});