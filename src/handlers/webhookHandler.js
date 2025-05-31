const crypto = require('crypto');
const logger = require('../utils/logger');
const jobQueue = require('../services/jobQueue');
const config = require('../config/config');

class WebhookHandler {
  /**
   * Verify webhook signature to ensure it's from Shopify
   */
  verifyWebhook(body, signature) {
    if (!config.webhook.secret) {
      logger.warn('Webhook secret not configured - skipping verification');
      return true;
    }

    const hmac = crypto.createHmac('sha256', config.webhook.secret);
    hmac.update(body);
    const calculatedSignature = hmac.digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(calculatedSignature, 'base64')
    );
  }

  /**
   * Handle order creation webhook
   */
  async handleOrderCreate(req, res) {
    try {
      const signature = req.get('X-Shopify-Hmac-Sha256');
      const body = JSON.stringify(req.body);

      // Verify webhook authenticity
      if (!this.verifyWebhook(body, signature)) {
        logger.warn('Invalid webhook signature received');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const order = req.body;
      
      if (!order || !order.id) {
        logger.warn('Invalid order data received in webhook');
        return res.status(400).json({ error: 'Invalid order data' });
      }

      logger.logOrderProcessing(order.id, 'webhook_received', {
        orderNumber: order.order_number,
        lineItemCount: order.line_items?.length || 0,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status
      });

      // Schedule the order for processing after the configured delay
      const delayMs = config.processing.delayMinutes * 60 * 1000;
      const processAt = new Date(Date.now() + delayMs);

      await jobQueue.scheduleOrderProcessing({
        orderId: order.id,
        orderNumber: order.order_number,
        processAt
      });

      logger.logOrderProcessing(order.id, 'scheduled_for_processing', {
        processAt: processAt.toISOString(),
        delayMinutes: config.processing.delayMinutes
      });

      res.status(200).json({ 
        success: true, 
        message: 'Order scheduled for processing',
        processAt: processAt.toISOString()
      });

    } catch (error) {
      logger.logError(error, { 
        context: 'webhook_order_create',
        orderId: req.body?.id 
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new WebhookHandler(); 