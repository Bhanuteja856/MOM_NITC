const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Alumni = require('../models/alumni');
const Admin = require('../models/Admin');
const Event = require('../models/Event');
const Gallery = require('../models/Gallery');
const GalleryCategory = Gallery.GalleryCategory;
const Magazine = require('../models/Magazine');
const Announcement = require('../models/Announcement');
const sendEmail = require('../utils/sendemails');
const sharp = require('sharp');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');
const { rateLimit } = require('express-rate-limit');
const {
  uploadBase64ImageToCloudinary,
  uploadLocalFileToCloudinary,
  deleteFromCloudinary
} = require('../utils/cloudinary');

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 minutes
  max: 40, //imit each IP to 40 requests per window
  message: { success: false, message: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // limit each IP to 5 OTP requests per window
  message: { success: false, message: 'Too many OTP requests. Please try again later.' },
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in .env file!');
  process.exit(1);
}

// ============================
// HELPER: Parse Cookies
// ============================
const getCookie = (req, name) => {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
};

// ============================
// MIDDLEWARE: JWT Verification
// ============================
const authenticateToken = (req, res, next) => {
  let token = getCookie(req, 'token'); // Prioritize HttpOnly Cookie

  // Fallback to Authorization header for backward compatibility during transition
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
    if (token === 'null') token = null; // Handle frontend sending 'Bearer null'
  }

  if (!token) return res.status(401).json({ success: false, message: 'Access Denied. No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    req.user = decoded;
    next();
  });
};

// ============================
// MIDDLEWARE: Role Authorization
// ============================
const authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Access Denied. No token provided.' });
    }
    const userRole = req.user.role;
    const isCustomRole = !['super_admin', 'admin', 'faculty', 'alumni'].includes(userRole);
    if (allowedRoles.includes(userRole) || (allowedRoles.includes('admin') && isCustomRole)) {
      return next();
    }
    if (userRole === 'faculty' || isCustomRole) {
      try {
        const adminUser = await Admin.findById(req.user.id);
        if (adminUser && adminUser.isActive) {
          const userMenus = adminUser.accessibleMenus || [];
          let requiredMenu = null;
          if (req.path.includes('/users') || req.path.includes('/add-alumni') || req.path.match(/^\/alumni\/[a-f0-9]+$/i)) {
            requiredMenu = 'Manage Alumni';
          } else if (req.path.includes('/admins') || req.path.includes('/add-admin')) {
            requiredMenu = 'Manage Admins';
          } else if (req.path.includes('/id-card-status') || req.path.includes('/bulk-id-card-status')) {
            requiredMenu = 'Manage ID Cards';
          } else if (req.path.includes('/gallery-categories')) {
            requiredMenu = 'Manage Gallery';
          }
          if (requiredMenu && userMenus.includes(requiredMenu)) {
            return next();
          }
        }
      } catch (err) {
        console.error("Error in authorizeRoles database permission check:", err);
      }
    }
    return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
  };
};

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================
// HELPER: Generate Unique Alumni ID
// ============================
const generateAlumniId = async (batchYear) => {
  const yearStr = batchYear ? batchYear.toString() : '0000';
  const prefix = `MCA${yearStr}`;
  // Find the highest alumniId with this prefix to increment from
  const lastAlumni = await Alumni.findOne({ alumniId: new RegExp(`^${prefix}`) }).sort({ alumniId: -1 });
  let nextNum = 1;
  if (lastAlumni && lastAlumni.alumniId) {
    const lastNumStr = lastAlumni.alumniId.replace(prefix, '');
    const lastNum = parseInt(lastNumStr, 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }
  return `${prefix}${nextNum.toString().padStart(4, '0')}`;
};

// ============================
// MULTER SETUP FOR VIDEOS
// ============================
const videoDir = path.join(__dirname, '../public/uploads/videos');
const thumbDir = path.join(__dirname, '../public/uploads/thumbnails');
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'video') cb(null, videoDir);
    else if (file.fieldname === 'thumbnail') cb(null, thumbDir);
    else cb(new Error('Unexpected field'), false);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') {
      const allowed = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only video files (MP4, WebM, OGG, AVI) are allowed'), false);
      }
    } else if (file.fieldname === 'thumbnail') {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'), false);
      }
    } else {
      cb(new Error('Unexpected field'), false);
    }
  }
});

// ============================
// HELPER: Compress Base64 Images
// ============================
async function compressBase64Image(base64String, maxWidth = 1200) {
  if (!base64String || typeof base64String !== 'string' || !base64String.startsWith('data:image')) {
    return base64String;
  }

  try {
    const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64String;

    const imageBuffer = Buffer.from(matches[2], 'base64');
    const compressedBuffer = await sharp(imageBuffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 80 }) // Convert to WebP for massive space savings
      .toBuffer();

    return `data:image/webp;base64,${compressedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Sharp Image Compression Error:', error);
    return base64String; // Fallback to original if compression fails
  }
}

// ============================
// HELPER: Save Base64 Images (now Cloudinary)
// ============================
async function saveBase64ImageLocal(base64String, subfolder, maxWidth = 1200) {
  return await uploadBase64ImageToCloudinary(base64String, subfolder, maxWidth);
}

// ============================
// HELPER: Safely Delete File (handles Cloudinary and Local)
// ============================
function deleteLocalFile(relativeUrl) {
  if (!relativeUrl || typeof relativeUrl !== 'string') {
    return;
  }
  if (relativeUrl.includes('res.cloudinary.com')) {
    deleteFromCloudinary(relativeUrl, 'image');
    return;
  }
  if (!relativeUrl.startsWith('/uploads/')) {
    return;
  }
  try {
    const publicDir = path.resolve(__dirname, '../public');
    const filePath = path.resolve(path.join(__dirname, '../public', relativeUrl));
    if (filePath.startsWith(publicDir) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted local file: ${relativeUrl}`);
    }
  } catch (e) {
    console.error(`Failed to delete local file ${relativeUrl}:`, e.message);
  }
}

// ============================
// 1. VERIFY ROLL NUMBER (Step 1 of signup)
// ============================
router.post('/verify-roll', async (req, res) => {
  try {
    const { rollNumber } = req.body;

    if (!rollNumber || typeof rollNumber !== 'string') {
      return res.status(400).json({ success: false, message: 'Roll number is required' });
    }
    const normalizedRoll = rollNumber.trim().toUpperCase();

    const alumni = await Alumni.findOne({ rollNumber: normalizedRoll });

    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: 'Roll number not found. Please contact admin.'
      });
    }

    if (alumni.isRegistered) {
      return res.status(400).json({
        success: false,
        message: 'This account is already registered. Please login.'
      });
    }

    res.json({
      success: true,
      message: 'Roll number verified',
      data: { name: alumni.name, batchYear: alumni.batchYear }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred. Please try again later.' });
  }
});

// ============================
// 2. SIGNUP - Set Email & Password, Send OTP
// ============================
router.post('/signup', otpLimiter, async (req, res) => {
  try {
    const { rollNumber, email, password } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    if (!rollNumber || typeof rollNumber !== 'string') {
      return res.status(400).json({ success: false, message: 'Roll number is required' });
    }
    const normalizedRoll = rollNumber.trim().toUpperCase();

    const alumni = await Alumni.findOne({ rollNumber: normalizedRoll });

    if (!alumni) {
      return res.status(404).json({ success: false, message: 'Roll number not found' });
    }

    if (alumni.isRegistered) {
      return res.status(400).json({ success: false, message: 'Already registered' });
    }

    // Check if email is used by someone else
    const existingEmail = await Alumni.findOne({ email });
    if (existingEmail && existingEmail.rollNumber !== normalizedRoll) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = generateOTP();
    console.log("=== DEV OTP ===", otp);
    const hashedOTP = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Update alumni record
    alumni.email = email;
    alumni.password = hashedPassword;
    alumni.otp = hashedOTP;
    alumni.otpExpiry = otpExpiry;
    await alumni.save();

    // Send OTP email
    const emailHtml = `
      <div style="font-family: Arial; padding: 20px;">
        <h2>NITC Alumni Portal - Email Verification</h2>
        <p>Hi <b>${escapeHtml(alumni.name)}</b>,</p>
        <p>Your OTP for email verification is:</p>
        <h1 style="color: #2563eb; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP is valid for <b>10 minutes</b>.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;

    const emailSent = await sendEmail(email, 'NITC Alumni Portal - Verify Your Email', emailHtml);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Check SMTP settings.'
      });
    }

    res.json({
      success: true,
      message: 'OTP sent to your email',
      email: email
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred. Please try again later.' });
  }
});

// ============================
// 3. VERIFY OTP
// ============================
router.post('/verify-otp', otpLimiter, async (req, res) => {
  try {
    const { email, rollNumber, otp } = req.body;

    // Find the most recently updated unverified user with this email
    const alumni = await Alumni.findOne({ email, rollNumber, isRegistered: false }).sort({ updatedAt: -1 });

    if (!alumni) {
      return res.status(404).json({ success: false, message: 'User not found or already verified' });
    }

    if (alumni.otpAttempts >= 5) {
      alumni.otp = null;
      alumni.otpExpiry = null;
      alumni.otpAttempts = 0;
      await alumni.save();
      return res.status(429).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
    }

    const isOTPValid = await bcrypt.compare(otp, alumni.otp);
    if (!isOTPValid) {
      alumni.otpAttempts = (alumni.otpAttempts || 0) + 1;
      await alumni.save();
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (alumni.otpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    // Activate account
    alumni.isRegistered = true;
    alumni.isVerified = true;
    if (!alumni.alumniId) alumni.alumniId = await generateAlumniId(alumni.batchYear);
    alumni.otp = null;
    alumni.otpExpiry = null;
    alumni.otpAttempts = 0;
    await alumni.save();

    // Send Welcome Email
    try {
      const loginUrl = `${req.protocol}://${req.get('host')}/login.html`;
      const emailHtml = `
        <div style="font-family: Arial; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0D8ABC;">Welcome to the NITC MCA Alumni Portal!</h2>
          <p>Hi <b>${escapeHtml(alumni.name)}</b>,</p>
          <p>Your email has been successfully verified, and your account is now active.</p>
          <p>You can now log in to connect with your batchmates, view the directory, and stay updated on events.</p>
          <div style="margin-top: 25px; margin-bottom: 25px; text-align: center;">
              <a href="${loginUrl}" style="background-color: #0D8ABC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Login to Your Account</a>
          </div>
        </div>
      `;
      await sendEmail(alumni.email, 'Welcome to the NITC MCA Alumni Portal!', emailHtml);
    } catch (mailError) {
      console.error("Failed to send welcome email:", mailError);
    }

    res.json({ success: true, message: 'Email verified successfully! You can now login.' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred. Please try again later.' });
  }
});

// ============================
// 3.b RESEND OTP
// ============================
router.post('/resend-otp', otpLimiter, async (req, res) => {
  try {
    const { email, rollNumber } = req.body;

    if (!email || !rollNumber) {
      return res.status(400).json({ success: false, message: 'Email and Roll Number are required.' });
    }
    const normalizedRoll = rollNumber.trim().toUpperCase();

    const alumni = await Alumni.findOne({ email, rollNumber: normalizedRoll, isRegistered: false });
    if (!alumni) {
      return res.status(404).json({ success: false, message: 'User not found or already verified.' });
    }

    // Generate new OTP
    const otp = generateOTP();
    console.log("=== DEV RESEND OTP ===", otp);
    const hashedOTP = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    alumni.otp = hashedOTP;
    alumni.otpExpiry = otpExpiry;
    alumni.otpAttempts = 0; // Reset attempts on resend
    await alumni.save();

    // Send OTP email
    const emailHtml = `
      <div style="font-family: Arial; padding: 20px;">
        <h2>NITC Alumni Portal - Email Verification</h2>
        <p>Hi <b>${escapeHtml(alumni.name)}</b>,</p>
        <p>Your new OTP for email verification is:</p>
        <h1 style="color: #2563eb; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP is valid for <b>10 minutes</b>.</p>
        <p style="color: #666; font-size: 0.9em; margin-top: 20px;">If you didn't request this, please ignore this email.</p>
      </div>
    `;

    const emailSent = await sendEmail(email, 'NITC Alumni Portal - Resend Email Verification OTP', emailHtml);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Check SMTP settings.'
      });
    }

    res.json({
      success: true,
      message: 'A new OTP has been sent to your email.'
    });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred. Please try again later.' });
  }
});

