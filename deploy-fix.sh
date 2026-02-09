#!/bin/bash

# Deploy script for the node-fetch fix
# This script will deploy the fixed functions to Firebase

set -e  # Exit on error

echo "🚀 Deploying node-fetch fix to Firebase..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Step 1: Building functions...${NC}"
cd "$(dirname "$0")/functions"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

cd ..

echo -e "${BLUE}🚀 Step 2: Deploying to Firebase...${NC}"
echo "This will deploy the fixed functions to production"
echo ""

npx firebase deploy --only functions

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deploy successful!${NC}"
    echo ""
    echo -e "${YELLOW}⏳ Waiting 30 seconds for functions to be ready...${NC}"
    sleep 30
    echo ""

    echo -e "${BLUE}🧪 Step 3: Testing the fixed endpoint...${NC}"
    echo ""

    # Test the sales-comparison endpoint
    echo "Testing /reports/sales-comparison..."
    RESPONSE=$(curl -s "https://us-central1-lightspeed-middleware.cloudfunctions.net/api/reports/sales-comparison?date_from=2025-01-09&date_to=2025-02-09&outlet_id=1" \
      -H "Authorization: Bearer sk-IVG-LS-20250821-aK7b9N3pXzW5rD1v" \
      -H "Content-Type: application/json")

    # Check if response contains error
    if echo "$RESPONSE" | grep -q '"error"'; then
        echo -e "${RED}❌ Endpoint still failing:${NC}"
        echo "$RESPONSE" | jq '.'
        echo ""
        echo -e "${YELLOW}Please check the Firebase Functions logs:${NC}"
        echo "npx firebase functions:log"
        exit 1
    else
        echo -e "${GREEN}✅ Endpoint working!${NC}"
        echo ""
        echo "Response summary:"
        echo "$RESPONSE" | jq '{
          current_amount: .data.current.summary.amount,
          changes: .data.changes,
          daily_sales_count: (.data.daily_sales | length)
        }'
        echo ""
    fi

    echo -e "${GREEN}🎉 All done! FASE 1 is now live!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Open the manual testing tool: tests/manual-testing.html"
    echo "2. Visit the dashboard: https://lightspeed-middleware.web.app/dashboard"
    echo "3. Test all the FASE 1 features (period selector, metrics, charts)"
    echo ""
    echo -e "${YELLOW}Commit hash: $(git rev-parse --short HEAD)${NC}"

else
    echo ""
    echo -e "${RED}❌ Deploy failed${NC}"
    echo ""
    echo "Common issues:"
    echo "1. Not authenticated: Run 'firebase login'"
    echo "2. Wrong project: Run 'firebase use lightspeed-middleware'"
    echo "3. Permissions issue: Check Firebase project permissions"
    exit 1
fi
