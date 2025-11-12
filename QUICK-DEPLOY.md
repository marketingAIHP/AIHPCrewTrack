# ⚡ Quick Deploy Guide - 5 Minutes

## Fastest Way to Deploy (Render)

### Step 1: Push to GitHub (2 min)

```bash
# If not already a git repo
git init
git add .
git commit -m "Ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/labourtrackr.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Render (3 min)

1. **Go to [render.com](https://render.com)** → Sign up with GitHub

2. **Create Database:**
   - Click **New +** → **PostgreSQL**
   - Name: `labourtrackr-db`
   - Plan: **Free**
   - Click **Create**
   - **Copy the Internal Database URL**

3. **Create Web Service:**
   - Click **New +** → **Web Service**
   - Connect your GitHub repo
   - Select `labourtrackr`
   - Settings:
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Plan**: **Free**

4. **Add Environment Variables:**
  ```
  NODE_ENV=production
  PORT=10000
  DATABASE_URL=<your_database_connection_string>
  JWT_SECRET=<generate_with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
  SENDGRID_API_KEY=<your_sendgrid_api_key>
  GOOGLE_MAPS_API_KEY=<your_google_maps_api_key>
  SENDGRID_FROM_EMAIL=<noreply@yourdomain.com>
  APP_BASE_URL=https://aihp.in
  ```

5. **Click Create Web Service** → Wait 5-10 min

### Step 3: Initialize Database (1 min)

1. Go to your Web Service → **Shell** tab
2. Run: `npm run db:push`
3. Confirm when prompted

### Step 4: Create Admin Account

**Option A: Use Script (Recommended)**
```bash
# In Render Shell or locally with DATABASE_URL set
npm run create-admin
```

**Option B: Manual SQL**
```sql
-- Connect to database and run:
INSERT INTO admins (email, password, first_name, last_name, created_at)
VALUES (
  'admin@example.com',
  '$2b$10$hashed_password',  -- Use online bcrypt generator
  'Admin',
  'User',
  NOW()
);
```

### Step 5: Connect Your Domain `aihp.in` (4 min)

1. In Render → your Web Service → **Settings** tab → **Custom Domains** → **Add Custom Domain**.
2. Enter `aihp.in` and click **Save**. Render will show required DNS records.
3. In your domain registrar (where `aihp.in` is managed), update DNS:
   - For the root domain (`aihp.in`), add an **ALIAS/ANAME** or **A** record pointing to the Render IP provided.
   - For `www.aihp.in`, add a **CNAME** record pointing to `YOUR-SERVICE.onrender.com` (value shown in Render).
4. Back in Render, click **Verify** once DNS changes propagate (can take up to 30 minutes). Render automatically provisions an SSL certificate.
5. Optional: in Render → **Environment** tab, add `APP_BASE_URL=https://aihp.in` if your app reads it.

### ✅ Done!

Your app is live at: `https://aihp.in`

---

## Get Free API Keys

### SendGrid (Email) - 2 min
1. Go to [sendgrid.com](https://sendgrid.com) → Sign up
2. Settings → API Keys → Create API Key
3. Copy the key

### Google Maps - 3 min
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project → Enable Maps JavaScript API
3. Credentials → Create API Key
4. Copy the key

---

## Troubleshooting

**Build fails?**
- Check logs in Render dashboard
- Verify all dependencies in `package.json`

**Database connection fails?**
- Use **Internal Database URL** (not External)
- Check database is in same region

**App not starting?**
- Check logs for errors
- Verify PORT is set to 10000
- Ensure build completed successfully

---

**Need more details?** See [FREE-DEPLOYMENT-GUIDE.md](./FREE-DEPLOYMENT-GUIDE.md)