// ============================
// 4. SMART LOGIN (Auto-detects Alumni / Admin / SuperAdmin)
// ============================
router.post('/smart-login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // --- Try Alumni first ---
    const alumni = await Alumni.findOne({ email, isRegistered: true }).lean();
    if (alumni) {
      // Unverified accounts are blocked
      if (!alumni.isVerified) {
        return res.status(401).json({ success: false, message: `Hi ${alumni.name}, your account is pending verification. Please wait 3-4 working days.` });
      }

      const isMatch = await bcrypt.compare(password, alumni.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Invalid password.' });
      }

      // Auto-migrate: assign Alumni ID if missing
      if (!alumni.alumniId && alumni.isRegistered && alumni.isVerified) {
        alumni.alumniId = await generateAlumniId(alumni.batchYear);
        await Alumni.findByIdAndUpdate(alumni._id, { alumniId: alumni.alumniId });
      }

      const token = jwt.sign(
        { id: alumni._id, rollNumber: alumni.rollNumber, role: 'alumni' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        accountType: 'alumni',
        user: {
          id: alumni._id,
          alumniId: alumni.alumniId,
          name: alumni.name,
          email: alumni.email,
          rollNumber: alumni.rollNumber,
          role: 'alumni',
          batchYear: alumni.batchYear,
          phone: alumni.phone,
          gender: alumni.gender,
          currentCompany: alumni.currentCompany,
          designation: alumni.designation,
          noOfProjects: alumni.noOfProjects,
          skills: alumni.skills,
          startups: alumni.startups,
          previousCompanies: alumni.previousCompanies,
          keyProjects: alumni.keyProjects,
          linkedin: alumni.linkedin,
          city: alumni.city,
          country: alumni.country,
          bio: alumni.bio,
          profileImage: alumni.profileImage
        }
      });
    }

    // --- Try Admin / SuperAdmin ---
    const admin = await Admin.findOne({ email });
    if (admin) {
      if (admin.isActive === false) {
        return res.status(403).json({ success: false, message: 'Account access has been revoked.' });
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Invalid password.' });
      }

      const token = jwt.sign(
        { id: admin._id, role: admin.role },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        accountType: admin.role, // 'admin', 'super_admin', or 'faculty'
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          department: admin.department,
          phone: admin.phone,
          officeLocation: admin.officeLocation,
          bio: admin.bio,
          profileImage: admin.profileImage,
          accessibleMenus: admin.accessibleMenus
        }
      });
    }

    // --- No matching user found ---
    return res.status(404).json({ success: false, message: 'No account found with this email.' });

  } catch (error) {
    console.error('Smart Login Error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred. Please try again later.' });
  }
});

// ============================
// 4. LOGIN
// ============================
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const alumni = await Alumni.findOne({ email, isRegistered: true }).lean();

    if (!alumni) {
      return res.status(404).json({ success: false, message: 'User not found or not registered' });
    }

    // Deny login if the account is not verified
    if (!alumni.isVerified) {
      return res.status(401).json({ success: false, message: `Hi ${alumni.name}, currently your account is in pending status. Please wait for verification, Generally it take 3-4 working days ` });
    }

    // Auto-migrate: Assign an Alumni ID to existing verified users if they don't have one yet
    if (!alumni.alumniId && alumni.isRegistered && alumni.isVerified) {
      alumni.alumniId = await generateAlumniId(alumni.batchYear);
      await Alumni.findByIdAndUpdate(alumni._id, { alumniId: alumni.alumniId });
    }

    const isMatch = await bcrypt.compare(password, alumni.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: alumni._id, rollNumber: alumni.rollNumber, role: 'alumni' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HttpOnly Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { // Return the full user profile on login
        id: alumni._id,
        alumniId: alumni.alumniId,
        name: alumni.name,
        email: alumni.email,
        rollNumber: alumni.rollNumber,
        role: 'alumni',
        batchYear: alumni.batchYear,
        phone: alumni.phone,
        gender: alumni.gender,
        currentCompany: alumni.currentCompany,
        designation: alumni.designation,
        noOfProjects: alumni.noOfProjects,
        skills: alumni.skills,
        startups: alumni.startups,
        previousCompanies: alumni.previousCompanies,
        keyProjects: alumni.keyProjects,
        linkedin: alumni.linkedin,
        city: alumni.city,
        country: alumni.country,
        bio: alumni.bio,
        profileImage: alumni.profileImage
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred. Please try again later.' });
  }
});

// ============================
// 4.b LOGOUT - Destroy HttpOnly Cookie
// ============================
router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
  res.json({ success: true, message: 'Logged out successfully' });
});

// ============================
// 5. FORGOT PASSWORD - Send OTP
// ============================
router.post('/forgot-password', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const alumni = await Alumni.findOne({ email, isRegistered: true });
    if (!alumni) {
      return res.status(404).json({ success: false, message: 'User not found or not registered' });
    }

    // Generate OTP
    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    alumni.otp = hashedOTP;
    alumni.otpExpiry = otpExpiry;
    await alumni.save();

    // Send OTP email
    const emailHtml = `
      <div style="font-family: Arial; padding: 20px;">
        <h2>NITC Alumni Portal - Password Reset</h2>
        <p>Hi <b>${escapeHtml(alumni.name)}</b>,</p>
        <p>Your OTP to reset your password is:</p>
        <h1 style="color: #2563eb; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP is valid for <b>10 minutes</b>.</p>
        <p>If you didn't request a password reset, please ignore this email or contact support.</p>
      </div>
    `;

    const emailSent = await sendEmail(email, 'NITC Alumni Portal - Password Reset OTP', emailHtml);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Check SMTP settings.'
      });
    }

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred. Please try again later.' });
  }
});

// ============================
// 6. RESET PASSWORD - Verify OTP & Set New Password
// ============================
router.post('/reset-password', otpLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const alumni = await Alumni.findOne({ email, isRegistered: true });
    if (!alumni) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isOTPValid = await bcrypt.compare(otp, alumni.otp);
    if (!isOTPValid) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (alumni.otpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    alumni.password = hashedPassword;
    alumni.otp = null;
    alumni.otpExpiry = null;
    await alumni.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred. Please try again later.' });
  }
});

