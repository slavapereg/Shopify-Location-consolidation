#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import the order processing logic
const { processOrder } = require('./process-single-order');

// Configuration from environment variables
const config = {
  shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  usaLocationId: process.env.USA_LOCATION_ID
};

// Validate configuration
if (!config.shopDomain || !config.accessToken || !config.usaLocationId) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SHOPIFY_SHOP_DOMAIN, SHOPIFY_ACCESS_TOKEN, USA_LOCATION_ID');
  process.exit(1);
}

/**
 * Make a GraphQL request to Shopify Admin API
 * @param {string} query - GraphQL query/mutation
 * @param {Object} variables - GraphQL variables
 * @returns {Object} Response data
 */
async function shopifyGraphQL(query, variables = {}) {
  const response = await fetch(`https://${config.shopDomain}/admin/api/2023-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.accessToken,
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// File to store last check timestamp
const TIMESTAMP_FILE = path.join(__dirname, '../.last-check-timestamp');

/**
 * Get the last check timestamp
 * @returns {string} ISO timestamp
 */
function getLastCheckTimestamp() {
  try {
    if (fs.existsSync(TIMESTAMP_FILE)) {
      return fs.readFileSync(TIMESTAMP_FILE, 'utf8').trim();
    }
  } catch (error) {
    console.log('⚠️  Could not read last check timestamp, using 1 hour ago');
  }
  
  // Default to 1 hour ago if no timestamp exists
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return oneHourAgo.toISOString();
}

/**
 * Save the current timestamp
 * @param {string} timestamp - ISO timestamp
 */
function saveLastCheckTimestamp(timestamp) {
  try {
    fs.writeFileSync(TIMESTAMP_FILE, timestamp);
  } catch (error) {
    console.error('⚠️  Could not save timestamp:', error.message);
  }
}

/**
 * Fetch new orders since last check
 * @param {string} sinceTimestamp - ISO timestamp
 * @returns {Array} New orders
 */
async function fetchNewOrders(sinceTimestamp) {
  try {
    const query = `
      query getNewOrders($since: DateTime!) {
        orders(first: 50, query: "created_at:>$since", sortKey: CREATED_AT) {
          nodes {
            id
            name
            createdAt
            updatedAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            lineItems(first: 10) {
              nodes {
                id
                quantity
                title
                variant {
                  id
                  title
                }
              }
            }
            displayFulfillmentStatus
            displayFinancialStatus
          }
        }
      }
    `;
    
    const variables = { since: sinceTimestamp };
    
    console.log(`🔍 Checking for orders created after ${sinceTimestamp}...`);
    const response = await shopifyGraphQL(query, variables);
    
    return response.orders.nodes;
    
  } catch (error) {
    console.error('❌ Error fetching orders:', error.message);
    return [];
  }
}

/**
 * Check for new orders and process them
 */
async function checkNewOrders() {
  console.log('🚀 GitHub-Only Shopify Order Checker');
  console.log('=' .repeat(60));
  
  const currentTime = new Date().toISOString();
  const lastCheckTime = getLastCheckTimestamp();
  
  console.log(`⏰ Last check: ${lastCheckTime}`);
  console.log(`⏰ Current time: ${currentTime}`);
  
  // Fetch new orders
  const newOrders = await fetchNewOrders(lastCheckTime);
  
  console.log(`📦 Found ${newOrders.length} new orders to check`);
  
  if (newOrders.length === 0) {
    console.log('✅ No new orders to process');
    saveLastCheckTimestamp(currentTime);
    return;
  }
  
  // Process each new order
  for (const order of newOrders) {
    console.log(`\n📋 Processing order ${order.name}...`);
    console.log(`💰 ${order.totalPriceSet.shopMoney.amount} ${order.totalPriceSet.shopMoney.currencyCode}`);
    console.log(`📅 Created: ${order.createdAt}`);
    console.log(`📊 Status: ${order.displayFulfillmentStatus || 'UNFULFILLED'} / ${order.displayFinancialStatus}`);
    
    // Only process unfulfilled orders
    if (!order.displayFulfillmentStatus || order.displayFulfillmentStatus === 'UNFULFILLED') {
      try {
        // Convert GraphQL order format to REST API format for compatibility
        const restFormatOrder = {
          id: order.id.split('/').pop(),
          admin_graphql_api_id: order.id,
          order_number: order.name.replace('#', ''),
          total_price: order.totalPriceSet.shopMoney.amount,
          currency: order.totalPriceSet.shopMoney.currencyCode,
          line_items: order.lineItems.nodes.map(item => ({
            id: item.id.split('/').pop(),
            quantity: item.quantity,
            title: item.title,
            variant_id: item.variant?.id?.split('/').pop()
          })),
          created_at: order.createdAt,
          updated_at: order.updatedAt
        };
        
        await processOrder(restFormatOrder);
        console.log(`✅ Successfully processed order ${order.name}`);
        
      } catch (error) {
        console.error(`❌ Failed to process order ${order.name}:`, error.message);
      }
    } else {
      console.log(`⏭️  Skipping order ${order.name} - already ${order.displayFulfillmentStatus}`);
    }
    
    // Add delay between orders to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save the current timestamp for next run
  saveLastCheckTimestamp(currentTime);
  
  console.log(`\n✅ Completed checking ${newOrders.length} orders`);
  console.log(`⏰ Next check will look for orders after ${currentTime}`);
}

// Run if called directly
if (require.main === module) {
  checkNewOrders().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { checkNewOrders, fetchNewOrders }; 