#!/bin/bash

# Vercel Deployment Optimization Script
# This script optimizes and deploys your app to Vercel

echo "🚀 Starting Vercel Deployment Optimization..."
echo ""

# Step 1: Clean previous builds
echo "📦 Cleaning previous builds..."
rm -rf dist node_modules/.vite
echo "✅ Clean complete"
echo ""

# Step 2: Install dependencies
echo "📥 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Step 3: Build for production
echo "🔨 Building for production..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
    echo ""
    
    # Step 4: Show build stats
    echo "📊 Build Statistics:"
    du -sh dist
    echo ""
    
    # Step 5: Preview (optional)
    echo "🔍 Would you like to preview the build locally? (y/n)"
    read -r preview
    
    if [ "$preview" = "y" ]; then
        echo "Starting preview server..."
        npm run preview
    fi
    
    # Step 6: Deploy to Vercel
    echo ""
    echo "🚀 Ready to deploy to Vercel!"
    echo "Run: vercel --prod"
    echo "Or push to GitHub for auto-deployment"
    
else
    echo "❌ Build failed. Please check errors above."
    exit 1
fi