// ============================
// 7. LEGACY SIGNUP (Manual Verification)
// ============================
router.post('/legacy-signup', async (req, res) => {
  try {
    const { fullName, email, gradYear, reference, password, profileImage } = req.body;

    // Check if a fully registered and verified user already exists
    const existingVerifiedAlumni = await Alumni.findOne({ email, isRegistered: true, isVerified: true });
    if (existingVerifiedAlumni) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists and is active. Please login.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    let processedImage = null;
    if (profileImage) {
      processedImage = await saveBase64ImageLocal(profileImage, 'profile', 400); // 400px limit for avatars
    }

    // Prepare the data for upsert
    const updatePayload = {
      $set: {
        name: fullName,
        email: email,
        password: hashedPassword,
        batchYear: gradYear,
        reference: reference || null,
        isRegistered: true, // They have credentials
        isVerified: false,  // They are NOT approved yet
      },
      $setOnInsert: { // Only set rollNumber when creating a new document
        rollNumber: `PENDING-${Date.now()}`
      }
    };

    if (processedImage) {
      updatePayload.$set.profileImage = processedImage;
    }

    // Create or update the alumni record.
    const updatedUser = await Alumni.findOneAndUpdate({ email: email }, updatePayload, { upsert: true, runValidators: true, new: true });

    // Fetch registered and verified alumni from the SAME batch to send verification email
    const batchmates = await Alumni.find({ isRegistered: true, isVerified: true, batchYear: gradYear, email: { $ne: email } });
    const faculties = await Admin.find({ role: 'faculty', isActive: true });

    const vouchUrlBase = `${req.protocol}://${req.get('host')}/api/auth/email-vouch/${updatedUser._id}`;

    const sendVouchEmail = (user, isFaculty) => {
      if (!user.email) return;
      const roleText = isFaculty ? 'Student' : 'Alumni';
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Legacy Registration Verification</title>
          <style>
            @media only screen and (max-width: 520px) {
              .email-wrapper {
                padding: 10px !important;
              }
              .email-card {
                padding: 20px !important;
                margin: 10px auto !important;
                width: 100% !important;
                max-width: 100% !important;
                border-radius: 8px !important;
              }
              .btn-container {
                display: block !important;
                text-align: center !important;
              }
              .btn {
                display: block !important;
                width: 100% !important;
                margin-right: 0 !important;
                margin-bottom: 12px !important;
                min-width: 100% !important;
                text-align: center !important;
                box-sizing: border-box !important;
              }
            }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Helvetica Neue', Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; width: 100%;">
            <tr>
              <td align="center" class="email-wrapper" style="padding: 20px 10px;">
                <div class="email-card" style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; margin: 20px auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); box-sizing: border-box; color: #334155; background-color: #ffffff; text-align: left;">
                  <h2 style="color: #0D8ABC; margin-top: 0; margin-bottom: 16px; font-size: 1.3em; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">Legacy Registration Verification</h2>
                  <p style="font-size: 0.95em; line-height: 1.6; margin-bottom: 12px;">Hi <b>${escapeHtml(user.name)}</b>,</p>
                  <p style="font-size: 0.95em; line-height: 1.6; margin-bottom: 12px;"><b>${escapeHtml(fullName)}</b> (Graduation Year: ${gradYear}) has requested to join the NITC MCA Alumni Portal.</p>
                  ${reference ? `<p style="font-size: 0.95em; line-height: 1.6; margin-bottom: 12px; background-color: #f8fafc; padding: 10px 14px; border-left: 4px solid #0D8ABC; border-radius: 4px; font-style: italic;"><b>Provided Reference:</b> ${escapeHtml(reference)}</p>` : ''}
                  <p style="font-size: 0.95em; line-height: 1.6; margin-bottom: 24px;">Do you know this person and can you verify they are a legitimate ${roleText.toLowerCase()}?</p>
                  <div class="btn-container" style="margin-bottom: 20px; display: block;">
                      <a href="${vouchUrlBase}/know/${user._id}" class="btn" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 0.9em; margin-right: 12px; margin-bottom: 12px; min-width: 180px; text-align: center; box-sizing: border-box;">I Know That Person</a>
                      <a href="${vouchUrlBase}/dont-know/${user._id}" class="btn" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 0.9em; margin-bottom: 12px; min-width: 180px; text-align: center; box-sizing: border-box;">I Don't Know That Person</a>
                  </div>
                  <p style="font-size: 0.85em; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 15px; margin-top: 15px;">If you are unsure, you can safely ignore this email.</p>
                </div>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
      sendEmail(user.email, 'Action Required: Verify New Registration', emailHtml).catch(err => console.error("Email send failed:", err));
    };

    batchmates.forEach(alum => sendVouchEmail(alum, false));
    faculties.forEach(faculty => sendVouchEmail(faculty, true));

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully! We will notify you once verified.'
    });

  } catch (error) {
    console.error("Legacy Signup Error:", error);
    if (error.code === 11000) { // Handle duplicate key error for email if a race condition occurs
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }
    res.status(500).json({ success: false, message: 'Server error during registration request.' });
  }
});

// ============================
// 7.b VOUCH FOR LEGACY REGISTRATION (BATCHMATES)
// ============================
router.post('/legacy-vouch', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, knows } = req.body;

    const targetUser = await Alumni.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const voterId = req.user.id;

    // Verify that the voter is verified
    const voter = await Alumni.findById(voterId);
    if (!voter || !voter.isVerified) {
      return res.status(403).json({ success: false, message: 'Access denied. Only verified alumni can participate in vouching.' });
    }

    // Check if the voter has already voted for this target user
    const hasVoted = targetUser.positiveVouchers.some(id => id.toString() === voterId) || targetUser.negativeVouchersList.some(id => id.toString() === voterId);
    if (hasVoted) {
      return res.status(400).json({ success: false, message: 'You have already voted for this person.' });
    }

    if (knows) {
      await Alumni.findByIdAndUpdate(targetUserId, {
        $inc: { positiveVouches: 1 },
        $addToSet: { positiveVouchers: req.user.id }
      });
    } else {
      await Alumni.findByIdAndUpdate(targetUserId, {
        $inc: { negativeVouches: 1 },
        $addToSet: { negativeVouchersList: req.user.id }
      });
    }

    res.json({
      success: true,
      message: 'Response recorded successfully.'
    });

  } catch (error) {
    console.error("Vouch Error:", error);
    res.status(500).json({ success: false, message: 'Server error during vouching.' });
  }
});

// ============================
// 7.c EMAIL VOUCH FOR LEGACY REGISTRATION (GET REQUEST VIA EMAIL)
// ============================
router.get(['/email-vouch/:targetUserId/:action', '/email-vouch/:targetUserId/:action/:voterId'], async (req, res) => {
  try {
    const { targetUserId, action, voterId } = req.params;
    const knows = action === 'know';

    const targetUser = await Alumni.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).send(`<h2 style="font-family: Arial; text-align: center; margin-top: 50px;">User not found.</h2>`);
    }

    // Check if the user is already verified - if so, no need to process the vote
    if (targetUser.isVerified) {
      return res.send(`
        <div style="font-family: Arial; padding: 40px; text-align: center;">
          <h2 style="color: #0D8ABC;">Already Verified!</h2>
          <p>This user has already been verified and approved by admins. Thank you!</p>
          <p style="color: #666; margin-top: 20px;">You can now close this window.</p>
        </div>
      `);
    }

    // IMPORTANT: Check if the voter is authorized and has already cast a vote for this alumni
    if (voterId) {
      let voterObj = await Alumni.findById(voterId);
      let isFaculty = false;
      if (!voterObj) {
        voterObj = await Admin.findById(voterId);
        if (voterObj) isFaculty = true;
      }
      if (!voterObj) {
        return res.status(404).send(`<h2 style="font-family: Arial; text-align: center; margin-top: 50px;">Voter not found.</h2>`);
      }
      if (!isFaculty && !voterObj.isVerified) {
        return res.send(`
                <div style="font-family: Arial; padding: 40px; text-align: center; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc3545;">Access Denied</h2>
                    <p style="font-size: 1.1em;">Only verified alumni are allowed to participate in the vouching process.</p>
                    <p style="color: #666; margin-top: 20px;">You can now close this window.</p>
                </div>
            `);
      }

      const hasVoted = targetUser.positiveVouchers.some(id => id.toString() === voterId) || targetUser.negativeVouchersList.some(id => id.toString() === voterId);
      if (hasVoted) {
        return res.send(`
                <div style="font-family: Arial; padding: 40px; text-align: center; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ffc107;">You have already voted!</h2>
                    <p style="font-size: 1.1em;">Your feedback for this person has already been recorded. Thank you!</p>
                    <p style="color: #666; margin-top: 20px;">You can now close this window.</p>
                </div>
            `);
      }
    }

    if (knows) {
      const updateData = { $inc: { positiveVouches: 1 } };
      if (voterId) updateData.$addToSet = { positiveVouchers: voterId };
      await Alumni.findByIdAndUpdate(targetUserId, updateData);
    } else {
      const updateData = { $inc: { negativeVouches: 1 } };
      if (voterId) updateData.$addToSet = { negativeVouchersList: voterId };
      await Alumni.findByIdAndUpdate(targetUserId, updateData);
    }

    res.send(`
        <div style="font-family: Arial; padding: 40px; text-align: center; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${knows ? '#28a745' : '#dc3545'};">Feedback Recorded Successfully!</h2>
            <p style="font-size: 1.1em;">Thank you for verifying. Your response has been securely recorded to help admins review this registration.</p>
            <p style="color: #666; margin-top: 20px;">You can now close this window.</p>
        </div>
    `);

  } catch (error) {
    console.error("Email Vouch Error:", error);
    res.status(500).send('<h2 style="font-family: Arial; text-align: center; margin-top: 50px;">Server error during vouching.</h2>');
  }
});

