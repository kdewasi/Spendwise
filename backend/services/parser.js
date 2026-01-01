const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ====================================
// CURRENCY CONFIGURATION
// ====================================

// Design Decision: Support major world currencies
// Why? Your app should work globally, not just Canada
const CURRENCY_SYMBOLS = {
  '$': ['USD', 'CAD', 'AUD', 'SGD', 'HKD', 'NZD'],  // Dollar variants
  'C$': 'CAD',
  'US$': 'USD',
  'A$': 'AUD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': ['JPY', 'CNY'],  // Yen/Yuan
  '₹': 'INR',
  '₽': 'RUB',
  '₩': 'KRW',
  'R$': 'BRL',
  'CHF': 'CHF',
  'kr': ['SEK', 'NOK', 'DKK']
};

// Exchange rates (approximate - for display purposes)
// Design Decision: Store original currency, convert for display
// In production, you'd use a real-time API like exchangerate-api.com
const APPROXIMATE_EXCHANGE_RATES = {
  'USD': 1.0,
  'CAD': 0.74,    // 1 CAD = 0.74 USD
  'EUR': 1.08,
  'GBP': 1.27,
  'INR': 0.012,   // 1 INR = 0.012 USD
  'AUD': 0.66,
  'JPY': 0.0068,
  'CNY': 0.14,
  'MXN': 0.050,
  'BRL': 0.20
};

// ====================================
// MAIN PARSER FUNCTION
// ====================================

/**
 * Parse transaction email with enhanced AI
 * Design Decision: Return confidence score so we can flag uncertain transactions
 */
async function parseTransactionEmail(email) {
  try {
    console.log(`🤖 Parsing email: ${email.subject}`);

    // Build enhanced prompt
    const prompt = buildEnhancedPrompt(email);

    // Call Claude AI
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.1, // Design Decision: Low temperature = more consistent parsing
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Extract and parse response
    const responseText = message.content[0].text.trim();
    const parsed = extractJSON(responseText);

    // Validate response
    if (!parsed || parsed.is_transaction === false) {
      console.log(`ℹ️  Not a transaction email: ${email.subject}`);
      return {
        success: true,
        is_transaction: false,
        message: 'Email does not contain transaction information',
        email_id: email.id
      };
    }

    // Handle single or multiple transactions
    let transactions = Array.isArray(parsed) ? parsed : [parsed];

    // Post-process each transaction
    transactions = transactions.map(t => postProcessTransaction(t, email));

    // Filter out invalid transactions
    transactions = transactions.filter(t => validateTransaction(t));

    if (transactions.length === 0) {
      console.log(`⚠️  No valid transactions found in: ${email.subject}`);
      return {
        success: true,
        is_transaction: false,
        message: 'Could not extract valid transaction data',
        email_id: email.id
      };
    }

    console.log(`✅ Parsed ${transactions.length} transaction(s) from email`);

    return {
      success: true,
      is_transaction: true,
      count: transactions.length,
      transactions: transactions
    };

  } catch (error) {
    console.error('❌ Error parsing email:', error);
    return {
      success: false,
      error: error.message,
      email_id: email.id
    };
  }
}

// ====================================
// PROMPT ENGINEERING
// ====================================

/**
 * Build enhanced prompt with better instructions
 * Design Decision: Detailed prompt = better AI accuracy
 */
