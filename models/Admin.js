const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        default: 'admin' // By default, new admins are standard department admins
    },
    department: {
        type: String,
        default: 'MCA'
    },
    isActive: {
        type: Boolean,
        default: true // Allows Super Admins to easily revoke access by setting this to false
    },
    phone: { type: String },
    officeLocation: { type: String },
    bio: { type: String },
    accessibleMenus: [{ type: String }],
    aboutUsContent: { type: String },
    profileImage: { type: String }, // Base64 string for the avatar image
    aboutUsSliderImages: [{
        imageUrl: String,
        caption: String,
        link: String
    }],
    sideImages: [{
        imageUrl: String
    }],
    otp: { type: String },
    otpExpiry: { type: Date }
}, {
    timestamps: true, // Automatically creates 'createdAt' and 'updatedAt' fields
    collection: 'admins' // Explicitly saves to the 'admins' collection in mca_alumni_portal
});

module.exports = mongoose.model('Admin', adminSchema);