// ============================
// 7.d GET PENDING BATCHMATES FOR VOUCHING
// ============================
router.get('/pending-batchmates', authenticateToken, async (req, res) => {
  try {
    let pendingBatchmates = [];

    if (req.user && req.user.role === 'faculty') {
      // Faculty sees ALL pending requests
      pendingBatchmates = await Alumni.find({
        isRegistered: true,
        isVerified: false,
        rollNumber: { $regex: /^PENDING-/i }, // explicitly grab manual signups
        positiveVouchers: { $ne: req.user.id },
        negativeVouchersList: { $ne: req.user.id }
      }).select('name email batchYear reference profileImage createdAt');
    } else {
      // Standard Alumni sees only their batchmates
      const currentUser = await Alumni.findById(req.user.id);
      if (!currentUser || !currentUser.isVerified) {
        return res.status(403).json({ success: false, message: 'Access denied. Only verified alumni can participate in vouching.' });
      }
      if (!currentUser.batchYear) {
        return res.json({ success: true, pendingBatchmates: [] });
      }

      pendingBatchmates = await Alumni.find({
        isRegistered: true,
        isVerified: false,
        batchYear: currentUser.batchYear,
        _id: { $ne: currentUser._id },
        positiveVouchers: { $ne: currentUser._id },
        negativeVouchersList: { $ne: currentUser._id }
      }).select('name email batchYear reference profileImage createdAt');
    }

    res.json({ success: true, pendingBatchmates });
  } catch (error) {
    console.error("Get Pending Batchmates Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching pending batchmates.' });
  }
});

// ============================
// 8. ADMIN / SUPER ADMIN LOGIN
// ============================
router.post('/admin-login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    // Check if super_admin or system revoked access
    if (admin.isActive === false) {
      return res.status(403).json({ success: false, message: 'Account access has been revoked.' });
    }

    // Generate JWT token containing the ID and Role
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Set HttpOnly Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        department: admin.department,
        phone: admin.phone,
        officeLocation: admin.officeLocation,
        bio: admin.bio,
        profileImage: admin.profileImage,
        accessibleMenus: admin.accessibleMenus
      }
    });
  } catch (error) {
    console.error("Admin Login Error:", error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// ============================
// 8. ADD NEW ADMIN (SUPER ADMIN ONLY)
// ============================
router.post('/add-admin', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { name, email, password, department, role, phone, officeLocation, accessibleMenus } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Check if the admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'An Admin with this email already exists.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the new standard Admin
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
      role: role || 'admin',
      department: department || 'MCA',
      phone: phone || null,
      officeLocation: officeLocation || null,
      accessibleMenus: accessibleMenus || []
    });

    await newAdmin.save();

    // Send a welcome email with their temporary credentials
    try {
      const roleLabel = role === 'super_admin' ? 'Super Admin' : (role === 'faculty' ? 'Faculty' : (role === 'admin' ? 'Admin' : role.split(/[_-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')));
      const emailHtml = `
        <div style="font-family: Arial; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #4a148c;">Welcome to the NITC Alumni Portal</h2>
          <p>Hi <b>${escapeHtml(newAdmin.name)}</b>,</p>
          <p>An account has been created for you with the role of <b>${roleLabel}</b>.</p>
          <p>You can log in to the portal using the following credentials:</p>
          <ul>
            <li><b>Email:</b> ${newAdmin.email}</li>
            <li><b>Temporary Password:</b> ${password}</li>
          </ul>
          <p>We highly recommend changing your password after your first login via the Profile Information page.</p>
          <br/>
          <p>Best Regards,<br/>NITC MCA Portal Team</p>
        </div>
      `;
      await sendEmail(newAdmin.email, 'Welcome to NITC Alumni Portal - Account Details', emailHtml);
    } catch (mailError) {
      console.error("Failed to send welcome email to new admin:", mailError);
    }

    res.json({
      success: true,
      message: 'Account created and welcome email sent successfully.',
      admin: {
        name: newAdmin.name,
        email: newAdmin.email,
        department: newAdmin.department,
        role: newAdmin.role
      }
    });
  } catch (error) {
    console.error("Add Admin Error:", error);
    res.status(500).json({ success: false, message: 'Server error while creating Admin.' });
  }
});

// ============================
// 8.c BULK ADD ADMINS/FACULTY (SUPER ADMIN ONLY)
// ============================
router.post('/bulk-add-admins', authenticateToken, async (req, res) => {
  try {
    const { adminsList } = req.body;
    if (!adminsList || !Array.isArray(adminsList)) {
      return res.status(400).json({ success: false, message: 'Invalid data format.' });
    }

    const results = { successful: 0, failed: 0, errors: [] };

    for (const entry of adminsList) {
      try {
        const { name, email, password, department, role, phone, officeLocation, accessibleMenus } = entry;

        if (!name || !email || !password || !department || !role) {
          results.failed++;
          results.errors.push(`Missing mandatory fields (Name, Email, Password, Department, or Role) for entry ${email || 'unknown'}.`);
          continue;
        }

        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
          results.failed++;
          results.errors.push(`Account with email ${email} already exists.`);
          continue;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let menusArray = [];
        if (accessibleMenus) {
          menusArray = Array.isArray(accessibleMenus) ? accessibleMenus : String(accessibleMenus).split(',').map(s => s.trim()).filter(Boolean);
        }

        let normalizedRole = String(role || '').toLowerCase().trim().replace(/\s+/g, '_');
        if (!normalizedRole) normalizedRole = 'faculty'; // Default fallback

        const newAdmin = new Admin({ name, email, password: hashedPassword, role: normalizedRole, department, phone: phone || null, officeLocation: officeLocation || null, accessibleMenus: menusArray });
        await newAdmin.save();
        results.successful++;

        try {
          const roleLabel = normalizedRole === 'super_admin' ? 'Super Admin' : (normalizedRole === 'faculty' ? 'Faculty' : (normalizedRole === 'admin' ? 'Admin' : normalizedRole.split(/[_-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')));
          const emailHtml = `
            <div style="font-family: Arial; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #4a148c;">Welcome to the NITC Alumni Portal</h2>
              <p>Hi <b>${escapeHtml(newAdmin.name)}</b>,</p>
              <p>An account has been created for you with the role of <b>${roleLabel}</b>.</p>
              <p>You can log in to the portal using the following credentials:</p>
              <ul><li><b>Email:</b> ${newAdmin.email}</li><li><b>Temporary Password:</b> ${password}</li></ul>
              <p>We highly recommend changing your password after your first login via the Profile Information page.</p>
              <br/><p>Best Regards,<br/>NITC MCA Portal Team</p>
            </div>`;
          sendEmail(newAdmin.email, 'Welcome to NITC Alumni Portal - Account Details', emailHtml).catch(e => console.error(e));
        } catch (mailError) { }
      } catch (err) {
        console.error('Error:', err);
        results.failed++;
        results.errors.push(`Error adding ${entry.email || 'unknown'}: An internal server error occurred. Please try again later.`);
      }
    }
    res.json({ success: true, message: 'Bulk add completed.', results });
  } catch (error) {
    console.error("Bulk Add Admins Error:", error);
    res.status(500).json({ success: false, message: 'Server error during bulk add.' });
  }
});

// ============================
// 9. GET ALL ADMINS (SUPER ADMIN ONLY)
// ============================
router.get('/admins', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const admins = await Admin.find({}).select('-password');
    res.json({ success: true, admins });
  } catch (error) {
    console.error("Get Admins Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching admins.' });
  }
});
// ============================
// 9.b UPDATE ADMIN (SUPER ADMIN ONLY)
// ============================
router.put('/admins/:id', authenticateToken, async (req, res) => {
  try {
    const adminId = req.params.id;
    const {
      name,
      email,
      password,
      department,
      role,
      phone,
      officeLocation,
      accessibleMenus
    } = req.body;
    let admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }
    const updateData = {
      name,
      email,
      department,
      role,
      phone,
      officeLocation,
      accessibleMenus
    };
    // Only update and hash the password if the Super Admin typed a new one
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    await Admin.findByIdAndUpdate(adminId, updateData, { new: true, runValidators: true });
    res.json({ success: true, message: 'Admin updated successfully.' });
  } catch (error) {
    console.error("Update Admin Error:", error);
    res.status(500).json({ success: false, message: 'Server error while updating admin.' });
  }
});
// ============================
// 10. TOGGLE ADMIN STATUS (SUPER ADMIN ONLY)
// ============================
router.patch('/admins/:id/status', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }
    // Prevent super_admin from revoking themselves
    if (admin.role === 'super_admin') {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Admin status.' });
    }
    admin.isActive = !admin.isActive;
    await admin.save();
    res.json({ success: true, message: `Admin access ${admin.isActive ? 'restored' : 'revoked'}.`, isActive: admin.isActive });
  } catch (error) {
    console.error("Toggle Admin Status Error:", error);
    res.status(500).json({ success: false, message: 'Server error while modifying admin status.' });
  }
});

// ============================
// 10.b BULK UPDATE ROLE PERMISSIONS (SUPER ADMIN ONLY)
// ============================
router.put('/roles/permissions', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. Super Admin only.' });
    }
    const { role, accessibleMenus } = req.body;
    if (!['admin', 'faculty'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified.' });
    }

    await Admin.updateMany({ role }, { $set: { accessibleMenus: accessibleMenus || [] } });
    res.json({ success: true, message: `Permissions successfully updated for all ${role} accounts.` });
  } catch (error) {
    console.error("Update Role Permissions Error:", error);
    res.status(500).json({ success: false, message: 'Server error while updating role permissions.' });
  }
});

// ============================
// 10.c GET CURRENT LOGGED IN USER PROFILE (SELF)
// ============================
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    let user = await Admin.findById(userId).select('-password');
    if (!user) {
      user = await Alumni.findById(userId).select('-password -otp -otpExpiry');
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error("Get Current User Error:", error);
    res.status(500).json({ success: false, message: 'Server error fetching user profile.' });
  }
});

// ============================
// 11. GET ALL USERS (SUPER ADMIN ONLY)
// ============================
router.get('/users', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    // Check if the specific page requested unregistered users
    const includeUnregistered = req.query.includeUnregistered === 'true';
    const alumniQuery = includeUnregistered ? {} : { isRegistered: true };

    // Using .lean() to get plain JS objects to merge them
    const admins = await Admin.find({}).select('-password').lean();
    const alumni = await Alumni.find(alumniQuery).select('-password -otp -otpExpiry').lean();

    const allUsers = [
      ...admins.map(user => ({ ...user, userType: user.role === 'faculty' ? 'faculty' : 'admin' })),
      // Spread the user to preserve existing userType if it exists (e.g. for faculty)
      // and default to 'alumni' if it does not.
      ...alumni.map(user => ({ userType: 'alumni', ...user }))
    ];
    // Sort by creation date, newest first. Assumes `timestamps: true` on both schemas.
    allUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, users: allUsers });
  } catch (error) {
    console.error("Get All Users Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching all users.' });
  }
});

