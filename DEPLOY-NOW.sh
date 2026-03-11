#!/bin/bash

# DEPLOY NOW - Execute this script to deploy everything
# This script will guide you through the deployment process

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║           🚀 DEPLOY APP VEND - BUG FIX                        ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if authenticated in GitHub
echo -e "${BLUE}Checking GitHub authentication...${NC}"
if git push --dry-run origin main &>/dev/null; then
    echo -e "${GREEN}✅ GitHub: Authenticated${NC}"
    GITHUB_AUTH=true
else
    echo -e "${YELLOW}⚠️  GitHub: Not authenticated${NC}"
    echo "Please run: gh auth login"
    echo "Or configure your GitHub token"
    GITHUB_AUTH=false
fi
echo ""

# Check if authenticated in Firebase
echo -e "${BLUE}Checking Firebase authentication...${NC}"
if npx firebase projects:list &>/dev/null; then
    echo -e "${GREEN}✅ Firebase: Authenticated${NC}"
    FIREBASE_AUTH=true
else
    echo -e "${YELLOW}⚠️  Firebase: Not authenticated${NC}"
    echo "Please run: npx firebase login"
    FIREBASE_AUTH=false
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════════════"
echo ""
if [ "$GITHUB_AUTH" = true ] && [ "$FIREBASE_AUTH" = true ]; then
    echo -e "${GREEN}✅ All authentication checks passed!${NC}"
    echo ""
    echo "Ready to deploy. Run:"
    echo ""
    echo -e "${BLUE}  ./push-and-deploy.sh${NC}"
    echo ""
    echo "This will:"
    echo "  1. Push commits to GitHub"
    echo "  2. Deploy to Firebase"
    echo "  3. Test the endpoints"
    echo "  4. Show you the results"
    echo ""
elif [ "$GITHUB_AUTH" = false ] && [ "$FIREBASE_AUTH" = false ]; then
    echo -e "${RED}❌ Both GitHub and Firebase need authentication${NC}"
    echo ""
    echo "Run these commands:"
    echo ""
    echo -e "${YELLOW}  # GitHub authentication${NC}"
    echo "  gh auth login"
    echo ""
    echo -e "${YELLOW}  # Firebase authentication${NC}"
    echo "  npx firebase login"
    echo ""
    echo "Then run this script again: ./DEPLOY-NOW.sh"
elif [ "$GITHUB_AUTH" = false ]; then
    echo -e "${RED}❌ GitHub needs authentication${NC}"
    echo ""
    echo "Run:"
    echo "  gh auth login"
    echo ""
    echo "Then run: ./push-and-deploy.sh"
else
    echo -e "${RED}❌ Firebase needs authentication${NC}"
    echo ""
    echo "Run:"
    echo "  npx firebase login"
    echo ""
    echo "Then run: ./push-and-deploy.sh"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📚 Documentation:"
echo "  • Quick Start: tests/README.md"
echo "  • Deploy Guide: DEPLOY-INSTRUCTIONS.md"
echo "  • Session Docs: SESSION-2026-02-09-FIX.md"
echo ""
