import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import fs from "fs";
import type { Request, Response } from "express";

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SERVICE_ROLE_SECRET) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Required: SUPABASE_URL and SERVICE_ROLE_SECRET');
}

const supabase = process.env.SUPABASE_URL && process.env.SERVICE_ROLE_SECRET
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SERVICE_ROLE_SECRET
    )
  : null;

const upload = multer({ dest: "uploads/" });

export const uploadMiddleware = upload.single("file");

/**
 * Extract filename from Supabase storage URL
 * Example: https://xxx.supabase.co/storage/v1/object/public/profile-images/1234567890_photo.jpg
 * Returns: 1234567890_photo.jpg
 */
function extractFileNameFromSupabaseUrl(url: string): string | null {
  try {
    // Check if it's a Supabase storage URL
    if (!url.includes('supabase.co/storage/v1/object/public/profile-images/')) {
      return null;
    }
    
    // Extract filename from URL
    const urlParts = url.split('/profile-images/');
    if (urlParts.length < 2) {
      return null;
    }
    
    // Get filename and remove query parameters
    const filename = urlParts[1].split('?')[0];
    return filename || null;
  } catch (error) {
    console.error('Error extracting filename from Supabase URL:', error);
    return null;
  }
}

/**
 * Delete an image from Supabase storage
 * @param imageUrl - The full Supabase storage URL or just the filename
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteImageFromSupabase(imageUrl: string | null | undefined): Promise<boolean> {
  if (!imageUrl || !supabase) {
    return false;
  }

  try {
    // Extract filename from URL
    let fileName: string | null = null;
    
    // Check if it's already just a filename
    if (!imageUrl.includes('http') && !imageUrl.includes('/')) {
      fileName = imageUrl;
    } else {
      // Extract from Supabase URL
      fileName = extractFileNameFromSupabaseUrl(imageUrl);
    }

    if (!fileName) {
      console.warn('⚠️ Could not extract filename from URL:', imageUrl);
      return false;
    }

    console.log('🗑️ Deleting old image from Supabase Storage:', fileName);

    const { error } = await supabase.storage
      .from("profile-images")
      .remove([fileName]);

    if (error) {
      // If file doesn't exist, that's okay - it might have been deleted already
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        console.log('ℹ️ Image not found in storage (may have been deleted already):', fileName);
        return true; // Consider it successful since the goal is to remove it
      }
      console.error('❌ Error deleting image from Supabase:', error);
      return false;
    }

    console.log('✅ Successfully deleted old image from Supabase Storage:', fileName);
    return true;
  } catch (error) {
    console.error('❌ Error deleting image from Supabase:', error);
    return false;
  }
}

export const uploadProfileImage = async (req: Request, res: Response) => {
  try {
    // Check if Supabase is configured
    if (!supabase) {
      console.error("❌ Supabase not configured. Check SUPABASE_URL and SERVICE_ROLE_SECRET environment variables.");
      return res.status(500).json({ 
        error: "Upload service not configured", 
        details: "Missing SUPABASE_URL or SERVICE_ROLE_SECRET environment variables" 
      });
    }

    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const filePath = file.path;
    const fileName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    
    // Ensure uploads directory exists
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: "File not found after upload" });
    }

    const fileBuffer = fs.readFileSync(filePath);

    console.log('📤 Uploading to Supabase Storage:', fileName);
    console.log('📊 File size:', fileBuffer.length, 'bytes');
    console.log('📄 Content type:', file.mimetype);

    const { data, error } = await supabase.storage
      .from("profile-images")
      .upload(fileName, fileBuffer, {
        cacheControl: "3600",
        upsert: true, // Allow overwrite if file exists
        contentType: file.mimetype || 'image/jpeg',
      });

    if (error) {
      console.error("❌ Supabase upload error:", error);
      console.error("❌ Error details:", JSON.stringify(error, null, 2));
      fs.unlinkSync(filePath); // Clean up temp file
      return res.status(500).json({ 
        error: "Upload failed", 
        details: error.message || "Unknown Supabase error" 
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from("profile-images")
      .getPublicUrl(fileName);

    // Clean up temp file
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.warn("⚠️ Failed to cleanup temp file:", cleanupError);
    }

    console.log('✅ Upload successful! Public URL:', publicUrlData.publicUrl);

    return res.status(200).json({
      message: "Profile image uploaded successfully",
      profileImage: publicUrlData.publicUrl,
      url: publicUrlData.publicUrl,
      uploadURL: publicUrlData.publicUrl,
    });
  } catch (err: any) {
    console.error("❌ Server error while uploading image:", err);
    console.error("❌ Error stack:", err?.stack);
    // Clean up temp file if it exists
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    return res.status(500).json({ 
      error: "Server error while uploading image",
      details: err?.message || "Unknown server error"
    });
  }
};

/**
 * Extract filename from Supabase storage URL for work site images
 * Example: https://xxx.supabase.co/storage/v1/object/public/Work Site Images/site_1234567890_photo.jpg
 * Returns: site_1234567890_photo.jpg
 */
