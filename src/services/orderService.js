const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/config');

class OrderService {
  constructor() {
    this.baseURL = `https://${config.shopify.shopDomain}/admin/api/2023-10/graphql.json`;
    this.headers = {
      'X-Shopify-Access-Token': config.shopify.accessToken,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Main method to process order location consolidation (1 minute after order creation)
   */
  async processOrderLocationConsolidation(orderId) {
    logger.logOrderProcessing(orderId, 'consolidation_started');

    try {
      // 1. Fetch order with fulfillment orders (assigned locations)
      const orderData = await this.fetchOrderWithFulfillmentOrders(orderId);
      
      if (!orderData) {
        throw new Error(`Order ${orderId} not found`);
      }

      const { order, fulfillmentOrders } = orderData;

      // 2. Analyze assigned locations in fulfillment orders
      const locationAnalysis = this.analyzeFulfillmentOrderLocations(fulfillmentOrders);
      
      logger.logOrderProcessing(orderId, 'location_analysis', {
        uniqueLocations: locationAnalysis.uniqueLocations.length,
        totalFulfillmentOrders: fulfillmentOrders.length,
        needsConsolidation: locationAnalysis.needsConsolidation
      });

      // 3. If all items are assigned to the same location, do nothing
      if (!locationAnalysis.needsConsolidation) {
        const sameLocationName = locationAnalysis.allAssignedToUSA ? 'USA' : 'same location';
        
        logger.logOrderProcessing(orderId, 'no_consolidation_needed', {
          reason: 'all_items_assigned_to_same_location',
          location: locationAnalysis.uniqueLocations[0],
          isUSALocation: locationAnalysis.allAssignedToUSA
        });
        
        return {
          success: true,
          action: 'no_change_needed',
          reason: `All line items already assigned to ${sameLocationName} - no split shipment needed`
        };
      }

      // 4. Check inventory availability at USA location (optional)
      const inventoryCheck = await this.checkInventoryAvailability(fulfillmentOrders);
      
      if (!inventoryCheck.allAvailable) {
        logger.logOrderProcessing(orderId, 'insufficient_inventory', {
          unavailableItems: inventoryCheck.unavailableItems
        });
        
        // You can decide whether to proceed or abort here
        // For now, we'll log the warning but proceed
      }

      // 5. Consolidate fulfillment orders to USA location
      const consolidationResult = await this.consolidateFulfillmentOrdersToUSA(order, fulfillmentOrders);

      logger.logLocationChange(
        orderId,
        fulfillmentOrders,
        locationAnalysis.uniqueLocations,
        config.locations.usaLocationId
      );

      return {
        success: true,
        action: 'consolidated',
        originalLocations: locationAnalysis.uniqueLocations,
        newLocation: config.locations.usaLocationId,
        fulfillmentOrdersProcessed: fulfillmentOrders.length,
        ...consolidationResult
      };

    } catch (error) {
      logger.logError(error, {
        context: 'order_consolidation',
        orderId
      });
      throw error;
    }
  }

  /**
   * Fetch order data with fulfillment orders (assigned locations)
   */
  async fetchOrderWithFulfillmentOrders(orderId) {
    const query = `
      query getOrderWithFulfillmentOrders($id: ID!) {
        order(id: $id) {
          id
          name
          displayFinancialStatus
          displayFulfillmentStatus
          fulfillmentOrders(first: 100) {
            edges {
              node {
                id
                status
                assignedLocation {
                  id
                  name
                }
                lineItems(first: 100) {
                  edges {
                    node {
                      id
                      quantity
                      lineItem {
                        id
                        name
                        quantity
                      }
                    }
                  }
                }
              }
            }
          }
          lineItems(first: 100) {
            edges {
              node {
                id
                name
                quantity
              }
            }
          }
        }
      }
    `;

    const variables = {
      id: `gid://shopify/Order/${orderId}`
    };

    try {
      const response = await axios.post(this.baseURL, {
        query,
        variables
      }, { headers: this.headers });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      const order = response.data.data.order;
      
      if (!order) {
        return null;
      }

      // Extract fulfillment orders with their assigned locations
      const fulfillmentOrders = order.fulfillmentOrders.edges.map(edge => edge.node);

      return {
        order,
        fulfillmentOrders
      };

    } catch (error) {
      logger.logError(error, {
        context: 'fetch_order_fulfillment_orders',
        orderId
      });
      throw error;
    }
  }

  /**
   * Analyze fulfillment order locations to determine if consolidation is needed
   */
  analyzeFulfillmentOrderLocations(fulfillmentOrders) {
    const locationIds = new Set();
    
    fulfillmentOrders.forEach(fulfillmentOrder => {
      if (fulfillmentOrder.assignedLocation?.id) {
        // Extract the location ID from the GraphQL ID
        const locationId = fulfillmentOrder.assignedLocation.id.split('/').pop();
        locationIds.add(locationId);
      }
    });

    const uniqueLocations = Array.from(locationIds);
    const usaLocationId = config.locations.usaLocationId;
    
    // CORRECTED LOGIC: Only consolidate if items are in MIXED locations
    // If all items are in the same location (even if not USA), no action needed
    const needsConsolidation = uniqueLocations.length > 1;

    return {
      uniqueLocations,
      needsConsolidation,
      allAssignedToUSA: uniqueLocations.length === 1 && uniqueLocations[0] === usaLocationId,
      allAssignedToSameLocation: uniqueLocations.length === 1
    };
  }

  /**
   * Check inventory availability at USA location
   */
  async checkInventoryAvailability(fulfillmentOrders) {
    // This is optional - implement based on your needs
    // For now, we'll assume inventory is available
    
    const unavailableItems = [];
    
    // TODO: Implement actual inventory check using GraphQL
    // Query inventory levels for each variant at the USA location
    
    return {
      allAvailable: unavailableItems.length === 0,
      unavailableItems
    };
  }

  /**
   * Consolidate fulfillment orders to USA location
   */
  async consolidateFulfillmentOrdersToUSA(order, fulfillmentOrders) {
    const usaLocationId = config.locations.usaLocationId;
    
    try {
      // Step 1: Move all fulfillment orders to USA location
      const moveResults = [];
      
      for (const fulfillmentOrder of fulfillmentOrders) {
        const currentLocationId = fulfillmentOrder.assignedLocation?.id?.split('/').pop();
        
        if (currentLocationId !== usaLocationId) {
          try {
            const result = await this.moveFulfillmentOrder(fulfillmentOrder.id, usaLocationId);
            moveResults.push(result);
          } catch (error) {
            logger.logError(error, {
              context: 'move_fulfillment_order',
              fulfillmentOrderId: fulfillmentOrder.id,
              fromLocation: currentLocationId,
              toLocation: usaLocationId
            });
            // Continue with other fulfillment orders even if one fails
          }
        }
      }
      
      return {
        movedFulfillmentOrders: moveResults.length,
        consolidatedToLocation: usaLocationId
      };

    } catch (error) {
      logger.logError(error, {
        context: 'consolidate_fulfillment_orders',
        orderId: order.id
      });
      throw error;
    }
  }

  /**
   * Move a fulfillment order to a different location
   */
  async moveFulfillmentOrder(fulfillmentOrderId, newLocationId) {
    const mutation = `
      mutation fulfillmentOrderMove($id: ID!, $newLocationId: ID!) {
        fulfillmentOrderMove(id: $id, newLocationId: $newLocationId) {
          fulfillmentOrder {
            id
            status
            assignedLocation {
              id
              name
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
      newLocationId: `gid://shopify/Location/${newLocationId}`
    };

    const response = await axios.post(this.baseURL, {
      query: mutation,
      variables
    }, { headers: this.headers });

    if (response.data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
    }

    const result = response.data.data.fulfillmentOrderMove;
    
    if (result.userErrors && result.userErrors.length > 0) {
      throw new Error(`Fulfillment order move errors: ${JSON.stringify(result.userErrors)}`);
    }

    return {
      fulfillmentOrderId: result.fulfillmentOrder.id,
      newLocation: result.fulfillmentOrder.assignedLocation,
      status: result.fulfillmentOrder.status
    };
  }
}

module.exports = new OrderService(); 