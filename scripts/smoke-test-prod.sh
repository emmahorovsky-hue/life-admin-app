#!/bin/bash
# Production Smoke Tests
# Run this after deploying to verify production is working

set -e

# Replace with your production URL
PROD_URL="${PROD_URL:-https://lifeadmin.yourapp.com}"
BACKEND_URL="${BACKEND_URL:-$PROD_URL}"

echo "🔥 Running production smoke tests..."
echo "Target: $PROD_URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# 1. Health check
echo "1️⃣  Testing backend health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL/health)
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed (HTTP $HEALTH)${NC}"
    exit 1
fi
echo ""

# 2. API accessibility
echo "2️⃣  Testing API endpoints..."
CATEGORIES=$(curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL/api/categories)
if [ "$CATEGORIES" = "200" ]; then
    echo -e "${GREEN}✅ API is accessible${NC}"
else
    echo -e "${RED}❌ API not accessible (HTTP $CATEGORIES)${NC}"
    exit 1
fi
echo ""

# 3. Frontend loads
echo "3️⃣  Testing frontend..."
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" $PROD_URL)
if [ "$FRONTEND" = "200" ]; then
    echo -e "${GREEN}✅ Frontend is loading${NC}"
else
    echo -e "${RED}❌ Frontend not loading (HTTP $FRONTEND)${NC}"
    exit 1
fi
echo ""

# 4. Registration endpoint is up
echo "4️⃣  Testing registration endpoint..."
REGISTER=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST $BACKEND_URL/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"smoke-test@example.com","password":"testpass123","name":"Smoke Test"}')

if [ "$REGISTER" = "201" ] || [ "$REGISTER" = "400" ]; then
    echo -e "${GREEN}✅ Registration endpoint is up (HTTP $REGISTER)${NC}"
else
    echo -e "${RED}❌ Registration endpoint failed (HTTP $REGISTER)${NC}"
    exit 1
fi
echo ""

# 5. Check response times
echo "5️⃣  Testing response times..."
TIME=$(curl -s -o /dev/null -w "%{time_total}" $BACKEND_URL/health)
echo "Health endpoint response time: ${TIME}s"
if (( $(echo "$TIME < 1.0" | bc -l) )); then
    echo -e "${GREEN}✅ Response time acceptable${NC}"
else
    echo -e "${RED}⚠️  Response time slow (${TIME}s > 1.0s)${NC}"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ ALL PRODUCTION SMOKE TESTS PASSED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Production deployment verified! ✨"
echo ""
