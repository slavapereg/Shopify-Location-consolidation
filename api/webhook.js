export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('📞 Received webhook from Shopify');
  
  try {
    const order = req.body;
    
    // Log basic order info for debugging
    console.log(`📦 Order ${order.id || order.order_number}: ${order.total_price} ${order.currency}`);
    
    // Forward to GitHub repository dispatch
    const githubResponse = await fetch(`https://api.github.com/repos/slavapereg/Shopify-Location-consolidation/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Shopify-Webhook-Forwarder'
      },
      body: JSON.stringify({
        event_type: 'order_created',
        client_payload: { 
          order: order,
          timestamp: new Date().toISOString()
        }
      })
    });

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error(`❌ GitHub API error: ${githubResponse.status} - ${errorText}`);
      return res.status(500).json({ 
        error: 'Failed to trigger GitHub Actions',
        status: githubResponse.status 
      });
    }

    console.log('✅ Successfully triggered GitHub Actions');
    
    res.status(200).json({ 
      success: true, 
      message: 'Webhook forwarded to GitHub Actions',
      orderId: order.id || order.order_number
    });

  } catch (error) {
    console.error('❌ Error processing webhook:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
} 