function buildEnhancedPrompt(email) {
  return `You are a financial transaction parser. Extract transaction details from this email with HIGH accuracy.

EMAIL DETAILS:
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}

EMAIL BODY:
${email.body}

INSTRUCTIONS:
1. Determine if this email contains financial transaction(s)
2. Extract ALL transactions if multiple (e.g., weekly statements)
3. Return JSON only (no markdown, no explanation)

OUTPUT FORMAT:

For NON-TRANSACTION emails:
{
  "is_transaction": false
}

For SINGLE transaction:
{
  "is_transaction": true,
  "amount": 45.67,
  "currency": "CAD",
  "merchant": "Tim Hortons",
  "category": "dining",
  "date": "2025-12-22",
  "time": "14:30",
  "card_last4": "5286",
  "account_last4": null,
  "institution": "CIBC",
  "transaction_type": "debit",
  "description": "Original transaction description from email",
  "location": "Toronto, ON",
  "confidence": 0.95
}

For MULTIPLE transactions (return array):
[
  { transaction1 },
  { transaction2 },
  ...
]

FIELD RULES:

**amount**: 
- MUST be positive number without currency symbol
- Examples: 45.67, 2000.50, 15.00

**currency**:
- Detect from symbols: $ → CAD/USD, € → EUR, £ → GBP, ¥ → JPY/CNY, ₹ → INR
- Look for currency codes: "CAD", "USD", "INR", etc.
- Default to "CAD" if unclear
- CRITICAL: If you see ₹ or "INR" or "rupees", set currency to "INR"

**merchant**:
- Clean name: "TIM HORTONS #1234" → "Tim Hortons"
- Remove: location codes, store numbers, extra characters
- Capitalize properly: "WALMART" → "Walmart"

**category** (MUST be one of these):
- "groceries": Food stores (Loblaws, Walmart grocery, Costco food)
- "dining": Restaurants, cafes, fast food, bars
- "transport": Uber, gas, transit, parking, car maintenance
- "shopping": Retail, online shopping, clothing, electronics
- "bills": Utilities, phone, internet, subscriptions, insurance
- "entertainment": Movies, games, streaming, concerts, hobbies
- "health": Pharmacy, medical, dental, fitness, gym
- "transfer": E-transfers, bank transfers, person-to-person
- "other": Anything that doesn't fit above

**transaction_type**:
- "debit": Money spent (purchase, payment, withdrawal)
- "credit": Money received (refund, deposit, payment received)
- "refund": Specifically a refund
- "payment": Bill payment, credit card payment
- "transfer": Money moved between accounts

**date**: 
- Format: "YYYY-MM-DD"
- Extract from email or use email date

**time**:
- Format: "HH:MM" (24-hour)
- Set to null if not mentioned

**card_last4** / **account_last4**:
- Extract last 4 digits if mentioned
- Examples: "card ending 5286" → "5286"
- Set to null if not found

**institution**:
- Bank or card issuer: "CIBC", "TD", "RBC", "Amex", "Visa", etc.
- Extract from sender or email content
- Use proper capitalization

**description**:
- Original transaction description from email
- Keep it concise but informative

**location**:
- City/country if mentioned
- Examples: "Toronto, ON", "Vancouver, BC", "New York, USA"
- Set to null if not found

**confidence** (0.0 to 1.0):
- 0.95-1.0: All fields clearly stated
- 0.80-0.94: Most fields clear, some inferred
- 0.60-0.79: Some guessing required
- Below 0.60: Uncertain parsing

EXAMPLES:

Example 1 (Single Purchase):
Email: "Your CIBC card ending in 5286 was charged $33.15 at REMITLY on Dec 22, 2025"
→ {
  "is_transaction": true,
  "amount": 33.15,
  "currency": "CAD",
  "merchant": "Remitly",
  "category": "transfer",
  "date": "2025-12-22",
  "time": null,
  "card_last4": "5286",
  "institution": "CIBC",
  "transaction_type": "debit",
  "description": "REMITLY payment",
  "location": null,
  "confidence": 0.95
}

Example 2 (INR Currency):
Email: "Transaction of ₹2000.47 at Swiggy on 22 Dec 2025"
→ {
  "is_transaction": true,
  "amount": 2000.47,
  "currency": "INR",
  "merchant": "Swiggy",
  "category": "dining",
  ...
}

Example 3 (Weekly Statement with Multiple Transactions):
Email: "Weekly Summary: Dec 15: $25 at Starbucks, Dec 16: $150 at Walmart, Dec 17: $40 at Shell"
→ [
  { "amount": 25, "merchant": "Starbucks", "date": "2025-12-15", ... },
  { "amount": 150, "merchant": "Walmart", "date": "2025-12-16", ... },
  { "amount": 40, "merchant": "Shell", "date": "2025-12-17", ... }
]

Example 4 (Non-transaction):
Email: "Your monthly statement is ready to view. Click here to download."
→ { "is_transaction": false }

CRITICAL RULES:
1. Return ONLY valid JSON (no markdown code blocks)
2. ALL amounts must be positive numbers
3. Currency detection is CRITICAL - don't guess USD if you see ₹
4. Clean merchant names (remove codes/numbers)
5. Be conservative with confidence scores
6. For weekly/monthly statements, extract ALL individual transactions

Parse this email now:`;
}

