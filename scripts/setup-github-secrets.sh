#!/usr/bin/env bash
# Setup GitHub Secrets for Danny Tasks deployment pipeline
# This script helps you gather all the necessary values

set -e

echo "🔐 GitHub Secrets Setup for Danny Tasks"
echo "========================================"
echo ""
echo "This script will help you gather the necessary secrets for automated deployment."
echo "You'll need to manually add these to GitHub at:"
echo "https://github.com/jamesvillarrubia/danny-o/settings/secrets/actions"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}1. FLY.IO API TOKEN${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Required for: Deploying API to Fly.io"
echo ""
echo "How to get it:"
echo "  1. Visit: https://fly.io/dashboard/personal/tokens"
echo "  2. Click 'Create Token'"
echo "  3. Name it: 'GitHub Actions - Danny Tasks'"
echo "  4. Copy the token (you won't see it again!)"
echo ""

# Try to detect if flyctl is logged in
if command -v flyctl &> /dev/null; then
    echo -e "${GREEN}✓ flyctl is installed${NC}"
    if flyctl auth whoami &> /dev/null; then
        CURRENT_USER=$(flyctl auth whoami 2>/dev/null | head -1 || echo "unknown")
        echo -e "${GREEN}✓ Logged in as: $CURRENT_USER${NC}"
        echo ""
        echo -e "${YELLOW}Note: The token needs to be created in the dashboard (link above)${NC}"
        echo -e "${YELLOW}      We can't extract it from flyctl for security reasons.${NC}"
    else
        echo -e "${YELLOW}⚠ Not logged in to flyctl${NC}"
        echo "  Run: flyctl auth login"
    fi
else
    echo -e "${YELLOW}⚠ flyctl not installed${NC}"
fi

echo ""
read -p "Press Enter when you have your Fly.io token ready..."
echo ""
echo "GitHub Secret to add:"
echo -e "${GREEN}Name:  FLY_API_TOKEN${NC}"
echo "Value: [paste your token from Fly.io]"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}2. VERCEL AUTHENTICATION${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Required for: Deploying Web frontend to Vercel"
echo ""

# Check if vercel CLI is available
if command -v vercel &> /dev/null; then
    echo -e "${GREEN}✓ Vercel CLI is installed${NC}"
    
    # Try to get current user
    VERCEL_USER=$(vercel whoami 2>/dev/null || echo "")
    if [ -n "$VERCEL_USER" ]; then
        echo -e "${GREEN}✓ Logged in as: $VERCEL_USER${NC}"
    else
        echo -e "${YELLOW}⚠ Not logged in to Vercel${NC}"
        echo "  Run: vercel login"
    fi
else
    echo -e "${YELLOW}⚠ Vercel CLI not installed${NC}"
    echo "  Install: npm install -g vercel"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2a. VERCEL TOKEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "How to get it:"
echo "  1. Visit: https://vercel.com/account/tokens"
echo "  2. Click 'Create Token'"
echo "  3. Name it: 'GitHub Actions - Danny Tasks'"
echo "  4. Scope: Full Account"
echo "  5. Expiration: No expiration (or set to your preference)"
echo "  6. Copy the token"
echo ""
read -p "Press Enter when you have your Vercel token ready..."
echo ""
echo "GitHub Secret to add:"
echo -e "${GREEN}Name:  VERCEL_TOKEN${NC}"
echo "Value: [paste your token from Vercel]"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2b. VERCEL ORG ID & PROJECT ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "These are needed to identify your Vercel project."
echo ""

# Try to link the project if not already linked
if [ -f "web/.vercel/project.json" ]; then
    echo -e "${GREEN}✓ Project already linked${NC}"
    ORG_ID=$(jq -r '.orgId' web/.vercel/project.json 2>/dev/null || echo "")
    PROJECT_ID=$(jq -r '.projectId' web/.vercel/project.json 2>/dev/null || echo "")
    
    if [ -n "$ORG_ID" ] && [ -n "$PROJECT_ID" ]; then
        echo ""
        echo -e "${GREEN}Found values in web/.vercel/project.json:${NC}"
        echo ""
        echo "GitHub Secrets to add:"
        echo -e "${GREEN}Name:  VERCEL_ORG_ID${NC}"
        echo -e "Value: ${YELLOW}${ORG_ID}${NC}"
        echo ""
        echo -e "${GREEN}Name:  VERCEL_PROJECT_ID${NC}"
        echo -e "Value: ${YELLOW}${PROJECT_ID}${NC}"
    else
        echo -e "${YELLOW}⚠ Could not read values from project.json${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Project not linked yet${NC}"
    echo ""
    echo "To link your Vercel project:"
    echo "  1. cd web"
    echo "  2. vercel link"
    echo "  3. Follow the prompts to select your project"
    echo "  4. Run this script again"
    echo ""
    echo "Or get them manually:"
    echo "  1. Go to your Vercel project dashboard"
    echo "  2. Go to Settings → General"
    echo "  3. Find 'Project ID' (starts with prj_)"
    echo "  4. Go to your account/team settings to find 'Team ID' (starts with team_)"
fi

echo ""
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}3. ADD SECRETS TO GITHUB${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Now, add all these secrets to GitHub:"
echo ""
echo "  1. Visit: https://github.com/jamesvillarrubia/danny-o/settings/secrets/actions"
echo "  2. Click 'New repository secret' for each one"
echo "  3. Add these secrets:"
echo ""
echo "     • FLY_API_TOKEN"
echo "     • VERCEL_TOKEN"
echo "     • VERCEL_ORG_ID"
echo "     • VERCEL_PROJECT_ID"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT: Keep these values secure! Don't commit them to git.${NC}"
echo ""

# Try to open GitHub secrets page
if command -v open &> /dev/null; then
    read -p "Open GitHub secrets page in browser? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open "https://github.com/jamesvillarrubia/danny-o/settings/secrets/actions"
    fi
fi

echo ""
echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo "After adding the secrets, your next push to 'develop' or 'main' will"
echo "automatically deploy to the appropriate environment."
echo ""
