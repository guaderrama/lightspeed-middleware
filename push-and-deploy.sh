#!/bin/bash

# Complete push and deploy script
# Pushes commits to GitHub and deploys to Firebase

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Push & Deploy Script${NC}"
echo ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
    echo "Please commit or stash them first"
    exit 1
fi

# Show commits to be pushed
echo -e "${BLUE}📋 Commits to be pushed:${NC}"
git log --oneline origin/main..HEAD | cat
echo ""

# Confirm push
read -p "Push these commits to GitHub? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    exit 1
fi

echo -e "${BLUE}⬆️  Step 1: Pushing to GitHub...${NC}"
git push origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Push successful${NC}"
else
    echo -e "${RED}❌ Push failed${NC}"
    exit 1
fi
echo ""

# Ask if should deploy
read -p "Deploy to Firebase now? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping deploy. You can deploy later with: ./deploy-fix.sh"
    exit 0
fi

# Run deploy script
echo ""
echo -e "${BLUE}🚀 Step 2: Deploying to Firebase...${NC}"
./deploy-fix.sh

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All done!${NC}"
    echo ""
    echo "Summary:"
    echo "  ✅ Commits pushed to GitHub"
    echo "  ✅ Functions deployed to Firebase"
    echo "  ✅ Endpoints tested and working"
    echo ""
    echo -e "${BLUE}Test the app:${NC}"
    echo "  1. Open tests/manual-testing.html in Chrome"
    echo "  2. Visit https://lightspeed-middleware.web.app/dashboard"
else
    echo -e "${RED}❌ Deploy failed${NC}"
    echo "Your commits were pushed to GitHub, but deploy failed"
    echo "You can retry the deploy with: ./deploy-fix.sh"
    exit 1
fi
