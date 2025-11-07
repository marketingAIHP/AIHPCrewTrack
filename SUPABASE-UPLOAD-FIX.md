# Fix Supabase Upload Error

## Problem
Getting `500 Internal Server Error` when uploading profile images. Error shows:
- `POST http://localhost:5000/api/upload 500 (Internal Server Error)`
- `Upload error: Error: Failed to upload image to Supabase`

## Root Cause
The Supabase environment variables are missing or not set correctly.

## Solution

### Step 1: Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL** → This is your `SUPABASE_URL`
   - **service_role** key (under "Project API keys") → This is your `SERVICE_ROLE_SECRET`
   - ⚠️ **Important**: Use the `service_role` key, NOT the `anon` key!

### Step 2: Create/Update `.env` File

Create a `.env` file in the **project root** (same folder as `package.json`) with:

```env
# Existing variables (if you have them)
DATABASE_URL=your_postgresql_connection_string
SENDGRID_API_KEY=your_sendgrid_api_key
NODE_ENV=development
PORT=5000

# Add these Supabase variables:
SUPABASE_URL=https://your-project-id.supabase.co
SERVICE_ROLE_SECRET=eyJhbGc...your_service_role_secret_key
```

### Step 3: Verify Bucket Exists

1. In Supabase Dashboard, go to **Storage**
2. Check if a bucket named `profile-images` exists
3. If it doesn't exist:
   - Click **New bucket**
   - Name: `profile-images`
   - **Make it PUBLIC** ✅ (important!)
   - File size limit: 5MB (optional)
   - Allowed MIME types: `image/*` (optional)
   - Click **Create bucket**

### Step 4: Restart Your Server

After adding the environment variables:

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

The server will now read the `.env` file and initialize Supabase correctly.

## Testing

1. Try uploading an image again
2. Check the server console - you should see:
   ```
   📤 Uploading to Supabase Storage: 1234567890_photo.jpg
   ✅ Upload successful! Public URL: https://...
   ```
3. If you still see errors, check the server console for detailed error messages

## Common Issues

### Issue: "Missing SUPABASE_URL or SERVICE_ROLE_SECRET"
**Solution**: Make sure your `.env` file is in the project root and has both variables set.

### Issue: "Bucket not found"
**Solution**: Create the `profile-images` bucket in Supabase Dashboard and make it PUBLIC.

### Issue: "Access denied" or 403 error
**Solution**: 
1. Make sure you're using the `service_role` key (not `anon` key)
2. Make sure the bucket is PUBLIC

### Issue: Environment variables not loading
**Solution**: 
1. Make sure `.env` file is in project root (same folder as `package.json`)
2. Restart the server after adding variables
3. Check that `dotenv` is installed: `npm list dotenv`

## Verification

After setup, the upload should work:
- ✅ Image uploads to Supabase Storage
- ✅ Returns a public URL like: `https://xxx.supabase.co/storage/v1/object/public/profile-images/1234567890_photo.jpg`
- ✅ Profile image updates in database
- ✅ Avatar displays correctly everywhere

## Next Steps

Once upload works:
- Profile images will be stored in Supabase Storage
- Images are publicly accessible via CDN
- No local file storage needed
- Automatic backup and redundancy

---

**Note**: The improved error handling will now show clearer error messages if something is wrong with the Supabase configuration.