// ============================
// 12. UPDATE ADMIN PROFILE
// ============================
router.put('/admin/:id/profile', authenticateToken, authorizeRoles('admin', 'super_admin', 'faculty'), async (req, res) => {
  try {
    const { name, department, phone, officeLocation, bio, profileImage, aboutUsContent, aboutUsSliderImages, sideImages } = req.body;

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    if (name) admin.name = name;
    if (department) admin.department = department;
    if (phone !== undefined) admin.phone = phone;
    if (officeLocation !== undefined) admin.officeLocation = officeLocation;
    if (bio !== undefined) admin.bio = bio;
    if (aboutUsContent !== undefined) admin.aboutUsContent = aboutUsContent;
    if (profileImage !== undefined) {
      const newImg = await saveBase64ImageLocal(profileImage, 'profile', 400); // 400px limit for avatars
      if (newImg !== admin.profileImage) {
        deleteLocalFile(admin.profileImage);
        admin.profileImage = newImg;
      }
    }

    if (aboutUsSliderImages) {
      const oldImages = admin.aboutUsSliderImages || [];
      const processedImages = [];
      for (const item of aboutUsSliderImages) {
        let finalImageUrl = item.imageUrl;
        if (item.imageUrl && item.imageUrl.startsWith('data:image')) {
          finalImageUrl = await saveBase64ImageLocal(item.imageUrl, 'aboutus', 1920); // Compress to a larger banner size
        }
        processedImages.push({
          imageUrl: finalImageUrl,
          caption: item.caption,
          link: item.link
        });
      }
      // Clean up orphaned local files
      const newUrls = processedImages.map(img => img.imageUrl);
      for (const oldImg of oldImages) {
        if (oldImg.imageUrl && !newUrls.includes(oldImg.imageUrl)) {
          deleteLocalFile(oldImg.imageUrl);
        }
      }
      admin.aboutUsSliderImages = processedImages;
      admin.markModified('aboutUsSliderImages');
    }

    if (sideImages) {
      const oldSideImages = admin.sideImages || [];
      const processedSideImages = [];
      for (const img of sideImages) {
        let finalImageUrl = img.imageUrl;
        if (img.imageUrl && img.imageUrl.startsWith('data:image')) {
          finalImageUrl = await saveBase64ImageLocal(img.imageUrl, 'index', 600); // Higher resolution for side gallery
        }
        processedSideImages.push({
          imageUrl: finalImageUrl
        });
      }
      // Clean up orphaned local files
      const newSideUrls = processedSideImages.map(img => img.imageUrl);
      for (const oldImg of oldSideImages) {
        if (oldImg.imageUrl && !newSideUrls.includes(oldImg.imageUrl)) {
          deleteLocalFile(oldImg.imageUrl);
        }
      }
      admin.sideImages = processedSideImages;
      admin.markModified('sideImages');
    }

    await admin.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        department: admin.department,
        phone: admin.phone,
        officeLocation: admin.officeLocation,
        bio: admin.bio,
        aboutUsContent: admin.aboutUsContent,
        profileImage: admin.profileImage,
        accessibleMenus: admin.accessibleMenus,
        aboutUsSliderImages: admin.aboutUsSliderImages,
        sideImages: admin.sideImages
      }
    });
  } catch (error) {
    console.error("Update Admin Profile Error:", error);
    res.status(500).json({ success: false, message: 'Server error while updating profile.' });
  }
});

// ============================
// 13. ADD NEW ALUMNI (ADMIN/SUPER ADMIN ONLY)
// ============================
router.post('/add-alumni', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { name, email, rollNumber, batchYear, password } = req.body;

    if (!rollNumber || typeof rollNumber !== 'string') {
      return res.status(400).json({ success: false, message: 'Roll number is required' });
    }
    const normalizedRoll = rollNumber.trim().toUpperCase();

    // Check if the alumni already exists
    const query = [{ rollNumber: normalizedRoll }];
    if (email && email.trim() !== '') query.push({ email: email.trim() });

    const existingAlumni = await Alumni.findOne({ $or: query });
    if (existingAlumni) {
      return res.status(400).json({ success: false, message: 'An Alumni with this email or roll number already exists.' });
    }

    // Hash the password if provided
    let hashedPassword = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    const hasCredentials = !!(email && password);

    // Create the new Alumni (directly verified and registered)
    const newAlumniData = {
      name,
      rollNumber: normalizedRoll,
      password: hashedPassword,
      isRegistered: hasCredentials,
      isVerified: hasCredentials
    };

    if (email && email.trim() !== '') newAlumniData.email = email.trim();
    if (batchYear) newAlumniData.batchYear = batchYear;

    if (hasCredentials) {
      newAlumniData.alumniId = await generateAlumniId(batchYear);
    }

    const newAlumni = new Alumni(newAlumniData);

    await newAlumni.save();
    const alumniResponse = newAlumni.toObject();
    delete alumniResponse.password;
    res.json({ success: true, message: 'New Alumni added successfully.', alumni: alumniResponse });
  } catch (error) {
    console.error("Add Alumni Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'An Alumni with this email or roll number already exists in the database.' });
    }
    res.status(500).json({ success: false, message: error.message || 'Server error while creating Alumni.' });
  }
});

// ============================
// 13.b BULK ADD ALUMNI (ADMIN/SUPER ADMIN ONLY)
// ============================
router.post('/bulk-add-alumni', authenticateToken, async (req, res) => {
  try {
    const { alumniList } = req.body;
    if (!alumniList || !Array.isArray(alumniList)) {
      return res.status(400).json({ success: false, message: 'Invalid data format.' });
    }

    const results = { successful: 0, failed: 0, errors: [] };

    for (const entry of alumniList) {
      try {
        const { name, email, rollNumber, batchYear, password, gender } = entry;

        if (!name || !rollNumber || typeof rollNumber !== 'string') {
          results.failed++;
          results.errors.push(`Missing name or valid roll number for an entry.`);
          continue;
        }
        const normalizedRoll = rollNumber.trim().toUpperCase();

        // Check if exists
        const query = [{ rollNumber: normalizedRoll }];
        if (email && email.trim() !== '') query.push({ email: email.trim() });

        const existingAlumni = await Alumni.findOne({ $or: query });

        if (existingAlumni) {
          results.failed++;
          results.errors.push(`Roll number ${normalizedRoll} or email already exists.`);
          continue;
        }

        let hashedPassword = null;
        if (password) {
          const salt = await bcrypt.genSalt(10);
          hashedPassword = await bcrypt.hash(password, salt);
        }

        const hasCredentials = !!(email && password);

        const newAlumniData = {
          name,
          rollNumber: normalizedRoll,
          password: hashedPassword,
          isRegistered: hasCredentials,
          isVerified: hasCredentials
        };

        if (email && email.trim() !== '') newAlumniData.email = email.trim();
        if (batchYear) newAlumniData.batchYear = batchYear;
        if (gender) newAlumniData.gender = gender;

        if (hasCredentials) {
          newAlumniData.alumniId = await generateAlumniId(batchYear);
        }

        const newAlumni = new Alumni(newAlumniData);
        await newAlumni.save();
        results.successful++;
      } catch (err) {
        console.error('Error:', err);
        results.failed++;
        results.errors.push(`Error adding ${entry.rollNumber || 'unknown'}: ${err.message || 'An internal server error occurred.'}`);
      }
    }
    res.json({ success: true, message: 'Bulk add completed.', results });
  } catch (error) {
    console.error("Bulk Add Error:", error);
    res.status(500).json({ success: false, message: error.message || 'Server error during bulk add.' });
  }
});

// ============================
// 14. DELETE ALUMNI (ADMIN/SUPER ADMIN ONLY)
// ============================
router.delete('/alumni/:id', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const alumni = await Alumni.findByIdAndDelete(req.params.id);
    if (!alumni) {
      return res.status(404).json({ success: false, message: 'Alumni not found.' });
    }
    res.json({ success: true, message: 'Alumni removed successfully.' });
  } catch (error) {
    console.error("Delete Alumni Error:", error);
    res.status(500).json({ success: false, message: 'Server error while deleting alumni.' });
  }
});

// ============================
// 14.b UPDATE ALUMNI (ADMIN/SUPER ADMIN ONLY)
// ============================
router.put('/alumni/:id', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const originalAlumni = await Alumni.findById(req.params.id);
    if (!originalAlumni) {
      return res.status(404).json({ success: false, message: 'Alumni not found.' });
    }

    const updateData = req.body;
    const { name, batchYear, email, phone, gender, currentCompany, designation, skills, city, country, bio, isVerified, rollNumber } = updateData;
    const allowedUpdates = { name, batchYear, email, phone, gender, currentCompany, designation, skills, city, country, bio, isVerified, rollNumber };
    Object.keys(allowedUpdates).forEach(key => allowedUpdates[key] === undefined && delete allowedUpdates[key]);

    const alumni = await Alumni.findByIdAndUpdate(
      req.params.id,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    );

    // If they were just approved (legacy signup approval)
    if (updateData.isVerified === true && originalAlumni.isVerified === false && alumni.email) {
      if (!originalAlumni.alumniId) {
        alumni.alumniId = await generateAlumniId(originalAlumni.batchYear || alumni.batchYear);
        await alumni.save();
      }
      try {
        const loginUrl = `${req.protocol}://${req.get('host')}/login.html`;
        const emailHtml = `
          <div style="font-family: Arial; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">Account Approved!</h2>
            <p>Hi <b>${escapeHtml(alumni.name)}</b>,</p>
            <p>Great news! Your manual registration request for the NITC MCA Alumni Portal has been reviewed and <b>approved</b> by the administrators.</p>
            <p>You can now log in using the email and password you provided during registration.</p>
            <div style="margin-top: 25px; margin-bottom: 25px; text-align: center;">
                <a href="${loginUrl}" style="background-color: #0D8ABC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Login to Your Account</a>
            </div>
          </div>
        `;
        await sendEmail(alumni.email, 'Your NITC Alumni Account is Approved!', emailHtml);
      } catch (mailError) {
        console.error("Failed to send approval email:", mailError);
      }
    }

    res.json({ success: true, message: 'Alumni details updated successfully.', alumni });
  } catch (error) {
    console.error("Update Alumni Error:", error);
    res.status(500).json({ success: false, message: 'Server error while updating alumni.' });
  }
});

// ============================
// 14.c SANCTION ALUMNI ID CARD (ADMIN/SUPER ADMIN ONLY)
// ============================
router.patch('/alumni/:id/id-card-status', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'Sanctioned', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const alumni = await Alumni.findByIdAndUpdate(req.params.id, { idCardStatus: status }, { new: true });
    if (!alumni) return res.status(404).json({ success: false, message: 'Alumni not found.' });
    res.json({ success: true, message: `ID Card status updated to ${status}.`, alumni });
  } catch (error) {
    console.error("Update ID Status Error:", error);
    res.status(500).json({ success: false, message: 'Server error while updating ID status.' });
  }
});

// ============================
// 14.d BULK SANCTION ALUMNI ID CARDS
// ============================
router.patch('/alumni/bulk-id-card-status', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!['Pending', 'Sanctioned', 'Rejected'].includes(status) || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid data provided.' });
    }
    await Alumni.updateMany({ _id: { $in: ids } }, { $set: { idCardStatus: status } });
    res.json({ success: true, message: `Successfully updated ${ids.length} alumni to ${status}.` });
  } catch (error) {
    console.error("Bulk ID Status Error:", error);
    res.status(500).json({ success: false, message: 'Server error during bulk ID status update.' });
  }
});

