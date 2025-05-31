const request = require('supertest');
const app = require('../../app');

describe('Shopify Location Consolidation App', () => {
  test('Health check endpoint should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('service', 'shopify-location-consolidation');
  });

  test('Root endpoint should return app info', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);
    
    expect(response.body).toHaveProperty('app', 'Shopify Location Consolidation');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('status', 'running');
  });

  test('Webhook endpoint should exist', async () => {
    // Test that webhook endpoint exists (should return 401/403 without proper auth)
    const response = await request(app)
      .post('/webhooks/orders/create')
      .send({});
    
    // Should not return 404 (endpoint exists)
    expect(response.status).not.toBe(404);
  });

  test('Invalid route should return 404', async () => {
    const response = await request(app)
      .get('/invalid-route')
      .expect(404);
    
    expect(response.body).toHaveProperty('error', 'Route not found');
  });
});

describe('Environment Configuration', () => {
  test('Required environment variables should be set', () => {
    const requiredEnvVars = [
      'SHOPIFY_SHOP_DOMAIN',
      'SHOPIFY_ACCESS_TOKEN',
      'USA_LOCATION_ID'
    ];

    requiredEnvVars.forEach(envVar => {
      if (process.env.NODE_ENV !== 'test') {
        expect(process.env[envVar]).toBeDefined();
      }
    });
  });
}); 