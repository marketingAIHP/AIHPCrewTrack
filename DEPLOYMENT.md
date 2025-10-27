# AIHP CrewTrack - Deployment Guide

This guide will walk you through deploying AIHP CrewTrack to Render using GitHub.

## Prerequisites

- GitHub account
- Render account (free at [render.com](https://render.com))
- SendGrid API key (for email functionality)
- Google Maps API key (for map features)

## Step 1: Push to GitHub

### 1.1 Create a New GitHub Repository

1. Go to [github.com](https://github.com) and log in
2. Click the **+** icon in the top right → **New repository**
3. Repository name: `aihp-crewtrack` (or your preferred name)
4. Description: "AIHP CrewTrack - Workforce Management & Tracking System"
5. Choose **Public** or **Private**
6. **Do NOT** initialize with README (we already have code)
7. Click **Create repository**

### 1.2 Push Your Code to GitHub

Open the terminal in Replit and run these commands:

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Commit your code
git commit -m "Initial commit - AIHP CrewTrack ready for deployment"

# Add GitHub as remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/aihp-crewtrack.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Note:** If you have authentication issues, you may need to:
- Use a Personal Access Token instead of password
- Or set up SSH keys (recommended)

## Step 2: Deploy to Render

### 2.1 Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **PostgreSQL**
3. Configure:
   - **Name**: `aihp-crewtrack-db`
   - **Database**: `crewtrack`
   - **User**: `crewtrack_user`
   - **Region**: Choose closest to your users
   - **Plan**: Free (for testing) or Starter (for production)
4. Click **Create Database**
5. Wait for database to initialize (1-2 minutes)
6. **Copy the Internal Database URL** - you'll need this later

### 2.2 Create Web Service

1. In Render Dashboard, click **New +** → **Web Service**
2. Click **Connect GitHub** (authorize if first time)
3. Find and select your `aihp-crewtrack` repository
4. Click **Connect**

### 2.3 Configure Web Service

Fill in the deployment settings:

| Field | Value |
|-------|-------|
| **Name** | `aihp-crewtrack` |
| **Region** | Same as database (or closest to users) |
| **Branch** | `main` |
| **Root Directory** | (leave blank) |
| **Environment** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | Free (or Starter for production) |

### 2.4 Add Environment Variables

Click **Advanced** → **Add Environment Variable** and add these:

```
NODE_ENV=production
PORT=10000
DATABASE_URL=<paste_internal_database_url_from_step_2.1>
SENDGRID_API_KEY=<your_sendgrid_api_key>
```

**Important:** 
- Use the **Internal Database URL** from your Render PostgreSQL database
- Add your actual SendGrid API key

### 2.5 Deploy

1. Click **Create Web Service**
2. Render will automatically:
   - Clone your GitHub repo
   - Install dependencies
   - Build your app
   - Start the server
3. Wait 5-10 minutes for first deployment
4. Your app will be live at: `https://aihp-crewtrack.onrender.com`

## Step 3: Initialize Database

After deployment, you need to push your database schema:

### Option A: Using Replit (Recommended)

1. In Replit, update the `DATABASE_URL` environment variable to your Render database URL
2. Run: `npm run db:push`
3. Confirm the push

### Option B: Using Render Shell

1. Go to your Web Service in Render Dashboard
2. Click **Shell** tab
3. Run: `npm run db:push`

## Step 4: Configure Google Maps API

Your app needs a Google Maps API key for location features:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable **Maps JavaScript API**
4. Create API credentials
5. Add the API key to your app (if not already configured)

## Step 5: Create Admin Account

After deployment, create your first admin account:

1. Visit your deployed app: `https://aihp-crewtrack.onrender.com`
2. Navigate to Admin Login
3. The database is fresh, so you'll need to manually create the first admin or update the app to allow initial registration

## Auto-Deploy on Push

Render automatically deploys when you push to GitHub:

```bash
# Make changes to your code
git add .
git commit -m "Update feature X"
git push origin main

# Render will automatically deploy the changes
```

## Environment Variables Reference

### Required Variables

- `NODE_ENV`: Set to `production`
- `PORT`: Render automatically sets this to `10000`
- `DATABASE_URL`: PostgreSQL connection string from Render database
- `SENDGRID_API_KEY`: For email notifications

### Optional Variables

Add these if needed:
- `SESSION_SECRET`: For secure sessions (auto-generated if not set)
- `JWT_SECRET`: For JWT tokens (auto-generated if not set)

## Monitoring & Logs

### View Logs
1. Go to your Web Service in Render
2. Click **Logs** tab
3. Watch real-time logs

### Check Metrics
1. Click **Metrics** tab
2. View CPU, Memory, and Request metrics

## Troubleshooting

### Build Fails
- Check build logs in Render dashboard
- Verify all dependencies are in `package.json`
- Ensure build command is correct

### Database Connection Error
- Verify `DATABASE_URL` is set correctly
- Use **Internal Database URL** not External
- Check database is in same region as web service

### App Not Starting
- Check logs for error messages
- Verify start command: `npm start`
- Ensure port binding: `server.listen(process.env.PORT || 5000, '0.0.0.0')`

### Images/Assets Not Loading
- Verify build completed successfully
- Check that `dist/public` contains all assets
- Confirm static file serving is working

## Production Checklist

Before going live:

- [ ] PostgreSQL database created and schema pushed
- [ ] All environment variables configured
- [ ] SendGrid API key added and tested
- [ ] Google Maps API key configured
- [ ] Admin account created
- [ ] Test employee creation and login
- [ ] Test location tracking features
- [ ] Test site management
- [ ] Verify email notifications work
- [ ] Test on mobile devices (PWA features)
- [ ] Configure custom domain (optional)

## Custom Domain (Optional)

To use your own domain:

1. In Render dashboard, go to your Web Service
2. Click **Settings** → **Custom Domains**
3. Click **Add Custom Domain**
4. Enter your domain (e.g., `crewtrack.yourcompany.com`)
5. Follow DNS configuration instructions
6. Wait for SSL certificate to provision (automatic)

## Support

If you encounter issues:

1. Check Render's [official documentation](https://render.com/docs)
2. Review application logs in Render dashboard
3. Check database connectivity
4. Verify all environment variables are set correctly

## Cost Estimate

### Free Tier
- Web Service: Free (spins down after 15 min of inactivity)
- PostgreSQL: Free (90-day limit, then expires)
- Total: $0/month

### Production Tier (Recommended)
- Web Service: $7/month (always on, no spin down)
- PostgreSQL: $7/month (persistent, always on)
- Total: $14/month

---

**Your app is now deployed! 🚀**

Access it at: `https://aihp-crewtrack.onrender.com`
