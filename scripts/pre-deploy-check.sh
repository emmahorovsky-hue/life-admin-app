#!/bin/bash
# Pre-Deployment Smoke Tests
# Run this script before deploying to production

set -e  # Exit on any error

echo "🧪 Running pre-deployment checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check environment variables
echo "1️⃣  Checking environment variables..."
if [ ! -f "server/.env" ]; then
    echo -e "${RED}❌ server/.env file not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Environment variables configured${NC}"
echo ""

# 2. Install dependencies
echo "2️⃣  Checking dependencies..."
cd server
if [ ! -d "node_modules" ]; then
    echo "Installing server dependencies..."
    npm ci
fi
cd ../client
if [ ! -d "node_modules" ]; then
    echo "Installing client dependencies..."
    npm ci
fi
cd ..
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# 3. Run backend tests
echo "3️⃣  Running backend tests..."
cd server
npm test
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend tests passed${NC}"
else
    echo -e "${RED}❌ Backend tests failed${NC}"
    exit 1
fi
cd ..
echo ""

# 4. Build frontend
echo "4️⃣  Building frontend..."
cd client
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend build successful${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi
cd ..
echo ""

# 5. Check backend starts
echo "5️⃣  Checking backend server..."
cd server
npm run dev &
SERVER_PID=$!
sleep 5  # Wait for server to start

# Health check
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$HEALTH_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ Backend server healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed (HTTP $HEALTH_CHECK)${NC}"
    kill $SERVER_PID
    exit 1
fi

# Check categories endpoint (requires no auth)
CATEGORIES_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/categories)
if [ "$CATEGORIES_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ API endpoints accessible${NC}"
else
    echo -e "${RED}❌ API endpoints not accessible (HTTP $CATEGORIES_CHECK)${NC}"
    kill $SERVER_PID
    exit 1
fi

kill $SERVER_PID
cd ..
echo ""

# 6. Check for security vulnerabilities
echo "6️⃣  Checking for security vulnerabilities..."
cd server
npm audit --audit-level=high
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ No high-severity vulnerabilities${NC}"
else
    echo -e "${YELLOW}⚠️  Security vulnerabilities found. Review npm audit output.${NC}"
fi
cd ..
echo ""

# 7. Verify database migrations
echo "7️⃣  Checking database migrations..."
cd server
npx prisma migrate status
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database migrations up to date${NC}"
else
    echo -e "${RED}❌ Database migrations not applied${NC}"
    exit 1
fi
cd ..
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ ALL PRE-DEPLOYMENT CHECKS PASSED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Safe to deploy to production! 🚀"
echo ""
