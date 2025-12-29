const API_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Fetch and parse emails from Gmail
 */
export async function syncEmails(accessToken, maxEmails = 20) {
  try {
    // Step 1: Fetch emails from Gmail
    console.log('📧 Fetching emails from Gmail...');
    const gmailResponse = await fetch(`${API_URL}/gmail/fetch-emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken,
        maxResults: maxEmails
      })
    });

    const gmailData = await gmailResponse.json();
    
    if (!gmailData.success) {
      throw new Error(gmailData.error || 'Failed to fetch emails');
    }

    console.log(`✅ Found ${gmailData.count} emails`);

    // Step 2: Parse emails with Claude AI
    console.log('🤖 Parsing emails with AI...');
    const parsePromises = gmailData.emails.map(email =>
      fetch(`${API_URL}/parser/parse-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      }).then(res => res.json())
    );

    const parseResults = await Promise.all(parsePromises);

    // Collect all successful transactions
    const allTransactions = [];
    parseResults.forEach(result => {
      if (result.success && result.is_transaction) {
        allTransactions.push(...result.transactions);
      }
    });

    console.log(`✅ Extracted ${allTransactions.length} transactions`);

    return {
      success: true,
      transactions: allTransactions,
      totalEmails: gmailData.count,
      totalTransactions: allTransactions.length
    };

  } catch (error) {
    console.error('Sync error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get user email from access token
 */
export async function getUserEmail(accessToken) {
  try {
    const response = await fetch(`${API_URL}/gmail/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessToken })
    });

    const data = await response.json();
    return data.success ? data.email : null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
}