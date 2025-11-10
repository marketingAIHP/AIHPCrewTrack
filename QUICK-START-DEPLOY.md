# Quick Start: Deploy AIHP CrewTrack to Render

## What You Need
- GitHub account
- Render account (free signup at render.com)
- SendGrid API key
- 15 minutes

## Step 1: Push to GitHub (2 minutes)

### Create GitHub Repository
1. Go to github.com → New -repository
2. Name: `aihp-crewtrack`
3. **Don't** check "Initialize with README"
4. Click "Create repository"

### Push Your Code
Copy your repository URL, then in Replit Shell:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/aihp-crewtrack.git
git branch -M main
git push -u origin main
```

**Note:** If asked for credentials:
- Username: your GitHub username
- Password: use a Personal Access Token (not your password)
  - Get token at: Settings → Developer settings → Personal access tokens

## Step 2: Deploy to Render (10 minutes)

### A. Create Database (2 min)
1. Go to dashboard.render.com → New + → PostgreSQL
2. Name: `aihp-crewtrack-db`
3. Database: `crewtrack`
4. Plan: Free (or Starter for production)
5. Click "Create Database"
6. **COPY the Internal Database URL** (you'll need it in step B4)

### B. Create Web Service (3 min)
1. New + → Web Service
2. Connect your GitHub repository
3. Select `aihp-crewtrack` repo
4. Configure:
   ```
   Name: aihp-crewtrack
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

### C. Add Environment Variables (2 min)
Click "Advanced" and add:
```
NODE_ENV=production
DATABASE_URL=<paste the Internal Database URL from step A6>
SENDGRID_API_KEY=<your SendGrid API key>
```

### D. Deploy! (5 min)
1. Click "Create Web Service"
2. Wait for build to complete (5-10 minutes first time)
3. Your app will be live at: `https://aihp-crewtrack.onrender.com`

## Step 3: Initialize Database (2 minutes)

After deployment completes:

### Option 1: In Replit
```bash
# Set DATABASE_URL to your Render database URL
export DATABASE_URL="<your Render database URL>"
npm run db:push
```

### Option 2: In Render Shell
1. Go to your Web Service → Shell tab
2. Run: `npm run db:push`

## Done! 🎉

Your app is live at: **https://aihp-crewtrack.onrender.com**

### Next Steps
1. Test the app by visiting the URL
2. Create your first admin account
3. Set up work sites and areas
4. Add employees
5. Start tracking!

## Auto-Deploy

Any time you push to GitHub, Render automatically redeploys:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

## Need Help?
- Full guide: See DEPLOYMENT.md
- Render docs: render.com/docs
- Logs: Check Render dashboard → Logs tab

---

**Estimated Total Time: 15 minutes**
**Cost: Free tier or $14/month for production**
