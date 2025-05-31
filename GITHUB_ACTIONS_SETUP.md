# GitHub Actions Setup for Shopify Order Processing

This document explains how to set up the free GitHub Actions approach for processing Shopify orders.

## Overview

This approach uses GitHub Actions to process orders triggered by repository dispatch events. It's completely free and doesn't require any external hosting platforms.

## Setup Steps

### 1. Set Repository Secrets

In your GitHub repository, go to Settings → Secrets and Variables → Actions, and add these secrets:

- `SHOPIFY_SHOP_DOMAIN`: your-store.myshopify.com
- `SHOPIFY_ACCESS_TOKEN`: shpat_your_access_token_here
- `USA_LOCATION_ID`: your_usa_location_id

### 2. Deploy Webhook Forwarder (Vercel - Free)

Create a simple Vercel function to forward webhooks to GitHub:

```javascript
// api/webhook.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const order = req.body;
  
  // Forward to GitHub repository dispatch
  const response = await fetch(`https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event_type: 'order_created',
      client_payload: { order }
    })
  });

  res.status(200).json({ success: true });
}
```

### 3. Configure Shopify Webhook

Set your Shopify webhook URL to: `https://your-vercel-app.vercel.app/api/webhook`

### 4. Test the Setup

Create a test order in your Shopify store and watch the GitHub Actions tab to see the workflow run.

## How It Works

1. New order created in Shopify
2. Shopify sends webhook to Vercel function
3. Vercel function triggers GitHub repository dispatch
4. GitHub Actions workflow runs `process-single-order.js`
5. Script analyzes order and consolidates locations if needed

## Benefits

- ✅ Completely free
- ✅ No external hosting needed
- ✅ Automatic scaling
- ✅ Full GitHub integration
- ✅ Detailed logs in GitHub Actions

## Files Created

- `.github/workflows/process-order.yml` - GitHub Actions workflow
- `scripts/process-single-order.js` - Order processing script
- `GITHUB_ACTIONS_SETUP.md` - This setup guide

## Monitoring

Check the GitHub Actions tab in your repository to see workflow runs and debug any issues. 