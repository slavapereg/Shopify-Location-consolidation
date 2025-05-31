#!/usr/bin/env node

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

/**
 * Analyze fulfillment order locations
 * @param {Array} fulfillmentOrders - Array of fulfillment orders
 * @returns {Object} Analysis result
 */
function analyzeFulfillmentOrderLocations(fulfillmentOrders) {
  console.log(`📦 Analyzing ${fulfillmentOrders.length} fulfillment orders...`);
  
  const locationCounts = {};
  const uniqueLocations = new Set();
  
  fulfillmentOrders.forEach(fo => {
    const locationId = fo.assignedLocation?.location?.id;
    if (locationId) {
      locationCounts[locationId] = (locationCounts[locationId] || 0) + 1;
      uniqueLocations.add(locationId);
    }
  });
  
  const needsConsolidation = uniqueLocations.size > 1;
  
  console.log(`🏢 Items spread across ${uniqueLocations.size} locations`);
  if (needsConsolidation) {
    console.log('⚠️  Multiple locations detected - consolidation needed');
    Object.entries(locationCounts).forEach(([locationId, count]) => {
      console.log(`   Location ${locationId}: ${count} fulfillment orders`);
    });
  } else {
    console.log('✅ All items in same location - no action needed');
  }
  
  return {
    uniqueLocations: Array.from(uniqueLocations),
    locationCounts,
    needsConsolidation,
    totalOrders: fulfillmentOrders.length
  };
}

/**
 * Move fulfillment orders to USA location
 * @param {Array} fulfillmentOrderIds - IDs of fulfillment orders to move
 */
async function moveFulfillmentOrdersToUSA(fulfillmentOrderIds) {
  console.log(`🚚 Moving ${fulfillmentOrderIds.length} fulfillment orders to USA location...`);
  
  for (const fulfillmentOrderId of fulfillmentOrderIds) {
    try {
      const mutation = `
        mutation fulfillmentOrderMove($id: ID!, $newLocationId: ID!) {
          fulfillmentOrderMove(id: $id, newLocationId: $newLocationId) {
            movedFulfillmentOrder {
              id
              assignedLocation {
                location {
                  id
                  name
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      const variables = {
        id: fulfillmentOrderId,
        newLocationId: `gid://shopify/Location/${config.usaLocationId}`
      };
      
      console.log(`📍 Moving fulfillment order ${fulfillmentOrderId}...`);
      const response = await shopifyGraphQL(mutation, variables);
      
      if (response.fulfillmentOrderMove.userErrors.length > 0) {
        console.error(`❌ Failed to move fulfillment order ${fulfillmentOrderId}:`);
        response.fulfillmentOrderMove.userErrors.forEach(error => {
          console.error(`   ${error.field}: ${error.message}`);
        });
      } else {
        const moved = response.fulfillmentOrderMove.movedFulfillmentOrder;
        console.log(`✅ Successfully moved to ${moved.assignedLocation.location.name}`);
      }
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Error moving fulfillment order ${fulfillmentOrderId}:`, error.message);
    }
  }
}

/**
 * Process a single order for location consolidation
 * @param {Object} order - Shopify order object
 */
async function processOrder(order) {
  console.log(`\n🔄 Processing order ${order.id || order.order_number}...`);
  console.log(`💰 Order total: ${order.total_price} ${order.currency}`);
  console.log(`📦 ${order.line_items?.length || 0} line items`);
  
  try {
    // Fetch fulfillment orders for this order
    const query = `
      query getFulfillmentOrders($orderId: ID!) {
        order(id: $orderId) {
          id
          name
          fulfillmentOrders(first: 10) {
            nodes {
              id
              status
              assignedLocation {
                location {
                  id
                  name
                }
              }
              lineItems(first: 10) {
                nodes {
                  id
                  quantity
                  variant {
                    id
                    title
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const orderId = order.admin_graphql_api_id || `gid://shopify/Order/${order.id}`;
    const variables = { orderId };
    
    console.log(`🔍 Fetching fulfillment orders for order ${orderId}...`);
    const response = await shopifyGraphQL(query, variables);
    
    if (!response.order) {
      console.error('❌ Order not found');
      return;
    }
    
    const fulfillmentOrders = response.order.fulfillmentOrders.nodes;
    console.log(`📦 Found ${fulfillmentOrders.length} fulfillment orders`);
    
    if (fulfillmentOrders.length === 0) {
      console.log('ℹ️  No fulfillment orders found - order may not be ready for fulfillment');
      return;
    }
    
    // Analyze locations
    const analysis = analyzeFulfillmentOrderLocations(fulfillmentOrders);
    
    if (!analysis.needsConsolidation) {
      console.log('✅ Order processing complete - no consolidation needed');
      return;
    }
    
    // Filter fulfillment orders that need to be moved (not already in USA)
    const fulfillmentOrdersToMove = fulfillmentOrders.filter(fo => {
      const locationId = fo.assignedLocation?.location?.id;
      return locationId && locationId !== `gid://shopify/Location/${config.usaLocationId}`;
    });
    
    if (fulfillmentOrdersToMove.length === 0) {
      console.log('ℹ️  All fulfillment orders already in USA location');
      return;
    }
    
    console.log(`🎯 ${fulfillmentOrdersToMove.length} fulfillment orders need to be moved to USA`);
    
    // Move fulfillment orders to USA location
    const fulfillmentOrderIds = fulfillmentOrdersToMove.map(fo => fo.id);
    await moveFulfillmentOrdersToUSA(fulfillmentOrderIds);
    
    console.log('✅ Order processing complete');
    
  } catch (error) {
    console.error('❌ Error processing order:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Shopify Order Location Consolidation - GitHub Actions');
  console.log('=' .repeat(60));
  
  // Get order data from command line argument
  const orderJson = process.argv[2];
  if (!orderJson) {
    console.error('❌ No order data provided');
    console.error('Usage: node process-single-order.js \'{"order": "data"}\'');
    process.exit(1);
  }
  
  let order;
  try {
    order = JSON.parse(orderJson);
  } catch (error) {
    console.error('❌ Invalid JSON order data:', error.message);
    process.exit(1);
  }
  
  await processOrder(order);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { processOrder, analyzeFulfillmentOrderLocations }; 