#!/bin/bash

# UrbanCare Deployment Script
# This script helps with deployment preparation and validation

set -e  # Exit on any error

echo "🚀 UrbanCare Deployment Preparation"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

print_status "Found package.json"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    print_warning ".env.local not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        print_warning "Please update .env.local with your actual values before deploying"
    else
        print_error ".env.example not found. Please create .env.local manually."
        exit 1
    fi
else
    print_status "Found .env.local"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install
print_status "Dependencies installed"

# Run linting
echo ""
echo "🔍 Running linting..."
if npm run lint; then
    print_status "Linting passed"
else
    print_error "Linting failed. Please fix the issues before deploying."
    exit 1
fi

# Build the project
echo ""
echo "🏗️ Building project..."
if npm run build; then
    print_status "Build successful"
else
    print_error "Build failed. Please fix the issues before deploying."
    exit 1
fi

# Check build output
if [ -d "dist" ]; then
    print_status "Build output directory (dist) exists"
    
    # Check if index.html exists
    if [ -f "dist/index.html" ]; then
        print_status "index.html found in build output"
    else
        print_error "index.html not found in build output"
        exit 1
    fi
else
    print_error "Build output directory (dist) not found"
    exit 1
fi

# Validate environment variables
echo ""
echo "🔐 Validating environment variables..."

check_env_var() {
    local var_name=$1
    local var_value=$(grep "^$var_name=" .env.local 2>/dev/null | cut -d '=' -f2- || echo "")
    
    if [ -z "$var_value" ] || [ "$var_value" = "your_${var_name,,}" ] || [[ "$var_value" == *"your_"* ]]; then
        print_warning "$var_name is not properly configured"
        return 1
    else
        print_status "$var_name is configured"
        return 0
    fi
}

env_issues=0

if ! check_env_var "VITE_SUPABASE_URL"; then
    ((env_issues++))
fi

if ! check_env_var "VITE_SUPABASE_ANON_KEY"; then
    ((env_issues++))
fi

if ! check_env_var "VITE_GOOGLE_MAPS_API_KEY"; then
    ((env_issues++))
fi

if ! check_env_var "VITE_AUTHORITY_ACCESS_CODE"; then
    ((env_issues++))
fi

if [ $env_issues -gt 0 ]; then
    print_warning "$env_issues environment variable(s) need attention"
    echo "Please update .env.local with proper values before deploying to production"
else
    print_status "All environment variables are configured"
fi

# Check for common deployment files
echo ""
echo "📋 Checking deployment configuration..."

if [ -f "vercel.json" ]; then
    print_status "vercel.json found"
else
    print_warning "vercel.json not found"
fi

if [ -f "public/_redirects" ]; then
    print_status "public/_redirects found (for Netlify compatibility)"
else
    print_warning "public/_redirects not found"
fi

# Security check
echo ""
echo "🔒 Security checklist..."

# Check if .env.local is in .gitignore
if grep -q "\.env\.local" .gitignore 2>/dev/null; then
    print_status ".env.local is in .gitignore"
else
    print_warning ".env.local should be added to .gitignore"
fi

# Check for hardcoded secrets (basic check)
if grep -r "sk_" src/ 2>/dev/null | grep -v "example" | head -1; then
    print_warning "Potential hardcoded API keys found in source code"
fi

# Final summary
echo ""
echo "📊 Deployment Readiness Summary"
echo "==============================="

if [ $env_issues -eq 0 ]; then
    print_status "✅ Ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Commit and push your changes to your repository"
    echo "2. Deploy to Vercel:"
    echo "   - Connect your repository to Vercel"
    echo "   - Configure environment variables in Vercel dashboard"
    echo "   - Deploy!"
    echo ""
    echo "3. Or deploy manually with Vercel CLI:"
    echo "   npm i -g vercel"
    echo "   vercel --prod"
else
    print_warning "⚠️ Please address the environment variable issues before deploying"
fi

echo ""
echo "For detailed deployment instructions, see docs/DEPLOYMENT.md"