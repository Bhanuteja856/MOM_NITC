require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const { cloudinary } = require('./cloudinary');
const Alumni = require('../models/alumni');
const Admin = require('../models/Admin');
const Event = require('../models/Event');
const Gallery = require('../models/Gallery');
const Magazine = require('../models/Magazine');
const Video = require('../models/Video');

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
const mongoDbName = process.env.MONGO_DB_NAME || 'mca_alumni_portal';

if (!mongoUri) {
  console.error('❌ MONGO_URI or MONGO_URL not found in .env');
  process.exit(1);
}

const PUBLIC_DIR = path.resolve(__dirname, '../public');

/**
 * Uploads a local file or base64 data to Cloudinary
 * @param {string} val local path starting with /uploads/ OR base64 data
 * @param {string} folder subfolder in Cloudinary
 * @param {string} resourceType 'image' | 'video' | 'raw' | 'auto'
 * @returns {Promise<string|null>} Cloudinary secure_url, or null if failed
 */
async function uploadToCloudinary(val, folder, resourceType = 'auto') {
  if (!val || typeof val !== 'string') return null;

  // Already a Cloudinary URL
  if (val.includes('res.cloudinary.com')) {
    return val;
  }

  try {
    if (val.startsWith('/uploads/')) {
      // It is a local file
      const absolutePath = path.resolve(path.join(PUBLIC_DIR, val));
      if (!fs.existsSync(absolutePath)) {
        console.warn(`⚠️ Local file not found: ${absolutePath}`);
        return null;
      }
      
      const result = await cloudinary.uploader.upload(absolutePath, {
        folder: `alumni_portal/${folder}`,
        resource_type: resourceType
      });
      console.log(`✅ Uploaded local file ${val} -> ${result.secure_url}`);
      return result.secure_url;
    } else if (val.startsWith('data:image')) {
      // It is a base64 string
      const result = await cloudinary.uploader.upload(val, {
        folder: `alumni_portal/${folder}`,
        resource_type: 'image'
      });
      console.log(`✅ Uploaded base64 image -> ${result.secure_url}`);
      return result.secure_url;
    }
  } catch (error) {
    console.error(`❌ Failed to upload ${val.substring(0, 50)}... to Cloudinary:`, error.message);
  }
  return null;
}