// ============================
// 15. ADMIN FORGOT PASSWORD / SEND OTP
// ============================
router.post('/admin/send-otp', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);
    admin.otp = hashedOTP;
    admin.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await admin.save();

    const emailHtml = `
      <div style="font-family: Arial; padding: 20px;">
        <h2>NITC Alumni Portal - Admin Password Change</h2>
        <p>Hi <b>${escapeHtml(admin.name)}</b>,</p>
        <p>Your OTP to change your admin password is:</p>
        <h1 style="color: #c62828; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP is valid for <b>10 minutes</b>.</p>
      </div>
    `;

    const emailSent = await sendEmail(email, 'NITC Admin Portal - Password Change OTP', emailHtml);
    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP email.' });
    }

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred. Please try again later.' });
  }
});

// ============================
// 16. ADMIN CHANGE PASSWORD
// ============================
router.post('/admin/change-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const isOTPValid = await bcrypt.compare(otp, admin.otp);
    if (!isOTPValid) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (admin.otpExpiry < new Date()) return res.status(400).json({ success: false, message: 'OTP expired' });

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    admin.otp = null;
    admin.otpExpiry = null;
    await admin.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred. Please try again later.' });
  }
});

// ============================
// 17. GET ALL ALUMNI
// ============================
router.get('/alumni', authenticateToken, async (req, res) => {
  try {
    // Filter out any users that are not explicitly 'alumni' (like faculty)
    const alumni = await Alumni.find({
      isRegistered: true,
      $or: [{ userType: 'alumni' }, { userType: { $exists: false } }]
    }).select('-password -otp -otpExpiry').sort({ createdAt: -1 }).lean();
    res.json({ success: true, alumni });
  } catch (error) {
    console.error("Get Alumni Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching alumni.' });
  }
});

// ============================
// 18. UPDATE ALUMNI PROFILE
// ============================
router.put('/alumni/:id/profile', authenticateToken, authorizeRoles('alumni'), async (req, res) => {
  try {
    const {
      name, phone, batchYear, currentCompany, designation,
      noOfProjects, skills, previousCompanies, keyProjects,
      linkedin, city, country, bio, profileImage, startups, gender
    } = req.body;

    const alumni = await Alumni.findById(req.params.id);
    if (!alumni) {
      return res.status(404).json({ success: false, message: 'Alumni not found.' });
    }

    if (name) alumni.name = name;
    if (phone !== undefined) alumni.phone = phone;
    if (gender !== undefined) alumni.gender = gender;
    if (batchYear !== undefined) alumni.batchYear = batchYear;
    if (currentCompany !== undefined) alumni.currentCompany = currentCompany;
    if (designation !== undefined) alumni.designation = designation;
    if (noOfProjects !== undefined) alumni.noOfProjects = noOfProjects;
    if (skills !== undefined) {
      alumni.skills = skills;
      alumni.markModified('skills');
    }
    if (startups !== undefined) alumni.startups = startups;
    if (previousCompanies !== undefined) {
      alumni.set('previousCompanies', previousCompanies, { strict: false });
      alumni.markModified('previousCompanies');
    }
    if (keyProjects !== undefined) {
      alumni.set('keyProjects', keyProjects, { strict: false });
      alumni.markModified('keyProjects');
    }
    if (linkedin !== undefined) alumni.linkedin = linkedin;
    if (city !== undefined) alumni.city = city;
    if (country !== undefined) alumni.country = country;
    if (bio !== undefined) alumni.bio = bio;
    if (profileImage !== undefined) {
      const newImg = await saveBase64ImageLocal(profileImage, 'profile', 400); // 400px limit for avatars
      if (newImg !== alumni.profileImage) {
        deleteLocalFile(alumni.profileImage);
        alumni.profileImage = newImg;
      }
    }

    await alumni.save();

    // Strip out sensitive fields before sending the response
    const updatedAlumni = await Alumni.findById(req.params.id).select('-password -otp -otpExpiry').lean();

    res.json({ success: true, message: 'Profile updated successfully', alumni: { id: updatedAlumni._id, ...updatedAlumni } });
  } catch (error) {
    console.error("Update Alumni Profile Error:", error);
    res.status(500).json({ success: false, message: 'Server error while updating profile.' });
  }
});

// ============================
// 19. EVENTS CRUD
// ============================
router.post('/events', authenticateToken, async (req, res) => {
  try {
    if (req.body.image) {
      req.body.image = await saveBase64ImageLocal(req.body.image, 'events', 1200);
    }
    const { title, date, time, location, eligibility, description, contact, image } = req.body;
    const newEvent = new Event({ title, date, time, location, eligibility, description, contact, image, postedBy: req.body.postedBy, uploaderId: req.user.id, status: 'Pending' });
    await newEvent.save();
    res.json({ success: true, message: 'Event created successfully.', event: newEvent });
  } catch (error) {
    console.error("Create Event Error:", error);
    res.status(500).json({ success: false, message: 'Server error while creating event.' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });

    // Check if token is present to determine user's registration status
    let userId = null;
    let token = getCookie(req, 'token');
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
      if (token === 'null') token = null;
    }
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (e) {
        // Log but proceed safely
      }
    }

    const eventsWithStatus = events.map(event => {
      const eventObj = event.toObject();
      const isRegistered = event.registeredUsers && event.registeredUsers.some(reg => reg.user && reg.user.toString() === String(userId));
      eventObj.isRegistered = !!isRegistered;
      eventObj.registeredCount = event.registeredUsers ? event.registeredUsers.length : 0;
      return eventObj;
    });

    res.json({ success: true, events: eventsWithStatus });
  } catch (error) {
    console.error("Get Events Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching events.' });
  }
});

router.put('/events/:id', authenticateToken, async (req, res) => {
  try {
    if (req.body.image) {
      const existingEvent = await Event.findById(req.params.id);
      const newImg = await saveBase64ImageLocal(req.body.image, 'events', 1200);
      if (existingEvent && newImg !== existingEvent.image) {
        deleteLocalFile(existingEvent.image);
      }
      req.body.image = newImg;
    }
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, message: 'Event updated successfully.', event });
  } catch (error) {
    console.error("Update Event Error:", error);
    res.status(500).json({ success: false, message: 'Server error while updating event.' });
  }
});

router.delete('/events/:id', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    // Delete event image from disk
    if (event.image) {
      deleteLocalFile(event.image);
    }

    const { reason } = req.body || {};

    await Event.findByIdAndDelete(req.params.id);

    if (reason) {
      const cleanName = (event.postedBy || '').replace(' (Admin)', '').replace(' (Super Admin)', '').trim();
      let emailToSend = null;

      if (event.uploaderId) {
        const uploader = await Alumni.findById(event.uploaderId) || await Admin.findById(event.uploaderId);
        if (uploader && uploader.email) {
          emailToSend = uploader.email;
        }
      }

      if (!emailToSend && event.contact && event.contact.includes('@')) {
        emailToSend = event.contact; // Fallback if no matching user is found
      }

      if (emailToSend) {
        const emailHtml = `
          <div style="font-family: Arial; padding: 20px;">
            <h2>Event Submission Rejected</h2>
            <p>Hi ${escapeHtml(cleanName)},</p>
            <p>We regret to inform you that your event submission "<b>${escapeHtml(event.title)}</b>" has been rejected.</p>
            <p><b>Reason for rejection:</b></p>
            <blockquote style="background: #f8d7da; padding: 10px; border-left: 4px solid #dc3545; color: #721c24;">${escapeHtml(reason)}</blockquote>
            <p>If you have any questions, please contact the administration.</p>
          </div>
        `;
        await sendEmail(emailToSend, 'NITC Alumni Portal - Event Rejected', emailHtml);
      }
    }

    res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (error) {
    console.error("Delete Event Error:", error);
    res.status(500).json({ success: false, message: 'Server error while deleting event.' });
  }
});

// ============================
// 19.b EVENTS REGISTRATIONS & REPORTS
// ============================
router.post('/events/:id/register', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    // Check if the requester is in Alumni collection
    const alumni = await Alumni.findById(req.user.id);
    if (!alumni) {
      return res.status(403).json({ success: false, message: 'Only registered alumni can register for events.' });
    }

    if (!event.registeredUsers) event.registeredUsers = [];

    // Check if already registered
    const isAlreadyRegistered = event.registeredUsers.some(reg => reg.user && reg.user.toString() === req.user.id);
    if (isAlreadyRegistered) {
      return res.status(400).json({ success: false, message: 'Already registered for this event.' });
    }

    event.registeredUsers.push({ user: req.user.id, registeredAt: new Date() });
    await event.save();

    res.json({ success: true, message: 'Successfully registered for event.' });
  } catch (error) {
    console.error("Register Event Error:", error);
    res.status(500).json({ success: false, message: 'Server error during event registration.' });
  }
});

router.post('/events/:id/unregister', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    if (!event.registeredUsers) event.registeredUsers = [];

    const beforeLength = event.registeredUsers.length;
    event.registeredUsers = event.registeredUsers.filter(reg => reg.user && reg.user.toString() !== req.user.id);

    if (event.registeredUsers.length === beforeLength) {
      return res.status(400).json({ success: false, message: 'You are not registered for this event.' });
    }

    await event.save();
    res.json({ success: true, message: 'Successfully unregistered from event.' });
  } catch (error) {
    console.error("Unregister Event Error:", error);
    res.status(500).json({ success: false, message: 'Server error during event unregistration.' });
  }
});

