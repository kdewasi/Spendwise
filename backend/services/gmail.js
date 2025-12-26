const { google } = require('googleapis');

class GmailService {
  constructor(accessToken) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Fetch ALL emails that might contain transactions
   * Uses broad search to catch any financial institution
   * @param {number} maxResults - Maximum emails to fetch
   * @returns {Array} - Array of email objects
   */
  async fetchPotentialTransactionEmails(maxResults = 100) {
    try {
      // Broad search terms that catch most financial emails
      const searchTerms = [
        'transaction',
        'purchase',
        'payment',
        'debit',
        'credit',
        'withdrawal',
        'deposit',
        'transfer',
        'statement',
        'balance',
        'charged',
        'alert',
        'notification'
      ];

      // Build query - find emails with any of these terms
      const query = searchTerms.map(term => `subject:${term}`).join(' OR ');

      // Search emails
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      if (!response.data.messages) {
        return [];
      }

      console.log(`📬 Found ${response.data.messages.length} potential transaction emails`);

      // Fetch full content for each email
      const emails = await Promise.all(
        response.data.messages.map(msg => this.getEmailContent(msg.id))
      );

      return emails;
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  /**
   * Fetch emails from specific senders (banks/credit cards)
   * @param {Array} senderEmails - Array of sender email addresses
   * @param {number} maxResults - Maximum emails to fetch
   * @returns {Array} - Array of email objects
   */
  async fetchEmailsFromSenders(senderEmails, maxResults = 100) {
    try {
      const query = senderEmails.map(sender => `from:${sender}`).join(' OR ');

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      if (!response.data.messages) {
        return [];
      }

      const emails = await Promise.all(
        response.data.messages.map(msg => this.getEmailContent(msg.id))
      );

      return emails;
    } catch (error) {
      console.error('Error fetching emails from senders:', error);
      throw error;
    }
  }

  /**
   * Get full email content
   */
  async getEmailContent(messageId) {
    try {
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const headers = message.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      // Extract body
      let body = '';
      if (message.data.payload.body.data) {
        body = Buffer.from(message.data.payload.body.data, 'base64').toString();
      } else if (message.data.payload.parts) {
        const textPart = message.data.payload.parts.find(
          part => part.mimeType === 'text/plain' || part.mimeType === 'text/html'
        );
        if (textPart?.body.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString();
        }
      }

      // Limit body length to save API tokens
      const maxBodyLength = 3000;
      if (body.length > maxBodyLength) {
        body = body.substring(0, maxBodyLength) + '... [truncated]';
      }

      return {
        id: messageId,
        from,
        subject,
        date,
        body
      };
    } catch (error) {
      console.error(`Error fetching email ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Test Gmail connection
   */
  async testConnection() {
    try {
      const profile = await this.gmail.users.getProfile({
        userId: 'me'
      });
      
      return {
        success: true,
        email: profile.data.emailAddress,
        totalMessages: profile.data.messagesTotal
      };
    } catch (error) {
      console.error('Gmail connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = GmailService;