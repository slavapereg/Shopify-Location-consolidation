const winston = require('winston');
const config = require('../config/config');

const logger = winston.createLogger({
  level: config.server.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'shopify-location-consolidation' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If we're not in production, also log to the console
if (config.server.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Utility methods for specific use cases
logger.logOrderProcessing = (orderId, action, details = {}) => {
  logger.info('Order processing', {
    orderId,
    action,
    ...details,
    timestamp: new Date().toISOString()
  });
};

logger.logLocationChange = (orderId, lineItems, originalLocations, newLocation) => {
  logger.info('Location consolidation completed', {
    orderId,
    lineItemCount: lineItems.length,
    originalLocations,
    newLocation,
    timestamp: new Date().toISOString()
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger; 