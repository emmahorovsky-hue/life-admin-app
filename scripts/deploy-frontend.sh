#!/bin/bash

# Life Admin App - Frontend Deployment Script
# This script helps deploy the frontend to Vercel

set -e

echo "🚀 Life Admin App - Frontend Deployment"
echo "======================================="
echo ""

# Check if Vercel CLI is authenticated
if ! vercel whoami &> /dev/null; then
    echo "❌ Not authenticated with Vercel"
    echo "Please run: vercel login"
    exit 1
fi

echo "✅ Vercel CLI authenticated"
echo ""

# Navigate to client directory
cd "$(dirname "$0")/../client"

echo "📦 Current directory: $(pwd)"
echo ""

# Prompt for backend URL
echo "🔗 Backend Configuration"
echo ""
read -p "Enter your Railway backend URL (e.g., https://life-admin-backend.up.railway.app): " BACKEND_URL

if [ -z "$BACKEND_URL" ]; then
    echo "❌ Backend URL is required"
    exit 1
fi

# Update vercel.json with backend URL
echo "📝 Updating vercel.json with backend URL..."
sed -i.bak "s|https://life-admin-backend.up.railway.app|$BACKEND_URL|g" vercel.json
rm vercel.json.bak
echo "✅ Updated vercel.json"
echo ""

# Build the project first to check for errors
echo "🏗️  Building project..."
npm run build
echo "✅ Build successful"
echo ""

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
echo ""
echo "First deployment options:"
echo "1. Set up and deploy? → Y"
echo "2. Which scope? → (select your account)"
echo "3. Link to existing project? → N"
echo "4. Project name? → life-admin-app"
echo "5. Directory? → ./"
echo "6. Override settings? → N"
echo ""
read -p "Press Enter to continue with deployment..."

# Deploy to production
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
FRONTEND_URL=$(vercel inspect --wait | grep -oP 'https://[^\s]+')
echo "🌐 Your frontend URL: $FRONTEND_URL"
echo ""
echo "⚠️  IMPORTANT: Update your Railway backend CORS settings:"
echo ""
echo "   cd ../server"
echo "   railway variables set CLIENT_URL=\"$FRONTEND_URL\""
echo "   railway up"
echo ""
echo "📋 Next steps:"
echo "1. Update Railway CORS (see above)"
echo "2. Test the registration flow"
echo "3. Test the login flow"
echo "4. Test adding a subscription"
echo ""
