const { google } = require('googleapis');

class GmailService {
  constructor(accessToken) {
    this.oauth2Client = new google.auth.OAuth2();
    this.oauth2Client.setCredentials({ access_token: accessToken });
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Fetch potential transaction emails with smart search
   * Design Decision: Cast a wide net, let AI filter false positives
   */
  async fetchPotentialTransactionEmails(maxResults = 50) {
    try {
      // Design Decision: Search by keywords instead of sender addresses
      // Why? Banks change email addresses, new banks appear, more flexible
      const searchQuery = this.buildTransactionSearchQuery();

      console.log(`📧 Searching Gmail with query: ${searchQuery}`);

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: searchQuery,
        maxResults: maxResults
      });

      if (!response.data.messages || response.data.messages.length === 0) {
        console.log('📭 No emails found matching criteria');
        return [];
      }

      console.log(`📬 Found ${response.data.messages.length} potential transaction emails`);

      // Fetch full content for each email in parallel
      // Design Decision: Parallel fetching = faster (100 emails in 2 seconds vs 20 seconds)
      const emailPromises = response.data.messages.map(msg =>
        this.getEmailContent(msg.id)
      );

      const emails = await Promise.all(emailPromises);

      // Filter out any failed fetches
      const validEmails = emails.filter(email => email !== null);

      console.log(`✅ Successfully fetched ${validEmails.length} complete emails`);

      return validEmails;

    } catch (error) {
      console.error('❌ Error fetching emails from Gmail:', error);
      
      // Design Decision: Specific error messages help debugging
      if (error.code === 401) {
        throw new Error('Gmail access token expired. Please re-authenticate.');
      } else if (error.code === 403) {
        throw new Error('Gmail API quota exceeded. Try again later.');
      } else if (error.code === 429) {
        throw new Error('Too many requests to Gmail. Please wait a moment.');
      }
      
      throw error;
    }
  }

  /**
   * Build smart search query for transaction emails
   * Design Decision: Use OR logic to catch all possible transaction emails
   */
  buildTransactionSearchQuery() {
    // Keywords that appear in transaction emails
    const keywords = [
      'transaction',
      'purchase',
      'payment',
      'charged',
      'debit',
      'withdrawal',
      'deposit',
      'transfer',
      'statement',
      'balance',
      'spent',
      'card ending',
      'account ending'
    ];

    // Common financial institutions (optional, makes search faster)
    const institutions = [
      'bank',
      'credit card',
      'visa',
      'mastercard',
      'amex',
      'american express'
    ];

    // Build query: (keyword1 OR keyword2 OR ...) AND newer_than:90d
    // Design Decision: 90 days = ~3 months of history (good starting point)
    const keywordQuery = keywords.map(k => `"${k}"`).join(' OR ');
    
    return `(${keywordQuery}) newer_than:90d`;
  }

  /**
   * Get full email content with retry logic
   * Design Decision: Retry on transient errors (network glitches happen)
   */
  async getEmailContent(messageId, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const message = await this.gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });

        // Extract headers
        const headers = message.data.payload.headers;
        const subject = this.getHeader(headers, 'Subject') || '';
        const from = this.getHeader(headers, 'From') || '';
        const date = this.getHeader(headers, 'Date') || '';

        // Extract body
        let body = this.extractEmailBody(message.data.payload);

        // Clean up body
        body = this.cleanEmailBody(body);

        // Design Decision: Limit body length to save API costs
        // Claude charges per token, most transaction info is in first 3000 chars
        const maxBodyLength = 3000;
        if (body.length > maxBodyLength) {
          body = body.substring(0, maxBodyLength) + '\n\n[Email truncated to save processing time]';
        }

        return {
          id: messageId,
          from,
          subject,
          date,
          body
        };

      } catch (error) {
        console.error(`Attempt ${attempt}/${retries} failed for email ${messageId}:`, error.message);
        
        if (attempt === retries) {
          console.error(`❌ Failed to fetch email ${messageId} after ${retries} attempts`);
          return null; // Don't crash entire sync for one email
        }
        
        // Wait before retry (exponential backoff)
        // Design Decision: Wait longer each time (1s, 2s, 4s)
        await this.sleep(1000 * Math.pow(2, attempt - 1));
      }
    }
    
    return null;
  }

  /**
   * Extract email body from Gmail payload
   * Design Decision: Try multiple methods because Gmail structure varies
   */
  extractEmailBody(payload) {
    let body = '';

    // Method 1: Body directly in payload
    if (payload.body && payload.body.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      return body;
    }

    // Method 2: Body in parts (multipart email)
    if (payload.parts) {
      // Prefer plain text over HTML
      const textPart = payload.parts.find(part => part.mimeType === 'text/plain');
      const htmlPart = payload.parts.find(part => part.mimeType === 'text/html');
      
      const part = textPart || htmlPart;
      
      if (part && part.body && part.body.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        return body;
      }

      // Method 3: Nested parts (complex emails)
      for (const part of payload.parts) {
        if (part.parts) {
          const nestedBody = this.extractEmailBody(part);
          if (nestedBody) {
            body = nestedBody;
            return body;
          }
        }
      }
    }

    return body;
  }

  /**
   * Clean email body for better AI parsing
   * Design Decision: Remove noise that confuses AI
   */
  cleanEmailBody(body) {
    // Remove HTML tags if present
    body = body.replace(/<[^>]*>/g, ' ');
    
    // Remove multiple spaces
    body = body.replace(/\s+/g, ' ');
    
    // Remove common email footers
    body = body.replace(/Unsubscribe.*$/gi, '');
    body = body.replace(/Click here to.*$/gi, '');
    body = body.replace(/View this email in your browser.*$/gi, '');
    
    // Remove excessive line breaks
    body = body.replace(/\n{3,}/g, '\n\n');
    
    return body.trim();
  }

  /**
   * Get specific header value
   */
  getHeader(headers, name) {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : null;
  }

  /**
   * Search emails with custom query
   * Design Decision: Allow custom queries for advanced users
   */
  async searchEmails(query, maxResults = 10) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      if (!response.data.messages) {
        return [];
      }

      const emailPromises = response.data.messages.map(msg =>
        this.getEmailContent(msg.id)
      );

      const emails = await Promise.all(emailPromises);
      return emails.filter(email => email !== null);

    } catch (error) {
      console.error('Error searching emails:', error);
      throw error;
    }
  }

  /**
   * Get specific email by ID
   */
  async getEmailById(messageId) {
    try {
      return await this.getEmailContent(messageId);
    } catch (error) {
      console.error(`Error fetching email ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Test Gmail connection and get user info
   */
  async testConnection() {
    try {
      const profile = await this.gmail.users.getProfile({
        userId: 'me'
      });

      return {
        success: true,
        email: profile.data.emailAddress,
        totalMessages: profile.data.messagesTotal,
        threadsTotal: profile.data.threadsTotal
      };
    } catch (error) {
      console.error('Gmail connection test failed:', error);
      
      if (error.code === 401) {
        return {
          success: false,
          error: 'Invalid or expired access token'
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Utility: Sleep function for retries
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get emails from specific date range
   * Design Decision: Useful for syncing specific months
   */
  async getEmailsByDateRange(startDate, endDate, maxResults = 50) {
    try {
      // Convert dates to Gmail query format (YYYY/MM/DD)
      const start = startDate.toISOString().split('T')[0].replace(/-/g, '/');
      const end = endDate.toISOString().split('T')[0].replace(/-/g, '/');
      
      const baseQuery = this.buildTransactionSearchQuery();
      const dateQuery = `after:${start} before:${end}`;
      const fullQuery = `${baseQuery} ${dateQuery}`;

      return await this.searchEmails(fullQuery, maxResults);

    } catch (error) {
      console.error('Error fetching emails by date range:', error);
      throw error;
    }
  }

  /**
   * Get unread transaction emails
   * Design Decision: For real-time syncing in the future
   */
  async getUnreadTransactionEmails(maxResults = 20) {
    try {
      const baseQuery = this.buildTransactionSearchQuery();
      const unreadQuery = `${baseQuery} is:unread`;

      return await this.searchEmails(unreadQuery, maxResults);

    } catch (error) {
      console.error('Error fetching unread emails:', error);
      throw error;
    }
  }

  /**
   * Mark email as read
   * Design Decision: Avoid processing same email twice
   */
  async markAsRead(messageId) {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });

      return { success: true };
    } catch (error) {
      console.error(`Error marking email ${messageId} as read:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get email count for quota checking
   */
  async getEmailCount(query) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 1
      });

      // Gmail doesn't return total count, only if there are results
      // This is a limitation we need to work around
      return {
        success: true,
        hasResults: !!response.data.messages
      };
    } catch (error) {
      console.error('Error getting email count:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = GmailService;