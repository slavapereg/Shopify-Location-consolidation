# 🚀 Complete GitHub Deployment Guide

## 📋 Checklist: What You Need

- [ ] GitHub account
- [ ] Shopify store with admin access
- [ ] Your Shopify credentials (already have these ✅)
- [ ] 15-20 minutes

---

## 🎯 Step-by-Step Deployment

### Step 1: Create GitHub Repository

1. **Go to GitHub**: https://github.com
2. **Click "New repository"** (green button)
3. **Repository name**: `shopify-location-consolidation`
4. **Description**: `Automatic Shopify order location consolidation`
5. **Visibility**: ⚠️ **PRIVATE** (important - contains credentials!)
6. **Initialize**: ✅ Add a README file
7. **Click "Create repository"**

### Step 2: Push Your Code to GitHub

Open Terminal/Command Prompt in your project folder:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit files
git commit -m "Initial commit: Shopify location consolidation app"

# Set main branch
git branch -M main

# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/shopify-location-consolidation.git

# Push to GitHub
git push -u origin main
```

**If you get authentication errors:**
- Use personal access token instead of password
- Or use GitHub CLI: `gh auth login`

### Step 3: Set Up GitHub Secrets

1. **Go to your repository** on GitHub
2. **Click "Settings"** tab
3. **Click "Secrets and variables"** → **"Actions"**
4. **Click "New repository secret"**

**Add these secrets one by one:**

| Secret Name | Value | Your Value |
|-------------|-------|------------|
| `SHOPIFY_SHOP_DOMAIN` | Your shop domain | `your-shop.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Your access token | `shpat_your_access_token_here` |
| `SHOPIFY_API_KEY` | Your API key | `your_api_key_here` |
| `SHOPIFY_API_SECRET` | Your API secret | `your_api_secret_here` |
| `USA_LOCATION_ID` | Your USA location ID | `your_location_id_here` |
| `WEBHOOK_SECRET` | Generate random string | `your_webhook_secret_123` |
| `PORT` | Port number | `3000` |

### Step 4: Choose Your Deployment Platform

**Recommended: Railway (Easiest)**

#### Option A: Railway Deployment (RECOMMENDED)

1. **Sign up**: Go to https://railway.app
2. **Sign up with GitHub** (easiest)
3. **Create new project**
4. **Connect GitHub repo**: Select your `shopify-location-consolidation` repo
5. **Railway auto-detects** Node.js and deploys!
6. **Get your Railway token**:
   - Go to Account Settings
   - Generate new token
   - Copy the token
7. **Add Railway secrets to GitHub**:
   - `RAILWAY_TOKEN`: your_railway_token_here
   - `DEPLOY_TARGET`: `railway`

#### Option B: Heroku Deployment

1. **Sign up**: Go to https://heroku.com
2. **Create new app**: Name it `your-shopify-consolidation-app`
3. **Get Heroku API key**:
   - Go to Account Settings
   - Reveal API Key
   - Copy it
4. **Add Heroku secrets to GitHub**:
   - `HEROKU_API_KEY`: your_heroku_api_key
   - `HEROKU_APP_NAME`: your-shopify-consolidation-app
   - `HEROKU_EMAIL`: your_email@example.com
   - `DEPLOY_TARGET`: `heroku`

#### Option C: DigitalOcean App Platform

1. **Sign up**: Go to https://digitalocean.com
2. **Go to App Platform**
3. **Create App**
4. **Connect GitHub repo**
5. **Get DO token**:
   - Go to API → Personal Access Tokens
   - Generate new token
6. **Add DO secrets to GitHub**:
   - `DO_TOKEN`: your_do_token
   - `DO_APP_NAME`: your_app_name
   - `DEPLOY_TARGET`: `digitalocean`

### Step 5: Deploy!

1. **Push to main branch**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **Watch GitHub Actions**:
   - Go to your repo → "Actions" tab
   - See the deployment in progress
   - Wait for ✅ green checkmark

3. **Get your app URL**:
   - **Railway**: Check your project dashboard
   - **Heroku**: `https://your-app-name.herokuapp.com`
   - **DigitalOcean**: Check App Platform dashboard

### Step 6: Configure Shopify Webhook

1. **Go to Shopify Admin**
2. **Settings** → **Notifications**
3. **Scroll down to "Webhooks"**
4. **Click "Create webhook"**
5. **Configure**:
   - **Event**: `Order creation`
   - **Format**: `JSON`
   - **URL**: `https://your-app-url.com/webhooks/orders/create`
   - **API Version**: `2023-10`
6. **Click "Save"**

### Step 7: Test Your Deployment

1. **Check app health**:
   ```bash
   curl https://your-app-url.com/health
   ```

2. **Create test order in Shopify**:
   - Add items to cart
   - Complete checkout
   - Wait 1 minute

3. **Check logs**:
   - **Railway**: Project dashboard → Logs
   - **Heroku**: `heroku logs --tail -a your-app-name`
   - **DigitalOcean**: App dashboard → Runtime logs

---

## 🎉 Success Indicators

You'll know it's working when you see:

✅ **GitHub Actions**: Green checkmark on deployment
✅ **App Health**: `/health` endpoint returns 200
✅ **Webhook**: Shopify shows webhook as "Delivered"
✅ **Logs**: App processes orders after 1 minute
✅ **Consolidation**: Orders with mixed locations get consolidated

---

## 🛠️ Troubleshooting

### GitHub Actions Fails

**Check**: Actions tab for error details
**Fix**: Verify all secrets are set correctly

### App Won't Start

**Check**: Deployment logs
**Fix**: Ensure all environment variables are set

### Webhook Not Working

**Check**: Shopify webhook delivery status
**Fix**: Verify webhook URL is correct and app is accessible

### No Consolidation Happening

**Check**: App logs for processing messages
**Fix**: Verify location IDs and API credentials

---

## 📞 Need Help?

1. **Check the logs first** - they usually show the exact problem
2. **Verify all secrets** - wrong credentials cause most issues  
3. **Test webhook manually** - use tools like ngrok for local testing
4. **Check Shopify webhook delivery** - see if webhooks are reaching your app

---

## 🎯 Your Specific Configuration

**Your Store**: chef-works-japan.myshopify.com
**Your USA Location**: 67642458351
**Your Current Orders**: 81015045, 81015046, 81015047

**Expected Behavior**:
- Order 81015046: ✅ No action (already in USA)
- New mixed orders: 🔄 Consolidate to USA
- New same-location orders: ✅ No action

---

## 🚀 You're Ready!

Follow these steps exactly, and your Shopify location consolidation will be running automatically on GitHub within 20 minutes! 

After deployment, every new order will be automatically processed 1 minute after creation. 🎉 