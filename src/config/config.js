const config = {
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret: process.env.SHOPIFY_API_SECRET,
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  },
  
  locations: {
    usaLocationId: process.env.USA_LOCATION_ID,
  },
  
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    hostName: process.env.HOST_NAME || 'localhost',
  },
  
  webhook: {
    secret: process.env.WEBHOOK_SECRET,
  },
  
  processing: {
    delayMinutes: parseInt(process.env.PROCESSING_DELAY_MINUTES) || 1,
  },
};

// Validate required configuration
const requiredFields = [
  'shopify.apiKey',
  'shopify.apiSecret', 
  'shopify.shopDomain',
  'shopify.accessToken',
  'locations.usaLocationId'
];

function validateConfig() {
  const missing = [];
  
  requiredFields.forEach(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], config);
    if (!value) {
      missing.push(field);
    }
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

// Only validate in production or when explicitly required
if (process.env.NODE_ENV === 'production' || process.env.VALIDATE_CONFIG === 'true') {
  validateConfig();
}

module.exports = config; 