async function migrateAlumni() {
  console.log('\n--- Migrating Alumni Profiles ---');
  const records = await Alumni.find({
    $or: [
      { profileImage: { $regex: /^\/uploads\// } },
      { profileImage: { $regex: /^data:image/ } }
    ]
  });
  console.log(`Found ${records.length} alumni records to migrate.`);
  
  let successCount = 0;
  for (const doc of records) {
    const cloudUrl = await uploadToCloudinary(doc.profileImage, 'profile', 'image');
    if (cloudUrl) {
      doc.profileImage = cloudUrl;
      await doc.save({ validateBeforeSave: false });
      successCount++;
    }
  }
  console.log(`Alumni migration complete: ${successCount}/${records.length} succeeded.`);
}

async function migrateAdmins() {
  console.log('\n--- Migrating Admin Profiles & Custom Graphics ---');
  const records = await Admin.find({});
  console.log(`Found ${records.length} admin records to inspect.`);
  
  let successCount = 0;
  for (const doc of records) {
    let updated = false;

    // 1. Profile image
    if (doc.profileImage && (doc.profileImage.startsWith('/uploads/') || doc.profileImage.startsWith('data:image'))) {
      const cloudUrl = await uploadToCloudinary(doc.profileImage, 'profile', 'image');
      if (cloudUrl) {
        doc.profileImage = cloudUrl;
        updated = true;
      }
    }

    // 2. aboutUsSliderImages
    if (doc.aboutUsSliderImages && doc.aboutUsSliderImages.length > 0) {
      for (const item of doc.aboutUsSliderImages) {
        if (item.imageUrl && (item.imageUrl.startsWith('/uploads/') || item.imageUrl.startsWith('data:image'))) {
          const cloudUrl = await uploadToCloudinary(item.imageUrl, 'aboutus', 'image');
          if (cloudUrl) {
            item.imageUrl = cloudUrl;
            updated = true;
          }
        }
      }
    }

    // 3. sideImages
    if (doc.sideImages && doc.sideImages.length > 0) {
      for (const item of doc.sideImages) {
        if (item.imageUrl && (item.imageUrl.startsWith('/uploads/') || item.imageUrl.startsWith('data:image'))) {
          const cloudUrl = await uploadToCloudinary(item.imageUrl, 'index', 'image');
          if (cloudUrl) {
            item.imageUrl = cloudUrl;
            updated = true;
          }
        }
      }
    }

    if (updated) {
      await doc.save({ validateBeforeSave: false });
      successCount++;
    }
  }
  console.log(`Admin migration complete: ${successCount} records updated.`);
}

async function migrateEvents() {
  console.log('\n--- Migrating Events ---');
  const records = await Event.find({
    $or: [
      { image: { $regex: /^\/uploads\// } },
      { image: { $regex: /^data:image/ } }
    ]
  });
  console.log(`Found ${records.length} event records to migrate.`);
  
  let successCount = 0;
  for (const doc of records) {
    const cloudUrl = await uploadToCloudinary(doc.image, 'events', 'image');
    if (cloudUrl) {
      doc.image = cloudUrl;
      await doc.save({ validateBeforeSave: false });
      successCount++;
    }
  }
  console.log(`Event migration complete: ${successCount}/${records.length} succeeded.`);
}

async function migrateGallery() {
  console.log('\n--- Migrating Gallery ---');
  const records = await Gallery.find({
    imageUrl: { $regex: /^\/uploads\// }
  });
  console.log(`Found ${records.length} gallery records to migrate.`);
  
  let successCount = 0;
  for (const doc of records) {
    const cloudUrl = await uploadToCloudinary(doc.imageUrl, 'gallery', 'image');
    if (cloudUrl) {
      doc.imageUrl = cloudUrl;
      await doc.save({ validateBeforeSave: false });
      successCount++;
    }
  }
  console.log(`Gallery migration complete: ${successCount}/${records.length} succeeded.`);
}

async function migrateMagazines() {
  console.log('\n--- Migrating Magazines ---');
  const records = await Magazine.find({
    $or: [
      { coverImage: { $regex: /^\/uploads\// } },
      { coverImage: { $regex: /^data:image/ } }
    ]
  });
  console.log(`Found ${records.length} magazine records to migrate.`);
  
  let successCount = 0;
  for (const doc of records) {
    const cloudUrl = await uploadToCloudinary(doc.coverImage, 'magazines', 'image');
    if (cloudUrl) {
      doc.coverImage = cloudUrl;
      await doc.save({ validateBeforeSave: false });
      successCount++;
    }
  }
  console.log(`Magazine migration complete: ${successCount}/${records.length} succeeded.`);
}

async function migrateVideos() {
  console.log('\n--- Migrating Videos & Thumbnails ---');
  const records = await Video.find({
    $or: [
      { videoUrl: { $regex: /^\/uploads\// } },
      { thumbnailUrl: { $regex: /^\/uploads\// } }
    ]
  });
  console.log(`Found ${records.length} video records to inspect.`);
  
  let successCount = 0;
  for (const doc of records) {
    let updated = false;

    if (doc.videoUrl && doc.videoUrl.startsWith('/uploads/')) {
      const cloudUrl = await uploadToCloudinary(doc.videoUrl, 'videos', 'video');
      if (cloudUrl) {
        doc.videoUrl = cloudUrl;
        updated = true;
      }
    }

    if (doc.thumbnailUrl && doc.thumbnailUrl.startsWith('/uploads/')) {
      const cloudUrl = await uploadToCloudinary(doc.thumbnailUrl, 'thumbnails', 'image');
      if (cloudUrl) {
        doc.thumbnailUrl = cloudUrl;
        updated = true;
      }
    }

    if (updated) {
      await doc.save({ validateBeforeSave: false });
      successCount++;
    }
  }
  console.log(`Video migration complete: ${successCount}/${records.length} records updated.`);
}

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, { dbName: mongoDbName });
    console.log('MongoDB Connected successfully.');

    await migrateAlumni();
    await migrateAdmins();
    await migrateEvents();
    await migrateGallery();
    await migrateMagazines();
    await migrateVideos();

    console.log('\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Migration failed with error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

run();
