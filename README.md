# Shopify Webhook Forwarder

This Vercel function receives Shopify webhooks and forwards them to GitHub Actions.

## Deployment Steps

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Create GitHub Personal Access Token
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select these scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
4. Copy the token

### 4. Deploy to Vercel
```bash
# From this directory
vercel

# When prompted:
# - Link to existing project? N
# - Project name: shopify-webhook-forwarder (or your choice)
# - Directory: ./ (current directory)
```

### 5. Set Environment Variable
```bash
vercel env add GITHUB_TOKEN
```
When prompted, paste your GitHub token from step 3.

### 6. Deploy Production Version
```bash
vercel --prod
```

### 7. Get Your Webhook URL
After deployment, Vercel will give you a URL like:
`https://shopify-webhook-forwarder-xxxxx.vercel.app`

Your webhook endpoint will be:
`https://shopify-webhook-forwarder-xxxxx.vercel.app/api/webhook`

## Configure Shopify Webhook

Use the webhook URL above in your Shopify webhook configuration:
- Event: Order creation
- URL: `https://your-vercel-app.vercel.app/api/webhook`
- Format: JSON

## Monitoring

- Check Vercel function logs: `vercel logs`
- Check GitHub Actions: Repository → Actions tab 