// ====================================
// POST-PROCESSING
// ====================================

/**
 * Post-process transaction with additional logic
 * Design Decision: AI might miss things, we add extra intelligence
 */
function postProcessTransaction(transaction, email) {
  // Add email metadata
  transaction.email_id = email.id;
  transaction.email_subject = email.subject;
  transaction.email_date = email.date;

  // Ensure amount is a number
  if (typeof transaction.amount === 'string') {
    transaction.amount = parseFloat(transaction.amount.replace(/[^0-9.]/g, ''));
  }

  // Clean merchant name further
  if (transaction.merchant) {
    transaction.merchant = cleanMerchantName(transaction.merchant);
  }

  // Detect institution from email sender if not found
  if (!transaction.institution) {
    transaction.institution = detectInstitution(email.from, email.subject);
  }

  // Improve category with merchant database (optional enhancement)
  // transaction.category = improveCategoryWithMerchantDB(transaction.merchant, transaction.category);

  // Set confidence default
  if (!transaction.confidence || transaction.confidence < 0 || transaction.confidence > 1) {
    transaction.confidence = 0.75; // Default medium confidence
  }

  // Add currency conversion for display
  if (transaction.currency && transaction.currency !== 'CAD') {
    transaction.original_amount = transaction.amount;
    transaction.original_currency = transaction.currency;
    // Convert to CAD for display (approximate)
    transaction.amount = convertToCurrency(transaction.amount, transaction.currency, 'CAD');
    transaction.display_currency = 'CAD';
  }

  return transaction;
}

/**
 * Clean merchant name
 * Design Decision: Consistent naming = better analytics
 */
function cleanMerchantName(name) {
  if (!name) return 'Unknown Merchant';

  // Remove common suffixes
  name = name.replace(/\s*#\d+/g, ''); // Remove #1234
  name = name.replace(/\s*\*+\w*/g, ''); // Remove *CODE
  name = name.replace(/\s+[A-Z]{2,3}$/g, ''); // Remove state codes at end
  
  // Fix capitalization
  name = name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Known merchant mappings
  const merchantMappings = {
    'Amzn Mktp': 'Amazon',
    'Amzn': 'Amazon',
    'Sq ': 'Square ',
    'Tst*': '',
    'Sp ': ''
  };

  for (const [pattern, replacement] of Object.entries(merchantMappings)) {
    if (name.includes(pattern)) {
      name = name.replace(pattern, replacement);
    }
  }

  return name.trim();
}

/**
 * Detect financial institution from email
 */
function detectInstitution(from, subject) {
  const email = (from + ' ' + subject).toLowerCase();

  const institutions = {
    'cibc': 'CIBC',
    'td': 'TD',
    'rbc': 'RBC',
    'bmo': 'BMO',
    'scotiabank': 'Scotiabank',
    'tangerine': 'Tangerine',
    'amex': 'American Express',
    'american express': 'American Express',
    'visa': 'Visa',
    'mastercard': 'Mastercard'
  };

  for (const [key, value] of Object.entries(institutions)) {
    if (email.includes(key)) {
      return value;
    }
  }

  return 'Unknown';
}

/**
 * Convert currency (approximate)
 * Design Decision: Store original, show in user's preferred currency
 */
function convertToCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;

  const fromRate = APPROXIMATE_EXCHANGE_RATES[fromCurrency] || 1;
  const toRate = APPROXIMATE_EXCHANGE_RATES[toCurrency] || 1;

  // Convert to USD first, then to target currency
  const usdAmount = amount * fromRate;
  const convertedAmount = usdAmount / toRate;

  return Math.round(convertedAmount * 100) / 100; // Round to 2 decimals
}

