# Cursor AI - Fix Image Upload "Failed to Load" Issue

## 🚨 PROBLEM: Image Upload Shows "Failed to Load Image"

When uploading employee profile images or site images, the upload completes but images fail to display with error: "Failed to load image"

---

## 🔍 ROOT CAUSES & FIXES

### Issue 1: Sharp Image Compression Not Installed Properly

**Fix:**
```bash
# In terminal, run:
npm uninstall sharp
npm install sharp --platform=linux --arch=x64
npm rebuild sharp
```

### Issue 2: Upload Directory Missing or Wrong Path

**Check server/routes.ts upload endpoint:**

```typescript
// Ensure this exists in server/routes.ts
import path from 'path';
import fs from 'fs';

// Create upload directory if it doesn't exist
const uploadDir = path.join(process.cwd(), 'server', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = `${Date.now()}-${req.file.originalname}`;
    const filepath = path.join(uploadDir, filename);
    
    // Compress image with Sharp
    await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath.replace(/\.[^.]+$/, '.webp'));

    const imageUrl = `/uploads/${filename.replace(/\.[^.]+$/, '.webp')}`;
    
    res.json({ 
      success: true, 
      url: imageUrl,
      objectUrl: imageUrl // Some components expect this
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});
```

### Issue 3: Static File Serving Not Configured

**Add to server/index.ts:**

```typescript
import express from 'express';
import path from 'path';

const app = express();

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'server', 'public', 'uploads')));

// Also serve from dist in production
if (process.env.NODE_ENV === 'production') {
  app.use('/uploads', express.static(path.join(process.cwd(), 'dist', 'public', 'uploads')));
}
```

### Issue 4: Frontend Not Handling Upload Response Correctly

**Check your upload component (e.g., ProfileImageUpload):**

```typescript
const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    const data = await response.json();
    console.log('Upload response:', data); // Debug log
    
    // Use the correct property from response
    const imageUrl = data.url || data.objectUrl;
    
    // Update employee/site with image URL
    await updateMutation.mutateAsync({
      profileImage: imageUrl, // or siteImage: imageUrl
    });
    
    toast({
      title: "Success",
      description: "Image uploaded successfully",
    });
  } catch (error) {
    console.error('Upload error:', error);
    toast({
      title: "Error",
      description: "Failed to upload image",
      variant: "destructive",
    });
  }
};
```

### Issue 5: Image Display Component Not Using Correct Path

**Create or fix AuthenticatedImage component:**

```typescript
import { useState } from 'react';

interface AuthenticatedImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: string;
}

export function AuthenticatedImage({ src, alt, className, fallback = '/placeholder.png' }: AuthenticatedImageProps) {
  const [error, setError] = useState(false);
  
  if (!src || error) {
    return <img src={fallback} alt={alt} className={className} />;
  }
  
  // Ensure absolute path
  const imageUrl = src.startsWith('http') ? src : `${window.location.origin}${src}`;
  
  return (
    <img 
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => {
        console.error('Image failed to load:', imageUrl);
        setError(true);
      }}
      loading="lazy"
    />
  );
}
```

### Issue 6: CORS or Authentication Blocking Image Requests

**Ensure images are publicly accessible:**

```typescript
// In server/index.ts - BEFORE authentication middleware
app.use('/uploads', express.static(path.join(process.cwd(), 'server', 'public', 'uploads')));

// Then add authentication for API routes
app.use('/api', authenticateToken);
```

---

## 🎯 COMPLETE DIAGNOSTIC COMMAND FOR CURSOR

```
Fix the image upload "failed to load" issue:

1. READ CURSOR-FIX-IMAGE-UPLOAD.md completely

2. DIAGNOSE the issue:
   - Check server/routes.ts for upload endpoint
   - Verify Sharp is installed: run "npm list sharp" in terminal
   - Check if server/public/uploads directory exists
   - Look for static file serving in server/index.ts
   - Inspect upload response in browser DevTools Network tab

3. FIX Sharp installation:
   npm uninstall sharp
   npm install sharp --platform=linux --arch=x64
   npm rebuild sharp

4. CREATE upload directory:
   - Ensure server/public/uploads exists
   - Create if missing with fs.mkdirSync(uploadDir, { recursive: true })

5. VERIFY server/routes.ts upload endpoint:
   - Uses multer for file upload
   - Processes with Sharp (resize, compress, convert to WebP)
   - Saves to server/public/uploads/
   - Returns correct URL format: /uploads/filename.webp
   - Has proper error handling with console.error logs

6. VERIFY server/index.ts static serving:
   app.use('/uploads', express.static(path.join(process.cwd(), 'server', 'public', 'uploads')));
   - This line MUST come BEFORE authentication middleware
   - Also add production path if NODE_ENV === 'production'

7. FIX frontend upload handler:
   - Use FormData to send file
   - Parse response.url or response.objectUrl correctly
   - Update employee/site record with returned URL
   - Add console.log to debug response
   - Show proper error messages

8. CREATE AuthenticatedImage component:
   - Handles src prop (null, relative path, absolute URL)
   - Converts relative paths to absolute
   - Has error handling with fallback image
   - Logs errors to console for debugging

9. TEST the fix:
   - Upload a test image
   - Check browser DevTools → Network tab for:
     * POST /api/admin/upload (should return 200 with url)
     * GET /uploads/filename.webp (should return 200 with image)
   - Check server console for any Sharp errors
   - Verify image displays in UI
   - Test with both PNG and JPEG files

10. DEBUG checklist if still failing:
    - Run: ls -la server/public/uploads (check files exist)
    - Check file permissions (should be readable)
    - Verify Sharp installed: npm list sharp
    - Check server logs for compression errors
    - Test direct URL: http://localhost:5000/uploads/filename.webp
    - Inspect database - does profileImage column have correct path?
```

---

## 🔧 Quick Test Commands

**Test 1: Check if Sharp is working**
```bash
node -e "const sharp = require('sharp'); console.log('Sharp version:', sharp.versions)"
```

**Test 2: Check upload directory**
```bash
ls -la server/public/uploads
```

**Test 3: Test direct image access**
```
Navigate to: http://localhost:5000/uploads/
Should see directory listing or 404 (not 403)
```

**Test 4: Check server logs**
Look for these in console after upload:
- "Upload received: [filename]"
- "Compressed image saved: [path]"
- Any Sharp errors or "ENOENT" file not found errors

---

## ✅ Expected Result After Fix

- ✅ Upload completes successfully
- ✅ Console shows: "Upload response: { success: true, url: '/uploads/1234567890.webp' }"
- ✅ Network tab shows: GET /uploads/1234567890.webp → 200 OK
- ✅ Image displays in profile card, employee list, and all other places
- ✅ No "Failed to load image" errors
- ✅ Images are compressed and WebP format (smaller file size)

---

## 🐛 If Still Not Working

Add this to server/routes.ts for detailed debugging:

```typescript
app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
  console.log('=== UPLOAD DEBUG ===');
  console.log('File received:', req.file?.originalname);
  console.log('File size:', req.file?.size);
  console.log('Upload dir:', uploadDir);
  console.log('Dir exists:', fs.existsSync(uploadDir));
  
  try {
    // ... rest of upload logic
    
    console.log('File saved to:', filepath);
    console.log('Returning URL:', imageUrl);
    
    res.json({ success: true, url: imageUrl });
  } catch (error) {
    console.error('=== UPLOAD ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({ error: error.message });
  }
});
```

Then check server console logs after attempting upload.
