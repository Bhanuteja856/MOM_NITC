const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Helper to upload a buffer via stream to Cloudinary
 * @param {Buffer} buffer 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
const uploadStream = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
};

/**
 * Compresses base64 image and uploads to Cloudinary
 * @param {string} base64String 
 * @param {string} folder 
 * @param {number} maxWidth 
 * @returns {Promise<string>} secure_url or original base64String if failed
 */
async function uploadBase64ImageToCloudinary(base64String, folder, maxWidth = 1200) {
  if (!base64String || typeof base64String !== 'string') {
    return base64String;
  }
  // If it's already an external/Cloudinary URL, return it
  if (base64String.startsWith('http://') || base64String.startsWith('https://')) {
    return base64String;
  }
  if (!base64String.startsWith('data:image')) {
    return base64String;
  }

  try {
    const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64String;

    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    // Compress the image using sharp (same optimization logic as saveBase64ImageLocal)
    const compressedBuffer = await sharp(imageBuffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const uploadOptions = {
      folder: `alumni_portal/${folder}`,
      resource_type: 'image',
      format: 'webp'
    };

    const result = await uploadStream(compressedBuffer, uploadOptions);
    console.log(`📸 Image uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error('Failed to upload base64 image to Cloudinary:', error);
    return base64String; // Fallback to base64 if upload fails
  }
}

/**
 * Uploads a local file to Cloudinary and deletes the local file afterwards
 * @param {string} localFilePath 
 * @param {string} folder 
 * @param {string} resourceType 'image' | 'video' | 'raw' | 'auto'
 * @returns {Promise<string>} secure_url
 */
async function uploadLocalFileToCloudinary(localFilePath, folder, resourceType = 'auto') {
  try {
    let result;
    if (resourceType === 'video') {
      console.log(`🎥 Uploading large video chunked to Cloudinary: ${localFilePath}`);
      result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_large(
          localFilePath,
          {
            folder: `alumni_portal/${folder}`,
            resource_type: 'video',
            chunk_size: 20 * 1024 * 1024 // 20MB chunks
          },
          (error, res) => {
            if (error) return reject(error);
            resolve(res);
          }
        );
      });
    } else {
      result = await cloudinary.uploader.upload(localFilePath, {
        folder: `alumni_portal/${folder}`,
        resource_type: resourceType
      });
    }
    
    // Clean up local file
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      console.log(`🗑️ Deleted local temp file: ${localFilePath}`);
    }
    
    console.log(`🎥 File uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error(`Failed to upload local file to Cloudinary: ${localFilePath}`, error);
    // Try to cleanup even on failure
    if (fs.existsSync(localFilePath)) {
      try { fs.unlinkSync(localFilePath); } catch (e) {}
    }
    throw error;
  }
}

/**
 * Extracts public_id from Cloudinary URL and deletes the resource
 * @param {string} cloudinaryUrl 
 * @param {string} resourceType 'image' | 'video' | 'raw'
 */
async function deleteFromCloudinary(cloudinaryUrl, resourceType = 'image') {
  if (!cloudinaryUrl || typeof cloudinaryUrl !== 'string' || !cloudinaryUrl.includes('res.cloudinary.com')) {
    return;
  }
  try {
    // Extract public_id from url
    const uploadIndex = cloudinaryUrl.indexOf('/upload/');
    if (uploadIndex === -1) return;
    
    let pathAfterUpload = cloudinaryUrl.substring(uploadIndex + 8);
    // Remove version prefix v[digits]/ if present
    if (pathAfterUpload.match(/^v\d+\//)) {
      pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');
    }
    
    // Remove the file extension (e.g. .webp, .mp4) to get the public_id
    const lastDotIndex = pathAfterUpload.lastIndexOf('.');
    const publicId = lastDotIndex !== -1 ? pathAfterUpload.substring(0, lastDotIndex) : pathAfterUpload;
    
    console.log(`🗑️ Deleting from Cloudinary. public_id: ${publicId}`);
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`🗑️ Cloudinary destroy result:`, result);
  } catch (error) {
    console.error(`Failed to delete from Cloudinary: ${cloudinaryUrl}`, error);
  }
}

module.exports = {
  cloudinary,
  uploadBase64ImageToCloudinary,
  uploadLocalFileToCloudinary,
  deleteFromCloudinary
};
