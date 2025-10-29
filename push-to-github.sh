#!/bin/bash

echo "==========================================\n"
echo "AIHP CrewTrack - GitHub Push Helper"
echo "==========================================\n"

# Check if git is initialized
if [ ! -d .git ]; then
  echo "Initializing git repository..."
  git init
  git branch -M main
fi

# Add all files
echo "Adding files to git..."
git add .

# Commit
echo "\nEnter commit message (or press Enter for default):"
read commit_message
if [ -z "$commit_message" ]; then
  commit_message="Update AIHP CrewTrack - ready for deployment"
fi

git commit -m "$commit_message"

# Ask for GitHub Personal Access Token
echo "\n==========================================\n"
echo "GitHub Authentication Required"
echo "==========================================\n"
echo "You need a Personal Access Token (not password)."
echo "\nIf you don't have one:"
echo "1. Go to: https://github.com/settings/tokens"
echo "2. Click 'Generate new token' → 'Generate new token (classic)'"
echo "3. Name: 'AIHP CrewTrack Deploy'"
echo "4. Select scope: ✓ repo (all repo permissions)"
echo "5. Click 'Generate token'"
echo "6. COPY the token (starts with ghp_...)\n"

echo "Enter your GitHub Personal Access Token:"
read -s github_token

if [ -z "$github_token" ]; then
  echo "\nError: Token cannot be empty!"
  exit 1
fi

# Remove existing origin if it exists
git remote remove origin 2>/dev/null

# Add remote with token
echo "\nAdding GitHub remote..."
git remote add origin https://$github_token@github.com/digitalaihp/AIHPCrewTrack.git

# Push to GitHub
echo "\nPushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
  echo "\n✅ Success! Your code is now on GitHub!"
  echo "View it at: https://github.com/digitalaihp/AIHPCrewTrack"
  echo "\nNext step: Deploy to Render (see QUICK-START-DEPLOY.md)"
else
  echo "\n❌ Push failed. Please check your token and try again."
fi
