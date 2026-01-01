const express = require('express');
const { google } = require('googleapis');
const { upsertUser, getUserByEmail } = require('../services/database');
const router = express.Router();

// OAuth2 client configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:5173/auth/callback'
);

// ====================================
// GENERATE GOOGLE OAUTH URL
// ====================================

router.get('/google-url', (req, res) => {
  try {
    // Design Decision: Request offline access to get refresh token
    // Why? So users don't have to re-authenticate every hour
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // CRITICAL: Gets refresh token
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      prompt: 'consent' // Force consent screen to get refresh token
    });

    res.json({ success: true, url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================
// HANDLE GOOGLE OAUTH CALLBACK
// ====================================

router.post('/google-callback', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Authorization code required'
    });
  }

  try {
    console.log('🔐 Exchanging authorization code for tokens...');

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Set credentials to get user info
    oauth2Client.setCredentials(tokens);

    // Get user profile from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    console.log('✅ User authenticated:', userInfo.data.email);

    // Design Decision: Save user to database on every login
    // Why? Updates last_login, refreshes tokens, creates user if new
    const userData = {
      email: userInfo.data.email,
      google_id: userInfo.data.id,
      full_name: userInfo.data.name,
      profile_picture_url: userInfo.data.picture,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
    };

    const result = await upsertUser(userData);

    if (!result.success) {
      throw new Error('Failed to save user to database');
    }

    console.log('💾 User saved to database');

    // Return tokens to frontend
    res.json({
      success: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.full_name,
        picture: result.user.profile_picture_url
      }
    });

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// REFRESH ACCESS TOKEN
// ====================================

router.post('/refresh-token', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({
      success: false,
      error: 'Refresh token required'
    });
  }

  try {
    oauth2Client.setCredentials({
      refresh_token: refresh_token
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    res.json({
      success: true,
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date
    });

  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
});

// ====================================
// LOGOUT (Clear tokens)
// ====================================

router.post('/logout', async (req, res) => {
  // Design Decision: Just tell frontend to clear localStorage
  // Why? Tokens are stateless, no need to track sessions
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// ====================================
// GET CURRENT USER INFO
// ====================================

router.post('/me', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email required'
    });
  }

  try {
    const result = await getUserByEmail(email);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Don't send tokens back (security)
    const { access_token, refresh_token, ...userWithoutTokens } = result.user;

    res.json({
      success: true,
      user: userWithoutTokens
    });

  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;