// ====================================
// VALIDATION
// ====================================

/**
 * Validate parsed transaction
 * Design Decision: Garbage in, garbage out - filter bad data early
 */
function validateTransaction(transaction) {
  // Must have amount
  if (!transaction.amount || isNaN(transaction.amount) || transaction.amount <= 0) {
    console.warn('⚠️  Invalid transaction: missing or invalid amount');
    return false;
  }

  // Amount sanity check (no transaction over $1 million CAD)
  if (transaction.amount > 1000000) {
    console.warn('⚠️  Invalid transaction: amount too large');
    return false;
  }

  // Must have merchant
  if (!transaction.merchant || transaction.merchant.trim().length === 0) {
    console.warn('⚠️  Invalid transaction: missing merchant');
    return false;
  }

  // Must have valid date
  if (!transaction.date || !isValidDate(transaction.date)) {
    console.warn('⚠️  Invalid transaction: invalid date');
    return false;
  }

  // Must have valid category
  const validCategories = ['groceries', 'dining', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'transfer', 'other'];
  if (!transaction.category || !validCategories.includes(transaction.category)) {
    console.warn(`⚠️  Invalid category: ${transaction.category}, defaulting to 'other'`);
    transaction.category = 'other';
  }

  // Must have valid transaction type
  const validTypes = ['debit', 'credit', 'refund', 'payment', 'transfer'];
  if (!transaction.transaction_type || !validTypes.includes(transaction.transaction_type)) {
    console.warn(`⚠️  Invalid transaction type: ${transaction.transaction_type}, defaulting to 'debit'`);
    transaction.transaction_type = 'debit';
  }

  return true;
}

/**
 * Check if date is valid
 */
function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// ====================================
// BATCH PROCESSING
// ====================================

/**
 * Parse multiple emails in batch with progress tracking
 * Design Decision: Process in parallel but with rate limiting
 */
async function parseMultipleEmails(emails) {
  const results = {
    all_transactions: [],
    non_transaction_emails: [],
    failed: [],
    total_emails: emails.length,
    total_transactions: 0,
    processing_time: 0
  };

  const startTime = Date.now();

  console.log(`📧 Starting batch parse of ${emails.length} emails...`);

  // Process in batches of 5 to avoid rate limits
  // Design Decision: Balance speed vs API rate limits
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(emails.length / BATCH_SIZE);
    
    console.log(`   Processing batch ${batchNumber}/${totalBatches}...`);

    const batchPromises = batch.map(email => parseTransactionEmail(email));
    const batchResults = await Promise.all(batchPromises);

    // Process results
    batchResults.forEach(result => {
      if (result.success && result.is_transaction) {
        results.all_transactions.push(...result.transactions);
        results.total_transactions += result.count;
      } else if (result.success && !result.is_transaction) {
        results.non_transaction_emails.push(result.email_id);
      } else {
        results.failed.push({
          email_id: result.email_id,
          error: result.error
        });
      }
    });

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < emails.length) {
      await sleep(200); // 200ms delay
    }
  }

  results.processing_time = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`✅ Batch processing complete:`);
  console.log(`   - Total emails: ${results.total_emails}`);
  console.log(`   - Transactions found: ${results.total_transactions}`);
  console.log(`   - Non-transaction emails: ${results.non_transaction_emails.length}`);
  console.log(`   - Failed: ${results.failed.length}`);
  console.log(`   - Time: ${results.processing_time}s`);

  return results;
}

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Extract JSON from AI response
 * Design Decision: AI sometimes adds markdown, we strip it
 */
function extractJSON(text) {
  try {
    // Remove markdown code blocks
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```\n?/g, '');
    }

    return JSON.parse(cleaned);
  } catch (error) {
    console.error('❌ Failed to parse JSON from AI response:', error);
    console.error('Response was:', text);
    return null;
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

// ====================================
// EXPORTS
// ====================================

module.exports = {
  parseTransactionEmail,
  parseMultipleEmails,
  testClaudeConnection,
  // Export utilities for testing
  cleanMerchantName,
  convertToCurrency,
  validateTransaction
};