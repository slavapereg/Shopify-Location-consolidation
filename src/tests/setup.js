// Test setup configuration
process.env.NODE_ENV = 'test';
process.env.SHOPIFY_SHOP_DOMAIN = 'test.myshopify.com';
process.env.SHOPIFY_ACCESS_TOKEN = 'test_token';
process.env.USA_LOCATION_ID = '123456789';
process.env.WEBHOOK_SECRET = 'test_secret';

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}; 