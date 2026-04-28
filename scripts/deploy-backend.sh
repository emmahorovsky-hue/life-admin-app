#!/bin/bash

# Life Admin App - Backend Deployment Script
# This script helps deploy the backend to Railway

set -e

echo "🚀 Life Admin App - Backend Deployment"
echo "======================================"
echo ""

# Check if Railway CLI is authenticated
if ! railway whoami &> /dev/null; then
    echo "❌ Not authenticated with Railway"
    echo "Please run: railway login"
    exit 1
fi

echo "✅ Railway CLI authenticated"
echo ""

# Navigate to server directory
cd "$(dirname "$0")/../server"

echo "📦 Current directory: $(pwd)"
echo ""

# Check if project is linked
if ! railway status &> /dev/null; then
    echo "🔗 No Railway project linked. Let's create one..."
    echo ""
    echo "Please follow these steps:"
    echo "1. Run: railway init"
    echo "2. Choose: Create a new project"
    echo "3. Name it: life-admin-backend"
    echo "4. Then run this script again"
    exit 0
fi

echo "✅ Railway project linked"
echo ""

# Check if PostgreSQL is added
echo "🔍 Checking for PostgreSQL addon..."
if ! railway variables | grep -q "DATABASE_URL"; then
    echo "❌ PostgreSQL not found"
    echo "Please run: railway add"
    echo "Then select: PostgreSQL"
    exit 1
fi

echo "✅ PostgreSQL database found"
echo ""

# Set environment variables if not already set
echo "🔧 Configuring environment variables..."

if ! railway variables | grep -q "JWT_SECRET"; then
    JWT_SECRET=$(openssl rand -base64 32)
    railway variables set JWT_SECRET="$JWT_SECRET"
    echo "✅ Set JWT_SECRET"
else
    echo "ℹ️  JWT_SECRET already set"
fi

if ! railway variables | grep -q "JWT_EXPIRES_IN"; then
    railway variables set JWT_EXPIRES_IN="7d"
    echo "✅ Set JWT_EXPIRES_IN"
else
    echo "ℹ️  JWT_EXPIRES_IN already set"
fi

if ! railway variables | grep -q "NODE_ENV"; then
    railway variables set NODE_ENV="production"
    echo "✅ Set NODE_ENV"
else
    echo "ℹ️  NODE_ENV already set"
fi

if ! railway variables | grep -q "PORT"; then
    railway variables set PORT="3001"
    echo "✅ Set PORT"
else
    echo "ℹ️  PORT already set"
fi

echo ""
echo "📋 Current environment variables:"
railway variables
echo ""

# Ask for frontend URL if CLIENT_URL not set
if ! railway variables | grep -q "CLIENT_URL"; then
    echo "⚠️  CLIENT_URL not set"
    echo "You'll need to set this after deploying the frontend:"
    echo 'railway variables set CLIENT_URL="https://your-frontend.vercel.app"'
    echo ""
    read -p "Press Enter to continue..."
fi

echo "🚀 Deploying to Railway..."
echo ""

railway up

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "📊 View logs:"
echo "   railway logs"
echo ""
echo "🌐 Get your backend URL:"
echo "   railway domain"
echo ""
echo "🔧 Update CORS after frontend deployment:"
echo '   railway variables set CLIENT_URL="https://your-frontend.vercel.app"'
echo ""
