#!/bin/bash

# Life Admin App - Pre-Flight Deployment Check
# Run this before deploying to catch issues early

echo "🔍 Pre-Flight Deployment Check"
echo "=============================="
echo ""

ERRORS=0
WARNINGS=0

# Check Node.js
echo "📦 Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js not found"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check npm
echo "📦 Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "✅ npm: $NPM_VERSION"
else
    echo "❌ npm not found"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check Railway CLI
echo "🚂 Checking Railway CLI..."
if command -v railway &> /dev/null; then
    echo "✅ Railway CLI installed"
    
    # Check authentication
    if railway whoami &> /dev/null; then
        RAILWAY_USER=$(railway whoami)
        echo "✅ Railway authenticated as: $RAILWAY_USER"
    else
        echo "⚠️  Railway CLI not authenticated"
        echo "   Run: railway login"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "❌ Railway CLI not found"
    echo "   Install: npm install -g @railway/cli"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check Vercel CLI
echo "▲ Checking Vercel CLI..."
if command -v vercel &> /dev/null; then
    echo "✅ Vercel CLI installed"
    
    # Check authentication
    if vercel whoami &> /dev/null; then
        VERCEL_USER=$(vercel whoami)
        echo "✅ Vercel authenticated as: $VERCEL_USER"
    else
        echo "⚠️  Vercel CLI not authenticated"
        echo "   Run: vercel login"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "❌ Vercel CLI not found"
    echo "   Install: npm install -g vercel"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check backend dependencies
echo "🔧 Checking backend setup..."
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT/server" || exit 1

if [ -f "package.json" ]; then
    echo "✅ Backend package.json found"
else
    echo "❌ Backend package.json not found"
    ERRORS=$((ERRORS + 1))
fi

if [ -d "node_modules" ]; then
    echo "✅ Backend dependencies installed"
else
    echo "⚠️  Backend dependencies not installed"
    echo "   Run: cd server && npm install"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f "prisma/schema.prisma" ]; then
    echo "✅ Prisma schema found"
else
    echo "❌ Prisma schema not found"
    ERRORS=$((ERRORS + 1))
fi

if [ -d "prisma/migrations" ]; then
    echo "✅ Database migrations found"
else
    echo "⚠️  No database migrations found"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check frontend setup
echo "🎨 Checking frontend setup..."
cd "$PROJECT_ROOT/client" || exit 1

if [ -f "package.json" ]; then
    echo "✅ Frontend package.json found"
else
    echo "❌ Frontend package.json not found"
    ERRORS=$((ERRORS + 1))
fi

if [ -d "node_modules" ]; then
    echo "✅ Frontend dependencies installed"
else
    echo "⚠️  Frontend dependencies not installed"
    echo "   Run: cd client && npm install"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f "vite.config.ts" ]; then
    echo "✅ Vite config found"
else
    echo "❌ Vite config not found"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "vercel.json" ]; then
    echo "✅ Vercel config found"
else
    echo "⚠️  Vercel config not found"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check Git status
echo "📚 Checking Git status..."
cd "$PROJECT_ROOT" || exit 1

if [ -d ".git" ]; then
    echo "✅ Git repository initialized"
    
    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo "⚠️  You have uncommitted changes"
        echo "   Consider committing before deployment"
        WARNINGS=$((WARNINGS + 1))
    else
        echo "✅ Working directory clean"
    fi
else
    echo "⚠️  Not a Git repository"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo "================================"
echo "📊 Pre-Flight Check Summary"
echo "================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 All checks passed! You're ready to deploy."
    echo ""
    echo "Next steps:"
    echo "1. Deploy backend: ./scripts/deploy-backend.sh"
    echo "2. Deploy frontend: ./scripts/deploy-frontend.sh"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  $WARNINGS warning(s) found"
    echo "You can proceed with deployment, but review warnings above."
    echo ""
    exit 0
else
    echo "❌ $ERRORS error(s) and $WARNINGS warning(s) found"
    echo "Please fix errors before deploying."
    echo ""
    exit 1
fi
