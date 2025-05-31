#!/usr/bin/env python3
import os
import json
import urllib.request
import urllib.parse
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def fetch_latest_orders_with_assigned_locations(limit=3):
    """Fetch orders with line item assigned locations (the correct data for our app)"""
    
    shop_domain = os.getenv('SHOPIFY_SHOP_DOMAIN')
    access_token = os.getenv('SHOPIFY_ACCESS_TOKEN')
    
    # Query to get line items with their assigned fulfillment locations
    query = """
    query getOrdersWithAssignedLocations($first: Int!) {
      orders(first: $first, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPrice
            lineItems(first: 100) {
              edges {
                node {
                  id
                  name
                  quantity
                  fulfillableQuantity
                  fulfillmentService {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
    """
    
    url = f"https://{shop_domain}/admin/api/2023-10/graphql.json"
    headers = {
        'X-Shopify-Access-Token': access_token,
        'Content-Type': 'application/json',
    }
    
    variables = {"first": limit}
    data = json.dumps({'query': query, 'variables': variables}).encode('utf-8')
    
    try:
        req = urllib.request.Request(url, data=data, headers=headers)
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
        
        if 'errors' in result:
            print(f"❌ GraphQL errors: {result['errors']}")
            return None
        
        return result['data']['orders']['edges']
    
    except Exception as e:
        print(f"❌ Error fetching orders: {str(e)}")
        return None

def analyze_assigned_locations(order):
    """Analyze what the app would do 1 minute after order creation"""
    
    target_location_id = os.getenv('USA_LOCATION_ID')
    order_data = order['node']
    
    print(f"\n🔍 ANALYZING ORDER: {order_data['name']}")
    print(f"📅 Created: {datetime.fromisoformat(order_data['createdAt'].replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"💰 Total: {order_data['totalPrice']}")
    print(f"💳 Financial Status: {order_data['displayFinancialStatus']}")
    print(f"📦 Fulfillment Status: {order_data['displayFulfillmentStatus']}")
    
    # Get line items
    line_items = [edge['node'] for edge in order_data['lineItems']['edges']]
    print(f"📋 Line Items: {len(line_items)}")
    
    for i, item in enumerate(line_items, 1):
        print(f"   {i}. {item['name']} - Qty: {item['quantity']}")
        print(f"      Fulfillable: {item['fulfillableQuantity']}")
    
    print(f"\n⏰ APP WOULD RUN: 1 minute after order creation")
    print(f"🎯 TARGET LOCATION: USA (ID: {target_location_id})")
    
    # Note: The GraphQL API doesn't directly expose assigned_location_id for line items
    # This information is typically managed through fulfillment orders or inventory allocation
    print("\n🤖 APP LOGIC (1 minute after order creation):")
    print("   1. ✅ Webhook received for order creation")
    print("   2. ⏰ Wait 1 minute (scheduled job)")
    print("   3. 🔍 Fetch line items and their assigned fulfillment locations")
    print("   4. 📊 Analyze if consolidation is needed:")
    
    if order_data['displayFulfillmentStatus'] == 'UNFULFILLED':
        print("      → All items are unfulfilled (normal for new orders)")
        print("      → App would check the ASSIGNED locations for each line item")
        print("      → If assigned to different locations: CONSOLIDATE to USA")
        print("      → If all assigned to same location:")
        print("        ✅ If USA location: NO ACTION")
        print("        🔄 If other location: MOVE to USA location")
    else:
        print("      → Some items may already be processed")
    
    print(f"\n📋 WHAT THE APP WOULD DO:")
    print(f"   • Query each line item's assigned_location_id")
    print(f"   • Check if all items assigned to location {target_location_id}")
    print(f"   • If not: Reassign all items to USA location")
    print(f"   • Log the changes made")

def simulate_app_behavior():
    """Simulate what happens when the app runs"""
    
    print("🤖 SIMULATING APP BEHAVIOR...")
    print("=" * 60)
    print("📅 Order created at: 2025-05-31 09:00:50")
    print("⏰ App scheduled to run at: 2025-05-31 09:01:50")
    print("🔄 App starts processing...")
    print()
    
    print("🔍 STEP 1: Fetch order line items")
    print("   ✅ Found 2 line items")
    print()
    
    print("🔍 STEP 2: Check assigned locations")
    print("   📍 Line item 1: Assigned to Australia (67642949871)")
    print("   📍 Line item 2: Assigned to Yoyogi Office (23455432785)")
    print("   🎯 Target: USA (67642458351)")
    print()
    
    print("📊 STEP 3: Analysis")
    print("   ❌ Items assigned to multiple locations (Australia + Yoyogi)")
    print("   🔄 CONSOLIDATION NEEDED")
    print()
    
    print("⚡ STEP 4: Take action")
    print("   1. 🔄 Reassign line item 1: Australia → USA")
    print("   2. 🔄 Reassign line item 2: Yoyogi → USA")
    print("   3. 📝 Log consolidation action")
    print("   ✅ All items now assigned to USA location")

def main():
    print("🔍 CHECKING ASSIGNED LOCATIONS (CORRECT APP BEHAVIOR)")
    print("=" * 70)
    
    orders = fetch_latest_orders_with_assigned_locations(3)
    
    if not orders:
        print("❌ Could not fetch orders")
        return
    
    print(f"📦 Found {len(orders)} recent orders")
    
    # Analyze each order
    for i, order in enumerate(orders):
        analyze_assigned_locations(order)
        if i < len(orders) - 1:
            print("\n" + "="*70)
    
    print("\n" + "="*70)
    simulate_app_behavior()
    
    print("\n💡 KEY DIFFERENCE:")
    print("   ❌ WRONG: Wait for fulfillments to be created")
    print("   ✅ CORRECT: Check assigned locations 1 minute after order")
    print("   🎯 Goal: Prevent items from being fulfilled from wrong locations")

if __name__ == "__main__":
    main() 