router.get('/events/:id/registrations/download', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('registeredUsers.user');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Access control check: Admins/Super Admins, or the Alumni who uploaded the event
    const isAdminOrSuperAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const isCreator = event.uploaderId && event.uploaderId.toString() === req.user.id;

    if (!isAdminOrSuperAdmin && !isCreator) {
      return res.status(403).json({ success: false, message: 'Access denied. You are not authorized to view registrations for this event.' });
    }

    const registrations = event.registeredUsers || [];

    // Construct CSV content (BOM first for Excel UTF-8 representation)
    let csvContent = '\uFEFF';
    csvContent += 'Name,Batch,Mail,Registered Date\n';

    registrations.forEach(reg => {
      const user = reg.user;
      if (user) {
        const name = (user.name || '').replace(/"/g, '""');
        const batch = user.batchYear || 'N/A';
        const email = (user.email || '').replace(/"/g, '""');
        const regDate = reg.registeredAt ? new Date(reg.registeredAt).toISOString().split('T')[0] : 'N/A';
        csvContent += `"${name}","${batch}","${email}","${regDate}"\n`;
      }
    });

    const safeTitle = (event.title || 'event').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_registrations.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Download Registrations Error:", error);
    res.status(500).json({ success: false, message: 'Server error while generating registrations file.' });
  }
});

// ============================
// 20. GALLERY CRUD
// ============================
router.post('/gallery', authenticateToken, async (req, res) => {
  try {
    let processedImageUrl = req.body.imageUrl;
    if (processedImageUrl) {
      processedImageUrl = await saveBase64ImageLocal(processedImageUrl, 'gallery', 1200);
    }
    const newImage = new Gallery({
      imageUrl: processedImageUrl,
      caption: req.body.caption,
      category: req.body.category,
      categoryDetail: req.body.categoryDetail,
      postedBy: req.body.postedBy,
      uploaderId: req.user.id,
      isVisible: true
    });
    await newImage.save();
    res.json({ success: true, message: 'Image uploaded successfully.', image: newImage });
  } catch (error) {
    console.error("Upload Image Error:", error);
    res.status(500).json({ success: false, message: 'Server error while uploading image.' });
  }
});

// ============================
// 20b. PUBLIC GALLERY (For Landing Page)
// ============================
router.get('/gallery/public', async (req, res) => {
  try {
    const images = await Gallery.find({ isVisible: { $ne: false } }).select('imageUrl category').sort({ createdAt: -1 }).limit(30);
    res.json({ success: true, images });
  } catch (error) {
    console.error("Get Public Gallery Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching public gallery.' });
  }
});

router.get('/gallery', authenticateToken, async (req, res) => {
  try {
    let query = {};
    if (req.user && req.user.role === 'alumni') {
      query.isVisible = { $ne: false }; // Show only visible images for alumni
    }
    const images = await Gallery.find(query).sort({ createdAt: -1 });
    res.json({ success: true, images });
  } catch (error) {
    console.error("Get Gallery Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching gallery.' });
  }
});

router.put('/gallery/:id', authenticateToken, async (req, res) => {
  try {
    let processedImageUrl = req.body.imageUrl;
    if (processedImageUrl) {
      const existing = await Gallery.findById(req.params.id);
      const newImg = await saveBase64ImageLocal(processedImageUrl, 'gallery', 1200);
      if (existing && newImg !== existing.imageUrl) {
        deleteLocalFile(existing.imageUrl);
      }
      processedImageUrl = newImg;
    }
    const image = await Gallery.findByIdAndUpdate(req.params.id, { caption: req.body.caption, imageUrl: processedImageUrl, category: req.body.category, categoryDetail: req.body.categoryDetail }, { new: true });
    if (!image) return res.status(404).json({ success: false, message: 'Image not found.' });
    res.json({ success: true, message: 'Image updated successfully.', image });
  } catch (error) {
    console.error("Update Image Error:", error);
    res.status(500).json({ success: false, message: 'Server error while updating image.' });
  }
});

router.patch('/gallery/:id/visibility', authenticateToken, async (req, res) => {
  try {
    const image = await Gallery.findByIdAndUpdate(req.params.id, { isVisible: req.body.isVisible }, { new: true });
    if (!image) return res.status(404).json({ success: false, message: 'Image not found.' });
    res.json({ success: true, message: 'Image visibility updated.', image });
  } catch (error) {
    console.error("Update Visibility Error:", error);
    res.status(500).json({ success: false, message: 'Server error while updating visibility.' });
  }
});

router.delete('/gallery/:id', authenticateToken, async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id);
    if (!image) return res.status(404).json({ success: false, message: 'Image not found.' });

    // Delete local file
    deleteLocalFile(image.imageUrl);

    await Gallery.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Image deleted successfully.' });
  } catch (error) {
    console.error("Delete Image Error:", error);
    res.status(500).json({ success: false, message: 'Server error while deleting image.' });
  }
});

// ============================
// 20c. GALLERY CATEGORIES
// ============================

// Seed default gallery categories
async function seedDefaultCategories() {
  try {
    const defaults = ['Batch', 'Occasion', 'Campus Life', 'Achievements', 'Index', 'Others'];
    for (const name of defaults) {
      await GalleryCategory.updateOne(
        { name },
        { name },
        { upsert: true }
      );
    }
    console.log('✅ Default gallery categories seeded');
  } catch (error) {
    console.error('❌ Error seeding default gallery categories:', error);
  }
}
setTimeout(seedDefaultCategories, 2000);

// Get all gallery categories
router.get('/gallery-categories', async (req, res) => {
  try {
    const categories = await GalleryCategory.find().sort({ createdAt: 1 });
    res.json({ success: true, categories });
  } catch (error) {
    console.error("Get Categories Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching categories.' });
  }
});

// Add a gallery category
router.post('/gallery-categories', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const name = req.body.name ? req.body.name.trim() : '';
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    // Check if category already exists (case-insensitive)
    const existing = await GalleryCategory.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category already exists.' });
    }

    const newCategory = new GalleryCategory({ name });
    await newCategory.save();
    res.json({ success: true, message: 'Category added successfully.', category: newCategory });
  } catch (error) {
    console.error("Add Category Error:", error);
    res.status(500).json({ success: false, message: 'Server error while adding category.' });
  }
});

// Delete a gallery category
router.delete('/gallery-categories/:id', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const category = await GalleryCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    const name = category.name;

    // Prevent deleting 'Others' as fallback
    if (name.toLowerCase() === 'others') {
      return res.status(400).json({ success: false, message: 'Cannot delete the fallback category "Others".' });
    }

    // Delete the category
    await GalleryCategory.findByIdAndDelete(req.params.id);

    // Update all matching images to 'Others'
    await Gallery.updateMany({ category: name }, { $set: { category: 'Others' } });

    res.json({ success: true, message: 'Category deleted successfully and associated images set to Others.' });
  } catch (error) {
    console.error("Delete Category Error:", error);
    res.status(500).json({ success: false, message: 'Server error while deleting category.' });
  }
});


// ============================
// 21. MAGAZINES CRUD
// ============================

// Create a new magazine post
router.post('/magazines', authenticateToken, async (req, res) => {
  try {
    let processedImage = req.body.coverImage;
    if (processedImage) {
      processedImage = await saveBase64ImageLocal(processedImage, 'magazines', 800); // Compress cover images
    }

    const newMagazine = new Magazine({
      ...req.body,
      coverImage: processedImage,
      uploaderId: req.user.id, // From authenticateToken middleware
      status: (req.user.role === 'admin' || req.user.role === 'super_admin') ? 'Approved' : 'Pending' // Admins can auto-approve
    });

    await newMagazine.save();
    res.status(201).json({ success: true, message: 'Magazine submitted successfully.', magazine: newMagazine });
  } catch (error) {
    console.error("Create Magazine Error:", error);
    res.status(500).json({ success: false, message: 'Server error while creating magazine post.' });
  }
});

// Get all magazines (or user-specific)
router.get('/magazines', authenticateToken, async (req, res) => {
  try {
    let query = {};
    // If a regular alumni is asking, only show their own or approved ones.
    if (req.user.role === 'alumni') {
      query = {
        $or: [
          { status: 'Approved' },
          { uploaderId: req.user.id }
        ]
      };
    }
    // Admins can see everything
    const magazines = await Magazine.find(query).sort({ createdAt: -1 });
    res.json({ success: true, magazines });
  } catch (error) {
    console.error("Get Magazines Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching magazines.' });
  }
});

// Update a magazine post
router.put('/magazines/:id', authenticateToken, async (req, res) => {
  try {
    const magazine = await Magazine.findById(req.params.id);
    if (!magazine) return res.status(404).json({ success: false, message: 'Magazine not found.' });
    if (magazine.uploaderId.toString() !== req.user.id && req.user.role === 'alumni') return res.status(403).json({ success: false, message: 'Forbidden. You can only edit your own posts.' });

    let updateData = { ...req.body };
    if (updateData.coverImage) {
      const newImg = await saveBase64ImageLocal(updateData.coverImage, 'magazines', 800);
      if (newImg !== magazine.coverImage) {
        deleteLocalFile(magazine.coverImage);
      }
      updateData.coverImage = newImg;
    }
    if (req.user.role === 'alumni') updateData.status = 'Pending';

    const updatedMagazine = await Magazine.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    res.json({ success: true, message: 'Magazine updated successfully.', magazine: updatedMagazine });
  } catch (error) {
    console.error("Update Magazine Error:", error);
    res.status(500).json({ success: false, message: 'Server error while updating magazine.' });
  }
});

// Delete a magazine post
router.delete('/magazines/:id', authenticateToken, async (req, res) => {
  try {
    const magazine = await Magazine.findById(req.params.id);
    if (!magazine) return res.status(404).json({ success: false, message: 'Magazine not found.' });
    if (magazine.uploaderId.toString() !== req.user.id && req.user.role === 'alumni') return res.status(403).json({ success: false, message: 'Forbidden. You can only delete your own posts.' });

    // Delete local file
    deleteLocalFile(magazine.coverImage);

    await Magazine.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Magazine deleted successfully.' });
  } catch (error) {
    console.error("Delete Magazine Error:", error);
    res.status(500).json({ success: false, message: 'Server error while deleting magazine.' });
  }
});

// ============================
// 21b. PUBLIC MAGAZINES
// ============================
// Get all PUBLIC, APPROVED magazines for the landing page
router.get('/magazines/public', async (req, res) => {
  try {
    // Fetch the 10 most recent, approved magazines
    const magazines = await Magazine.find({ status: 'Approved' }).sort({ publicationDate: -1 }).limit(10);
    res.json({ success: true, magazines });
  } catch (error) {
    console.error("Get Public Magazines Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching public magazines.' });
  }
});

// ============================
// 22. ANNOUNCEMENTS CRUD
// ============================

// Get all announcements (Public route so alumni can see them on the dashboard)
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ date: -1 });
    res.json({ success: true, announcements });
  } catch (error) {
    console.error("Get Announcements Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching announcements.' });
  }
});

