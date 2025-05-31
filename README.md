# Shopify Location Consolidation App

Automatically consolidates Shopify order line items to prevent split shipments across multiple locations. The app monitors new orders and consolidates items to the USA location when they're spread across different fulfillment locations.

## 🎯 Features

- **Automatic Order Monitoring**: Processes orders 1 minute after creation
- **Smart Consolidation Logic**: Only consolidates when items are in mixed locations
- **Webhook Integration**: Real-time order processing via Shopify webhooks
- **Comprehensive Logging**: Detailed logs for all consolidation activities
- **Error Handling**: Robust error handling with retry logic
- **Production Ready**: Full CI/CD pipeline with automated deployment

## 🏗️ Architecture

```
📦 Shopify Order Created
    ↓
🎣 Webhook Received (/webhooks/orders/create)
    ↓
⏰ Job Scheduled (1 minute delay)
    ↓
🔍 Fetch FulfillmentOrders & Check Locations
    ↓
❓ Mixed Locations?
    ├─ ✅ No → Log "No action needed"
    └─ 🔄 Yes → Consolidate to USA location
```

## 🚀 Quick Deploy to GitHub

### Option 1: Heroku (Recommended for beginners)
### Option 2: Railway (Modern platform)
### Option 3: DigitalOcean App Platform (Scalable)

---

## 📋 Prerequisites

- Shopify Store with Admin API access
- GitHub account
- Deployment platform account (Heroku/Railway/DigitalOcean)

## 🔧 Environment Variables

Required environment variables for production:

```bash
NODE_ENV=production
PORT=3000
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_access_token_here
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
USA_LOCATION_ID=your_location_id_here
WEBHOOK_SECRET=your_generated_webhook_secret
```

## 🚀 GitHub Deployment Guide

### Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it: `shopify-location-consolidation`
3. Make it **Private** (contains sensitive credentials)
4. Initialize with README

### Step 2: Push Code to GitHub

```bash
# In your project directory
git init
git add .
git commit -m "Initial commit: Shopify location consolidation app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/shopify-location-consolidation.git
git push -u origin main
```

### Step 3: Set Up GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions

Add these secrets:

**Required for all platforms:**
```
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_access_token_here
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
USA_LOCATION_ID=your_location_id_here
WEBHOOK_SECRET=your_generated_webhook_secret
PORT=3000
```

**For Heroku deployment:**
```
HEROKU_API_KEY=your_heroku_api_key
HEROKU_APP_NAME=your-app-name
HEROKU_EMAIL=your_email@example.com
DEPLOY_TARGET=heroku
```

**For Railway deployment:**
```
RAILWAY_TOKEN=your_railway_token
DEPLOY_TARGET=railway
```

**For DigitalOcean deployment:**
```
DO_TOKEN=your_do_token
DO_APP_NAME=your_app_name
DEPLOY_TARGET=digitalocean
```

### Step 4: Choose Deployment Platform

#### Option A: Heroku Deployment

1. Create [Heroku account](https://heroku.com)
2. Create new app: `your-shopify-consolidation-app`
3. Get API key from Account Settings
4. Add GitHub secrets (see above)
5. Push to main branch → Auto deploy!

#### Option B: Railway Deployment

1. Create [Railway account](https://railway.app)
2. Connect GitHub repository
3. Get Railway token from settings
4. Add GitHub secrets (see above)
5. Push to main branch → Auto deploy!

#### Option C: DigitalOcean App Platform

1. Create [DigitalOcean account](https://digitalocean.com)
2. Go to App Platform
3. Connect GitHub repository
4. Use provided `app.yaml` configuration
5. Add environment variables
6. Deploy!

### Step 5: Configure Shopify Webhook

After deployment, configure Shopify webhook:

1. Go to Shopify Admin → Settings → Notifications
2. Create webhook:
   - **Event**: Order creation
   - **Format**: JSON
   - **URL**: `https://your-app-url.com/webhooks/orders/create`
   - **API Version**: 2023-10

### Step 6: Test Deployment

1. Create a test order in Shopify
2. Check app logs for processing
3. Verify consolidation behavior

## 📊 Monitoring & Logs

### Production Logs
```bash
# Heroku
heroku logs --tail -a your-app-name

# Railway
railway logs

# DigitalOcean
# Use DigitalOcean dashboard
```

### Log Structure
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "orderId": "81015047",
  "action": "consolidation_started",
  "details": {
    "uniqueLocations": 2,
    "needsConsolidation": true
  }
}
```

## 🔄 CI/CD Pipeline

The app includes automated:
- ✅ **Testing**: Jest test suite
- ✅ **Linting**: ESLint code quality
- ✅ **Building**: Production optimization
- ✅ **Deployment**: Automatic deployment on merge to main

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

## 📁 Project Structure

```
shopify-location-consolidation/
├── .github/workflows/       # GitHub Actions CI/CD
├── src/
│   ├── config/             # Configuration files
│   ├── controllers/        # Route controllers
│   ├── services/           # Business logic
│   ├── utils/              # Utility functions
│   ├── workers/            # Background job processing
│   └── tests/              # Test files
├── logs/                   # Application logs
├── Dockerfile              # Container configuration
├── Procfile               # Heroku process file
├── railway.json           # Railway configuration
├── app.yaml               # DigitalOcean configuration
└── package.json           # Dependencies and scripts
```

## 🔒 Security

- ✅ Webhook signature verification
- ✅ Environment variable protection
- ✅ Helmet.js security headers
- ✅ CORS configuration
- ✅ Input validation

## 📈 Performance

- ⚡ Efficient location checking (O(1) lookup)
- 🔄 Smart consolidation (only when needed)
- 📊 Comprehensive logging
- 🛡️ Error handling with retries

## 🆘 Troubleshooting

### Common Issues

1. **Webhook not receiving orders**
   - Check webhook URL in Shopify
   - Verify app is running and accessible
   - Check webhook secret matches

2. **App not consolidating orders**
   - Check logs for error messages
   - Verify location IDs are correct
   - Ensure API credentials are valid

3. **Deployment failures**
   - Check GitHub Actions logs
   - Verify all secrets are set
   - Check environment variable names

### Support

- 📖 Check logs first: `npm run logs`
- 🐛 Create GitHub issue for bugs
- 💬 Review Shopify API documentation

## 📄 License

MIT License - see LICENSE file for details

---

## 🎉 Ready to Deploy!

Follow the steps above to get your Shopify location consolidation app running automatically on GitHub! 🚀 