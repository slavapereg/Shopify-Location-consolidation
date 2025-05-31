require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const { shopifyApi } = require('@shopify/shopify-api');
const { ApiVersion } = require('@shopify/shopify-api');

const logger = require('./utils/logger');
const webhookHandler = require('./handlers/webhookHandler');
const jobProcessor = require('./services/jobProcessor');
const config = require('./config/config');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Parse JSON bodies
app.use(bodyParser.json({ limit: '1mb' }));

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: config.shopify.apiKey,
  apiSecretKey: config.shopify.apiSecret,
  scopes: ['read_orders', 'write_orders', 'read_locations', 'read_inventory'],
  hostName: config.server.hostName,
  apiVersion: ApiVersion.October23,
  isEmbeddedApp: false,
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Webhook endpoints
app.post('/webhooks/orders/create', webhookHandler.handleOrderCreate);

// Start job processor
jobProcessor.start();

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`🚀 Shopify Location Consolidation App running on port ${PORT}`);
  logger.info(`Environment: ${config.server.nodeEnv}`);
});

module.exports = app; 