function extractSiteImageFileNameFromSupabaseUrl(url: string): string | null {
  try {
    // Check if it's a Supabase storage URL for work site images
    const bucketName = 'Work Site Images';
    const encodedBucket = encodeURIComponent(bucketName);
    if (!url.includes(`supabase.co/storage/v1/object/public/${encodedBucket}/`)) {
      return null;
    }
    
    // Extract filename from URL
    const urlParts = url.split(`/${encodedBucket}/`);
    if (urlParts.length < 2) {
      return null;
    }
    
    // Get filename and remove query parameters
    const filename = decodeURIComponent(urlParts[1].split('?')[0]);
    return filename || null;
  } catch (error) {
    console.error('Error extracting site image filename from Supabase URL:', error);
    return null;
  }
}

/**
 * Delete a work site image from Supabase storage
 * @param imageUrl - The full Supabase storage URL or just the filename
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteSiteImageFromSupabase(imageUrl: string | null | undefined): Promise<boolean> {
  if (!imageUrl || !supabase) {
    return false;
  }

  try {
    // Extract filename from URL
    let fileName: string | null = null;
    
    // Check if it's already just a filename
    if (!imageUrl.includes('http') && !imageUrl.includes('/')) {
      fileName = imageUrl;
    } else {
      // Extract from Supabase URL
      fileName = extractSiteImageFileNameFromSupabaseUrl(imageUrl);
    }

    if (!fileName) {
      console.warn('⚠️ Could not extract site image filename from URL:', imageUrl);
      return false;
    }

    console.log('🗑️ Deleting old site image from Supabase Storage:', fileName);

    const bucketName = "Work Site Images";
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      // If file doesn't exist, that's okay - it might have been deleted already
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        console.log('ℹ️ Site image not found in storage (may have been deleted already):', fileName);
        return true; // Consider it successful since the goal is to remove it
      }
      console.error('❌ Error deleting site image from Supabase:', error);
      return false;
    }

    console.log('✅ Successfully deleted old site image from Supabase Storage:', fileName);
    return true;
  } catch (error) {
    console.error('❌ Error deleting site image from Supabase:', error);
    return false;
  }
}

export const uploadSiteImage = async (req: Request, res: Response) => {
  try {
    // Check if Supabase is configured
    if (!supabase) {
      console.error("❌ Supabase not configured. Check SUPABASE_URL and SERVICE_ROLE_SECRET environment variables.");
      return res.status(500).json({ 
        error: "Upload service not configured", 
        details: "Missing SUPABASE_URL or SERVICE_ROLE_SECRET environment variables" 
      });
    }

    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const filePath = file.path;
    const fileName = `site_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: "File not found after upload" });
    }

    const fileBuffer = fs.readFileSync(filePath);

    console.log('📤 Uploading site image to Supabase Storage bucket "Work Site Images":', fileName);

    const bucketName = "Work Site Images";
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.mimetype || 'image/jpeg',
      });

    if (error) {
      console.error("❌ Supabase upload error:", error);
      fs.unlinkSync(filePath);
      return res.status(500).json({ error: "Upload failed", details: error.message });
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.warn("⚠️ Failed to cleanup temp file:", cleanupError);
    }

    console.log('✅ Site image upload successful! Public URL:', publicUrlData.publicUrl);

    return res.status(200).json({
      message: "Site image uploaded successfully",
      siteImage: publicUrlData.publicUrl,
      url: publicUrlData.publicUrl,
      uploadURL: publicUrlData.publicUrl,
    });
  } catch (err: any) {
    console.error("❌ Server error while uploading site image:", err);
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    return res.status(500).json({ 
      error: "Server error while uploading image",
      details: err?.message || "Unknown server error"
    });
  }
};

