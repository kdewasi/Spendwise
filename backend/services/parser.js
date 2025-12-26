const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Universal transaction email parser
 * Works with ANY bank or credit card from ANY country
 * @param {Object} email - Email object with subject, body, from, date
 * @returns {Object} - Parsed transaction data or multiple transactions
 */
async function parseTransactionEmail(email) {
  const prompt = `
You are a universal financial transaction parser. You can parse transaction emails from ANY bank or credit card company worldwide.

Email Details:
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}

Email Body:
${email.body}

Instructions:
1. Determine if this email contains financial transaction information
2. If it contains ONE transaction, return a single transaction object
3. If it contains MULTIPLE transactions (like a weekly statement), return an array of transaction objects
4. If it's NOT a transaction email, return { "is_transaction": false }

For EACH transaction found, extract:
{
  "is_transaction": true,
  "amount": number (positive, no currency symbol - e.g., 45.67),
  "currency": string (e.g., "CAD", "USD", "EUR") or "CAD" as default,
  "merchant": string (clean name - e.g., "Tim Hortons" not "TIM HORTONS #1234 TORONTO ON"),
  "category": "groceries" | "dining" | "transport" | "shopping" | "bills" | "entertainment" | "health" | "transfer" | "other",
  "date": "YYYY-MM-DD",
  "time": "HH:MM" or null,
  "card_last4": string (last 4 digits) or null,
  "account_last4": string (last 4 digits of account) or null,
  "institution": string (e.g., "CIBC", "Amex", "TD", "RBC"),
  "transaction_type": "debit" | "credit" | "payment" | "refund" | "transfer",
  "description": string (original transaction description from email),
  "location": string (city/country if mentioned) or null
}

Category Guidelines:
- Food stores (Loblaws, Sobeys, Walmart grocery) → "groceries"
- Restaurants, cafes, fast food → "dining"  
- Gas, Uber, transit, parking → "transport"
- Amazon, general retail, online shopping → "shopping"
- Phone, internet, utilities, subscriptions → "bills"
- Movies, games, streaming, concerts → "entertainment"
- Pharmacy, medical, fitness → "health"
- Bank transfers, e-transfers → "transfer"
- Anything else → "other"

Important Rules:
1. Currency: Look for CAD, USD, $, C$, etc. Default to "CAD" if not specified
2. Merchant names: Remove location codes, store numbers, extra characters
3. Amount: Always positive number (e.g., 33.15 not $33.15)
4. Institution: Detect from sender email or email body
5. If MULTIPLE transactions in one email, return array: [transaction1, transaction2, ...]
6. Return ONLY valid JSON, no markdown, no explanation

Parse this email now and return JSON:
`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Extract text from Claude's response
    let responseText = message.content[0].text.trim();
    
    // Remove markdown code blocks if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/```\n?/g, '');
    }
    
    // Parse JSON
    const parsed = JSON.parse(responseText);
    
    // Check if it's a transaction email
    if (parsed.is_transaction === false) {
      return {
        success: true,
        is_transaction: false,
        message: 'This email does not contain transaction information'
      };
    }
    
    // Handle single transaction vs multiple transactions
    let transactions = [];
    
    if (Array.isArray(parsed)) {
      // Multiple transactions
      transactions = parsed;
    } else if (parsed.is_transaction) {
      // Single transaction
      transactions = [parsed];
    }
    
    // Add email metadata to each transaction
    transactions = transactions.map(t => ({
      ...t,
      email_id: email.id,
      email_subject: email.subject,
      email_date: email.date
    }));
    
    return {
      success: true,
      is_transaction: true,
      count: transactions.length,
      transactions: transactions
    };
    
  } catch (error) {
    console.error('Error parsing email with Claude:', error);
    return {
      success: false,
      error: error.message,
      email_id: email.id
    };
  }
}

/**
 * Parse multiple emails in batch
 * Works with mixed email types (different banks, formats)
 * @param {Array} emails - Array of email objects
 * @returns {Object} - All extracted transactions
 */
async function parseMultipleEmails(emails) {
  const results = {
    all_transactions: [],
    non_transaction_emails: [],
    failed: [],
    total_emails: emails.length,
    total_transactions: 0
  };

  console.log(`📧 Parsing ${emails.length} emails...`);

  // Parse emails one by one
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    console.log(`   Processing email ${i + 1}/${emails.length}...`);
    
    const result = await parseTransactionEmail(email);
    
    if (result.success && result.is_transaction) {
      // Add all transactions from this email
      results.all_transactions.push(...result.transactions);
      results.total_transactions += result.count;
    } else if (result.success && !result.is_transaction) {
      // Not a transaction email (e.g., promotional email)
      results.non_transaction_emails.push(email.id);
    } else {
      // Failed to parse
      results.failed.push({
        email_id: email.id,
        error: result.error
      });
    }
    
    // Small delay to respect rate limits (100ms)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`✅ Found ${results.total_transactions} transactions from ${emails.length} emails`);

  return results;
}

/**
 * Test Claude AI connection
 */
async function testClaudeConnection() {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'Reply with just "OK" if you can see this message.'
      }]
    });

    return {
      success: true,
      message: 'Claude AI connected successfully',
      response: message.content[0].text
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  parseTransactionEmail,
  parseMultipleEmails,
  testClaudeConnection
};