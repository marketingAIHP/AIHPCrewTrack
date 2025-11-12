#!/bin/bash

# LabourTrackr Deployment Helper Script
# This script helps you deploy to various platforms

echo "🚀 LabourTrackr Deployment Helper"
echo "=================================="
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git not initialized. Initializing..."
    git init
    echo "✅ Git initialized"
fi

# Check if code is committed
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes."
    read -p "Do you want to commit them now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        read -p "Enter commit message: " commit_msg
        git commit -m "${commit_msg:-Deploy to production}"
        echo "✅ Changes committed"
    fi
fi

# Generate JWT_SECRET if needed
echo ""
echo "🔑 Generating JWT_SECRET..."
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "Your JWT_SECRET: $JWT_SECRET"
echo "Save this for your environment variables!"
echo ""

# Check deployment platform
echo "Select deployment platform:"
echo "1) Render (Recommended)"
echo "2) Railway"
echo "3) Fly.io"
echo "4) Just push to GitHub"
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "📦 Deploying to Render..."
        echo ""
        echo "Steps:"
        echo "1. Push to GitHub:"
        echo "   git remote add origin https://github.com/YOUR_USERNAME/labourtrackr.git"
        echo "   git push -u origin main"
        echo ""
        echo "2. Go to render.com and:"
        echo "   - Create PostgreSQL database"
        echo "   - Create Web Service"
        echo "   - Add environment variables:"
        echo "     NODE_ENV=production"
        echo "     PORT=10000"
        echo "     DATABASE_URL=<from_database>"
        echo "     JWT_SECRET=$JWT_SECRET"
        echo "     SENDGRID_API_KEY=<your_key>"
        echo "     GOOGLE_MAPS_API_KEY=<your_key>"
        echo ""
        echo "3. After deployment, run: npm run db:push"
        ;;
    2)
        echo ""
        echo "📦 Deploying to Railway..."
        echo ""
        echo "Steps:"
        echo "1. Push to GitHub"
        echo "2. Go to railway.app and create project"
        echo "3. Add PostgreSQL database"
        echo "4. Add environment variables"
        echo "5. Deploy!"
        ;;
    3)
        echo ""
        echo "📦 Deploying to Fly.io..."
        echo ""
        echo "Run: fly launch"
        ;;
    4)
        echo ""
        echo "📦 Pushing to GitHub..."
        read -p "GitHub repository URL: " repo_url
        if [ -z "$repo_url" ]; then
            echo "❌ Repository URL required"
            exit 1
        fi
        git remote add origin "$repo_url" 2>/dev/null || git remote set-url origin "$repo_url"
        git branch -M main
        git push -u origin main
        echo "✅ Pushed to GitHub!"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment instructions displayed above!"
echo "📖 For detailed guide, see FREE-DEPLOYMENT-GUIDE.md"