// Create a new announcement
router.post('/announcements', authenticateToken, async (req, res) => {
  try {
    const { title, content, date, postedBy } = req.body;
    if (!title || !content || !date || !postedBy) {
      return res.status(400).json({ success: false, message: 'Title, content, date, and postedBy are required' });
    }
    const newAnnouncement = new Announcement(req.body);
    await newAnnouncement.save();
    res.status(201).json({ success: true, message: 'Announcement created successfully.', announcement: newAnnouncement });
  } catch (error) {
    console.error("Create Announcement Error:", error);
    res.status(500).json({ success: false, message: 'Server error while creating announcement.' });
  }
});

// Update an announcement
router.put('/announcements/:id', authenticateToken, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found.' });
    res.json({ success: true, message: 'Announcement updated successfully.', announcement });
  } catch (error) {
    console.error("Update Announcement Error:", error);
    res.status(500).json({ success: false, message: 'Server error while updating announcement.' });
  }
});

// Delete an announcement
router.delete('/announcements/:id', authenticateToken, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found.' });
    res.json({ success: true, message: 'Announcement deleted successfully.' });
  } catch (error) {
    console.error("Delete Announcement Error:", error);
    res.status(500).json({ success: false, message: 'Server error while deleting announcement.' });
  }
});

// ============================
// 23. VIDEO UPLOAD (Cloudinary Storage)
// ============================
router.post('/videos', authenticateToken, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, description, postedBy } = req.body;

    if (!req.files || !req.files['video']) {
      return res.status(400).json({ success: false, message: 'Video file is required.' });
    }

    const videoFile = req.files['video'][0];
    const thumbnailFile = req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

    if (thumbnailFile && thumbnailFile.size > 5 * 1024 * 1024) {
      if (fs.existsSync(videoFile.path)) {
        try { fs.unlinkSync(videoFile.path); } catch (e) { console.error('Failed to delete temp video:', e.message); }
      }
      if (fs.existsSync(thumbnailFile.path)) {
        try { fs.unlinkSync(thumbnailFile.path); } catch (e) { console.error('Failed to delete temp thumbnail:', e.message); }
      }
      return res.status(400).json({ success: false, message: 'Thumbnail image size exceeds 5MB limit.' });
    }

    // Upload to Cloudinary (handles temp file cleanups automatically)
    let videoUrl;
    let thumbnailUrl = null;
    try {
      videoUrl = await uploadLocalFileToCloudinary(videoFile.path, 'videos', 'video');
      if (thumbnailFile) {
        thumbnailUrl = await uploadLocalFileToCloudinary(thumbnailFile.path, 'thumbnails', 'image');
      }
    } catch (uploadError) {
      console.error("Cloudinary upload failed during video upload:", uploadError);
      return res.status(500).json({ success: false, message: 'Failed to upload files to Cloudinary.' });
    }

    const newVideo = new Video({
      title,
      description,
      videoUrl,
      thumbnailUrl,
      postedBy,
      uploaderId: req.user.id,
      status: (req.user.role === 'admin' || req.user.role === 'super_admin') ? 'Approved' : 'Pending'
    });

    await newVideo.save();
    res.status(201).json({ success: true, message: 'Video uploaded successfully!', video: newVideo });
  } catch (error) {
    console.error("Video Upload Error:", error);
    res.status(500).json({ success: false, message: 'Server error during video upload.' });
  }
});

// ============================
// 24. GET PUBLIC VIDEOS
// ============================
router.get('/videos/public', async (req, res) => {
  try {
    const videos = await Video.find({ status: 'Approved' }).sort({ createdAt: -1 });
    res.json({ success: true, videos });
  } catch (error) {
    console.error("Get Public Videos Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching videos.' });
  }
});

// ============================
// 25. DELETE VIDEO (Removes Cloudinary / Local Files too)
// ============================
router.delete('/videos/:id', authenticateToken, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found.' });

    // Delete files from Cloudinary or local fallback
    if (video.videoUrl) {
      if (video.videoUrl.includes('res.cloudinary.com')) {
        await deleteFromCloudinary(video.videoUrl, 'video');
      } else {
        const publicDir = path.resolve(__dirname, '../public');
        const videoPath = path.resolve(path.join(__dirname, '../public', video.videoUrl));
        if (videoPath.startsWith(publicDir) && fs.existsSync(videoPath)) {
          try { fs.unlinkSync(videoPath); } catch (e) { console.error('Failed to delete local video file:', e.message); }
        }
      }
    }
    if (video.thumbnailUrl) {
      if (video.thumbnailUrl.includes('res.cloudinary.com')) {
        await deleteFromCloudinary(video.thumbnailUrl, 'image');
      } else {
        const publicDir = path.resolve(__dirname, '../public');
        const thumbnailPath = path.resolve(path.join(__dirname, '../public', video.thumbnailUrl));
        if (thumbnailPath.startsWith(publicDir) && fs.existsSync(thumbnailPath)) {
          try { fs.unlinkSync(thumbnailPath); } catch (e) { console.error('Failed to delete local thumbnail:', e.message); }
        }
      }
    }

    await Video.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Video and files deleted successfully.' });
  } catch (error) {
    console.error("Delete Video Error:", error);
    res.status(500).json({ success: false, message: 'Server error while deleting video.' });
  }
});

// ============================
// 26. SEND INVITATION EMAIL
// ============================
router.post('/send-invite', authenticateToken, async (req, res) => {
  try {
    const { targetEmail } = req.body;
    if (!targetEmail) return res.status(400).json({ success: false, message: 'Target email is required.' });

    let inviterName = "A member";
    let inviterBatch = "";

    if (req.user.role === 'alumni' || !req.user.role) {
      const alumni = await Alumni.findById(req.user.id);
      if (alumni) {
        inviterName = alumni.name;
        inviterBatch = alumni.batchYear ? ` (Batch of ${alumni.batchYear})` : '';
      }
    } else {
      const admin = await Admin.findById(req.user.id);
      if (admin) {
        inviterName = `${admin.name} (${admin.role === 'super_admin' ? 'Super Admin' : (admin.role === 'faculty' ? 'Faculty' : 'Admin')})`;
      }
    }

    const signupUrl = `${req.protocol}://${req.get('host')}/signup.html`;
    const emailHtml = `
      <div style="font-family: Arial; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0D8ABC;">Invitation to Join NITC MCA Alumni Portal</h2>
        <p>Hi there,</p>
        <p><b>${escapeHtml(inviterName)}</b>${escapeHtml(inviterBatch)} has invited you to join the official NITC MCA Alumni Portal.</p>
        <p>Connect with your batchmates, stay updated on events, and grow your professional network!</p>
        <div style="margin-top: 25px; margin-bottom: 25px; text-align: center;">
            <a href="${signupUrl}" style="background-color: #0D8ABC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Join the Portal Now</a>
        </div>
        <p style="font-size: 0.85em; color: #666;">If you believe this was sent in error, you can safely ignore this email.</p>
      </div>
    `;

    const sent = await sendEmail(targetEmail, 'Invitation to Join NITC MCA Alumni Portal', emailHtml);
    if (sent) res.json({ success: true, message: 'Invitation sent successfully!' });
    else res.status(500).json({ success: false, message: 'Failed to send email. Check SMTP settings.' });
  } catch (error) {
    console.error("Send Invite Error:", error);
    res.status(500).json({ success: false, message: 'Server error while sending invite.' });
  }
});

// ============================
// 27. GET ABOUT US CONTENT
// ============================
router.get('/about-us', async (req, res) => {
  try {
    const superAdmin = await Admin.findOne({ role: 'super_admin' }).lean();
    const content = superAdmin && superAdmin.aboutUsContent ? superAdmin.aboutUsContent : 'Welcome to the NITC MCA Alumni Portal. Connect, collaborate, and grow with your fellow alumni.';
    const sliderImages = superAdmin && superAdmin.aboutUsSliderImages ? superAdmin.aboutUsSliderImages : [];
    const sideImages = superAdmin && superAdmin.sideImages ? superAdmin.sideImages : [];
    res.json({ success: true, content, sliderImages, sideImages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================
// 28. GET PUBLIC STATS (For Landing Page)
// ============================
router.get('/stats', async (req, res) => {
  try {
    // Count all alumni (both registered and unregistered)
    const alumniCount = await Alumni.countDocuments({});

    // Count distinct batches/graduation years
    const distinctBatches = await Alumni.distinct('batchYear', { batchYear: { $ne: null, $ne: '' } });
    const batchesCount = distinctBatches.length;

    // Count approved events
    const eventsCount = await Event.countDocuments({ status: 'Approved' });

    // Count distinct countries among all alumni
    const distinctCountries = await Alumni.distinct('country', { country: { $ne: null, $ne: '' } });
    const countriesCount = distinctCountries.length;

    res.json({
      success: true,
      stats: {
        alumni: alumniCount,
        batches: batchesCount,
        events: eventsCount,
        countries: countriesCount
      }
    });
  } catch (error) {
    console.error("Get Stats Error:", error);
    res.status(500).json({ success: false, message: 'Server error while fetching stats.' });
  }
});

// ============================
// BACKGROUND MIGRATION: Auto-Generate Missing Alumni IDs
// ============================
setTimeout(async () => {
  try {
    const missingAlumni = await Alumni.find({ alumniId: { $exists: false }, isRegistered: true, isVerified: true });
    if (missingAlumni.length > 0) {
      console.log(`⏳ Starting auto-migration for ${missingAlumni.length} legacy alumni missing an ID...`);
      for (const alum of missingAlumni) {
        const newId = await generateAlumniId(alum.batchYear);
        await Alumni.findByIdAndUpdate(alum._id, { alumniId: newId });
      }
      console.log(`✅ Successfully generated unique Alumni IDs for ${missingAlumni.length} legacy users.`);
    }
  } catch (err) {
    console.error('Alumni ID Migration error:', err);
  }
}, 5000); // Runs 5 seconds after server start

module.exports = router;