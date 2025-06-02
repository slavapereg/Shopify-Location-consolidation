#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration from environment variables
const config = {
  shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  usaLocationId: process.env.USA_LOCATION_ID,
  processedOrdersFile: path.join(__dirname, 'processed-orders.json')
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
  console.log('🔍 Making GraphQL request with variables:', JSON.stringify(variables, null, 2));
  
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
    const errorText = await response.text();
    console.error('❌ HTTP error response:', errorText);
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    console.error('❌ GraphQL errors:', JSON.stringify(result.errors, null, 2));
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
                  remainingQuantity
                  sku
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

/**
 * Find order by name (order number) and return its internal ID
 * @param {string} orderName - The order name/number (e.g., '81015056')
 * @returns {Promise<string|null>} The internal Shopify order ID (gid://shopify/Order/...) or null if not found
 */
async function getOrderIdByName(orderName) {
  const query = `
    query getOrderIdByName($name: String!) {
      orders(first: 1, query: $name) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;
  const variables = { name: orderName };
  const data = await shopifyGraphQL(query, variables);
  const orderEdge = data.orders.edges[0];
  return orderEdge ? orderEdge.node.id : null;
}

/**
 * Fetch unfulfilled orders from Shopify
 * @returns {Promise<Array>} Array of unfulfilled orders
 */
async function fetchUnfulfilledOrders() {
  const query = `
    query getUnfulfilledOrders {
      orders(first: 50, query: "fulfillment_status:unfulfilled created_at:>2025-05-27") {
        edges {
          node {
            id
            name
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            displayFulfillmentStatus
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
                    remainingQuantity
                    sku
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  console.log('🔍 Fetching unfulfilled orders created after May 27, 2025...');
  const data = await shopifyGraphQL(query);
  return data.orders.edges.map(edge => edge.node);
}

// Load processed orders from file
function loadProcessedOrders() {
  try {
    if (fs.existsSync(config.processedOrdersFile)) {
      const data = fs.readFileSync(config.processedOrdersFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ Error loading processed orders file:', error.message);
  }
  return { processedOrders: [], lastRun: null };
}

// Save processed orders to file
function saveProcessedOrders(processedOrders) {
  try {
    fs.writeFileSync(
      config.processedOrdersFile,
      JSON.stringify(processedOrders, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('❌ Error saving processed orders file:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Shopify Order Location Consolidation - Processing Unfulfilled Orders');
  console.log('=' .repeat(60));

  // Load previously processed orders
  const { processedOrders, lastRun } = loadProcessedOrders();
  const currentRun = new Date().toISOString();
  
  // Format timestamps for better readability
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  };

  console.log(`📊 Last run: ${formatDate(lastRun)}`);
  console.log(`📊 Current run: ${formatDate(currentRun)}`);
  console.log(`📊 Previously processed orders: ${processedOrders.length}`);

  // Collect report data
  const report = [];
  const newProcessedOrders = new Set(processedOrders);

  try {
    // Fetch all unfulfilled orders
    const orders = await fetchUnfulfilledOrders();
    console.log(`📦 Found ${orders.length} unfulfilled orders`);

    // Filter out already processed orders
    const newOrders = orders.filter(order => !processedOrders.includes(order.id));
    console.log(`🆕 Found ${newOrders.length} new orders to process`);

    // Process each new order
    for (const order of newOrders) {
      const orderReport = {
        orderNumber: order.name,
        total: order.totalPriceSet?.shopMoney?.amount,
        currency: order.totalPriceSet?.shopMoney?.currencyCode,
        fulfillmentOrders: order.fulfillmentOrders.nodes.length,
        needsConsolidation: false,
        moved: 0,
        alreadyInUSA: 0,
        errors: []
      };

      console.log(`\n🔄 Processing order ${order.name}...`);
      const totalPrice = order.totalPriceSet?.shopMoney?.amount;
      const currency = order.totalPriceSet?.shopMoney?.currencyCode;
      console.log(`💰 Order total: ${totalPrice} ${currency}`);
      
      const fulfillmentOrders = order.fulfillmentOrders.nodes;
      console.log(`📦 Found ${fulfillmentOrders.length} fulfillment orders`);

      if (fulfillmentOrders.length === 0) {
        console.log('ℹ️  No fulfillment orders found - skipping');
        orderReport.status = 'No fulfillment orders';
        report.push(orderReport);
        newProcessedOrders.add(order.id);
        continue;
      }

      // Analyze locations
      const analysis = analyzeFulfillmentOrderLocations(fulfillmentOrders);
      orderReport.needsConsolidation = analysis.needsConsolidation;
      
      if (!analysis.needsConsolidation) {
        console.log('✅ No consolidation needed - all items in same location');
        orderReport.status = 'No consolidation needed';
        report.push(orderReport);
        newProcessedOrders.add(order.id);
        continue;
      }

      // Filter fulfillment orders that need to be moved (not already in USA)
      const fulfillmentOrdersToMove = fulfillmentOrders.filter(fo => {
        const locationId = fo.assignedLocation?.location?.id;
        return locationId && locationId !== `gid://shopify/Location/${config.usaLocationId}`;
      });

      if (fulfillmentOrdersToMove.length === 0) {
        console.log('ℹ️  All fulfillment orders already in USA location');
        orderReport.status = 'All fulfillment orders already in USA location';
        orderReport.alreadyInUSA = fulfillmentOrders.length;
        report.push(orderReport);
        newProcessedOrders.add(order.id);
        continue;
      }

      console.log(`🎯 ${fulfillmentOrdersToMove.length} fulfillment orders need to be moved to USA`);
      orderReport.moved = 0;
      orderReport.status = 'Attempted move';
      
      // Move fulfillment orders to USA location
      for (const fo of fulfillmentOrdersToMove) {
        try {
          await moveFulfillmentOrdersToUSA([fo.id]);
          orderReport.moved += 1;
        } catch (err) {
          const msg = err.message || String(err);
          orderReport.errors.push({ fulfillmentOrderId: fo.id, error: msg });
        }
      }
      report.push(orderReport);
      newProcessedOrders.add(order.id);
    }

    // Save updated processed orders list
    saveProcessedOrders({
      processedOrders: Array.from(newProcessedOrders),
      lastRun: currentRun
    });

    // Print summary report
    console.log('\n==================== ORDER CONSOLIDATION REPORT ====================');
    report.forEach(r => {
      console.log(`Order: ${r.orderNumber} | Total: ${r.total} ${r.currency} | Fulfillment Orders: ${r.fulfillmentOrders}`);
      if (r.status) console.log(`  Status: ${r.status}`);
      if (r.needsConsolidation) console.log('  Needs consolidation: YES');
      if (r.moved) console.log(`  Fulfillment orders moved: ${r.moved}`);
      if (r.alreadyInUSA) console.log(`  Already in USA: ${r.alreadyInUSA}`);
      if (r.errors && r.errors.length > 0) {
        r.errors.forEach(e => {
          console.log(`  Error for fulfillment order ${e.fulfillmentOrderId}: ${e.error}`);
        });
      }
      console.log('-------------------------------------------------------------------');
    });
    console.log('====================================================================\n');
    console.log('✅ Finished processing all unfulfilled orders');

  } catch (error) {
    console.error('❌ Error processing orders:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { processOrder, analyzeFulfillmentOrderLocations }; 