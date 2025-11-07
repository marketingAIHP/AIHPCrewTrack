# 🚀 Free Deployment Guide for LabourTrackr

This guide covers **100% FREE** deployment options for your LabourTrackr application.

## 📋 Table of Contents
1. [Option 1: Render (Recommended - Easiest)](#option-1-render-recommended)
2. [Option 2: Railway (Alternative)](#option-2-railway)
3. [Option 3: Fly.io (Alternative)](#option-3-flyio)
4. [Prerequisites](#prerequisites)
5. [Database Setup (Free PostgreSQL)](#database-setup)
6. [Environment Variables](#environment-variables)
7. [Post-Deployment Steps](#post-deployment-steps)

---

## Option 1: Render (Recommended) ⭐

**Best for:** Beginners, easiest setup, automatic deployments

### Free Tier Limits:
- ✅ Web Service: Free (spins down after 15 min inactivity, wakes on request)
- ✅ PostgreSQL: Free (90 days, then $7/month or recreate)
- ✅ Automatic SSL certificates
- ✅ Custom domains supported

### Step-by-Step Deployment:

#### 1. Push Code to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Ready for deployment"

# Create repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/labourtrackr.git
git branch -M main
git push -u origin main
```

#### 2. Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub (free)
3. Authorize Render to access your repositories

#### 3. Create PostgreSQL Database

1. In Render Dashboard, click **New +** → **PostgreSQL**
2. Configure:
   - **Name**: `labourtrackr-db`
   - **Database**: `labourtrackr`
   - **User**: `labourtrackr_user`
   - **Region**: Choose closest to you (e.g., `Oregon (US West)`)
   - **PostgreSQL Version**: 16 (latest)
   - **Plan**: **Free**
3. Click **Create Database**
4. Wait 1-2 minutes for initialization
5. **Copy the Internal Database URL** (looks like: `postgresql://user:pass@host:5432/dbname`)

#### 4. Create Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub repository
3. Select `labourtrackr` repository
4. Configure:
   - **Name**: `labourtrackr`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Root Directory**: (leave blank)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: **Free**

#### 5. Add Environment Variables

Click **Advanced** → **Add Environment Variable**:

```
NODE_ENV=production
PORT=10000
DATABASE_URL=<paste_internal_database_url_from_step_3>
JWT_SECRET=<generate_random_string_here>
SENDGRID_API_KEY=<your_sendgrid_key>
GOOGLE_MAPS_API_KEY=<your_google_maps_key>
SENDGRID_FROM_EMAIL=noreply@labourtrackr.com
```

**To generate JWT_SECRET:**
```bash
# Run this in terminal:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 6. Deploy

1. Click **Create Web Service**
2. Wait 5-10 minutes for first deployment
3. Your app will be live at: `https://labourtrackr.onrender.com`

#### 7. Initialize Database

After deployment succeeds:

1. Go to your Web Service in Render
2. Click **Shell** tab
3. Run: `npm run db:push`
4. Confirm when prompted

**✅ Done!** Your app is now live!

---

## Option 2: Railway

**Best for:** More control, better free tier limits

### Free Tier Limits:
- ✅ $5 free credit monthly (enough for small apps)
- ✅ PostgreSQL included
- ✅ No spin-down (always on)
- ✅ Automatic deployments

### Step-by-Step Deployment:

#### 1. Push to GitHub (same as Render)

#### 2. Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Authorize Railway

#### 3. Create New Project

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Choose your `labourtrackr` repository

#### 4. Add PostgreSQL Database

1. In your project, click **+ New**
2. Select **Database** → **Add PostgreSQL**
3. Railway automatically creates database
4. Click on the database service
5. Go to **Variables** tab
6. Copy the `DATABASE_URL` value

#### 5. Configure Web Service

1. Railway automatically detected your repo
2. Click on the service
3. Go to **Settings** tab
4. Set:
   - **Start Command**: `npm start`
   - **Build Command**: `npm run build`

#### 6. Add Environment Variables

Go to **Variables** tab, add:

```
NODE_ENV=production
DATABASE_URL=<paste_from_database_service>
JWT_SECRET=<generate_random_string>
SENDGRID_API_KEY=<your_key>
GOOGLE_MAPS_API_KEY=<your_key>
SENDGRID_FROM_EMAIL=noreply@labourtrackr.com
```

#### 7. Deploy

1. Railway auto-deploys on push
2. Or click **Deploy** button
3. Wait for deployment
4. Click **Generate Domain** to get your URL

#### 8. Initialize Database

1. Click on your service
2. Click **Deployments** → **View Logs**
3. Or use Railway CLI:
   ```bash
   npm install -g @railway/cli
   railway login
   railway link
   railway run npm run db:push
   ```

**✅ Done!**

---

## Option 3: Fly.io

**Best for:** Global edge deployment, Docker support

### Free Tier Limits:
- ✅ 3 shared-cpu VMs
- ✅ 3GB persistent volumes
- ✅ 160GB outbound data transfer
- ✅ PostgreSQL included

### Step-by-Step Deployment:

#### 1. Install Fly CLI

```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Mac/Linux
curl -L https://fly.io/install.sh | sh
```

#### 2. Create Fly Account

```bash
fly auth signup
```

#### 3. Create Fly App

```bash
cd /path/to/labourtrackr
fly launch
```

Follow prompts:
- App name: `labourtrackr` (or auto-generated)
- Region: Choose closest
- PostgreSQL: Yes
- Redis: No

#### 4. Create fly.toml

Create `fly.toml` in project root:

```toml
app = "labourtrackr"
primary_region = "iad"

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

  [[services.http_checks]]
    interval = "10s"
    timeout = "2s"
    grace_period = "5s"
    method = "GET"
    path = "/"
```

#### 5. Set Secrets (Environment Variables)

```bash
fly secrets set JWT_SECRET="<your_secret>"
fly secrets set SENDGRID_API_KEY="<your_key>"
fly secrets set GOOGLE_MAPS_API_KEY="<your_key>"
fly secrets set SENDGRID_FROM_EMAIL="noreply@labourtrackr.com"
```

Get database URL:
```bash
fly postgres connect -a labourtrackr-db
# Or get connection string:
fly postgres connect -a labourtrackr-db -c "SELECT current_database();"
```

#### 6. Deploy

```bash
fly deploy
```

#### 7. Initialize Database

```bash
fly ssh console
npm run db:push
```

**✅ Done!**

---

## Prerequisites

Before deploying, you need these free services:

### 1. SendGrid (Email) - FREE

1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up (free tier: 100 emails/day)
3. Go to **Settings** → **API Keys**
4. Create API Key
5. Copy the key (save it, you can't see it again!)

### 2. Google Maps API - FREE (with credits)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project
3. Enable **Maps JavaScript API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Restrict the key to your domain (optional but recommended)
6. Google gives $200 free credit monthly (enough for most apps)

### 3. GitHub Account - FREE

1. Go to [github.com](https://github.com)
2. Sign up (free)
3. Create new repository

---

## Database Setup

### Option A: Use Render/Railway/Fly PostgreSQL (Recommended)

- Included in free tiers
- Automatically managed
- No setup needed

### Option B: Neon (Free PostgreSQL) - Alternative

1. Go to [neon.tech](https://neon.tech)
2. Sign up (free tier: 0.5GB storage)
3. Create project
4. Copy connection string
5. Use as `DATABASE_URL`

### Option C: Supabase (Free PostgreSQL) - Alternative

1. Go to [supabase.com](https://supabase.com)
2. Sign up (free tier: 500MB database)
3. Create project
4. Go to **Settings** → **Database**
5. Copy connection string (use connection pooling URL)

---

## Environment Variables

Create a `.env` file locally (for testing) or set in hosting platform:

```env
# Required
NODE_ENV=production
PORT=10000  # Render uses 10000, Railway/Fly auto-assign
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your_random_32_char_string_here
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
GOOGLE_MAPS_API_KEY=AIzaSyxxxxxxxxxxxxx

# Optional
SENDGRID_FROM_EMAIL=noreply@labourtrackr.com
SESSION_SECRET=another_random_string
```

**Generate secrets:**
```bash
# JWT_SECRET (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# SESSION_SECRET (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Post-Deployment Steps

### 1. Initialize Database Schema

After first deployment, run:

```bash
# On Render: Use Shell tab
npm run db:push

# On Railway: Use CLI or Deployments → View Logs
railway run npm run db:push

# On Fly.io: Use SSH
fly ssh console
npm run db:push
```

### 2. Create First Admin Account

You'll need to create the first admin manually. Options:

**Option A: Add to database directly**
```sql
-- Connect to your database and run:
INSERT INTO admins (email, password, first_name, last_name, created_at)
VALUES (
  'admin@example.com',
  '$2b$10$hashed_password_here',  -- Use bcrypt to hash your password
  'Admin',
  'User',
  NOW()
);
```

**Option B: Add signup endpoint temporarily**
- Temporarily allow admin signup
- Create account
- Disable signup again

**Option C: Use database admin tool**
- Use Render/Railway database dashboard
- Or use pgAdmin/DBeaver to connect

### 3. Test Your Deployment

1. ✅ Visit your app URL
2. ✅ Test admin login
3. ✅ Create an employee
4. ✅ Create a work site
5. ✅ Test employee login
6. ✅ Test location tracking
7. ✅ Test check-in/check-out

### 4. Configure Custom Domain (Optional)

**Render:**
1. Go to Web Service → Settings → Custom Domains
2. Add your domain
3. Update DNS records as instructed
4. SSL certificate auto-provisions

**Railway:**
1. Go to Settings → Networking
2. Add custom domain
3. Update DNS
4. SSL auto-provisions

**Fly.io:**
```bash
fly certs add yourdomain.com
# Then update DNS
```

---

## Troubleshooting

### Build Fails

**Error: "Cannot find module"**
- Check `package.json` has all dependencies
- Run `npm install` locally to verify
- Check build logs for specific missing module

**Error: "TypeScript errors"**
- Run `npm run check` locally
- Fix TypeScript errors before deploying

### Database Connection Fails

**Error: "Connection refused"**
- Verify `DATABASE_URL` is correct
- Use **Internal Database URL** on Render (not External)
- Check database is in same region as web service
- Verify database is running (not paused)

**Error: "Authentication failed"**
- Check database credentials in `DATABASE_URL`
- Verify database user has correct permissions

### App Not Starting

**Error: "Port already in use"**
- Ensure your code uses: `process.env.PORT || 5000`
- Render uses port `10000`
- Railway/Fly auto-assign ports

**Error: "Module not found"**
- Check `package.json` dependencies
- Verify build completed successfully
- Check `dist/` folder exists after build

### Location/GPS Not Working

**Error: "Geolocation not supported"**
- Test on HTTPS (required for geolocation)
- Test on mobile device (better GPS)
- Check browser permissions

**Error: "Google Maps not loading"**
- Verify `GOOGLE_MAPS_API_KEY` is set
- Check API key restrictions
- Enable Maps JavaScript API in Google Cloud

### Images Not Uploading

**Error: "Upload failed"**
- Check file size limits
- Verify storage service (Supabase/Google Cloud) credentials
- Check upload directory permissions

---

## Cost Comparison

| Platform | Free Tier | Best For |
|----------|-----------|----------|
| **Render** | ✅ Web + DB (90 days) | Beginners, easiest setup |
| **Railway** | ✅ $5 credit/month | Better free tier, always on |
| **Fly.io** | ✅ 3 VMs, 3GB storage | Global edge, Docker |
| **Neon** | ✅ 0.5GB PostgreSQL | Database only |
| **Supabase** | ✅ 500MB PostgreSQL | Database + Auth |

**Recommended:** Start with **Render** (easiest), migrate to **Railway** if you need always-on.

---

## Quick Start Checklist

- [ ] Code pushed to GitHub
- [ ] Render/Railway/Fly account created
- [ ] PostgreSQL database created
- [ ] SendGrid API key obtained
- [ ] Google Maps API key obtained
- [ ] Environment variables set
- [ ] App deployed successfully
- [ ] Database schema initialized
- [ ] First admin account created
- [ ] Tested all features
- [ ] Custom domain configured (optional)

---

## Support & Resources

- **Render Docs**: https://render.com/docs
- **Railway Docs**: https://docs.railway.app
- **Fly.io Docs**: https://fly.io/docs
- **SendGrid Docs**: https://docs.sendgrid.com
- **Google Maps Docs**: https://developers.google.com/maps

---

## 🎉 Congratulations!

Your LabourTrackr app is now live and free! 

**Next Steps:**
1. Share your app URL with team
2. Create employee accounts
3. Set up work sites
4. Start tracking!

**Need Help?**
- Check deployment logs
- Review troubleshooting section
- Check platform documentation

---

**Happy Deploying! 🚀**


