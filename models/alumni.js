const mongoose = require('mongoose');

const alumniSchema = new mongoose.Schema({
  rollNumber: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true,
    trim: true
  },
  alumniId: { 
    type: String, 
    unique: true, 
    sparse: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  batchYear: { 
    type: Number,
    default: null
  },
  email: { 
    type: String, 
    default: null,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    default: null 
  },
  phone: { 
    type: String, 
    default: null 
  },
  gender: { 
    type: String,
    default: null 
  },
  otp: { 
    type: String, 
    default: null 
  },
  otpExpiry: { 
    type: Date, 
    default: null 
  },
  otpAttempts: {
    type: Number,
    default: 0
  },
  isRegistered: { 
    type: Boolean, 
    default: false 
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  positiveVouches: { type: Number, default: 0 },
  negativeVouches: { type: Number, default: 0 },
  positiveVouchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Alumni' }],
  negativeVouchersList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Alumni' }],
  currentCompany: { 
    type: String, 
    default: null 
  },
  designation: { 
    type: String,
    default: null 
  },
  noOfProjects: { type: Number, default: null },
  skills: [{ type: String }],
  startups: { type: String, default: null },
  linkedin: { type: String, default: null },
  city: { type: String, default: null },
  country: { type: String, default: null },
  bio: { type: String, default: null },
  profileImage: { type: String, default: null },
  reference: { type: String, default: null },
  previousCompanies: [{
    companyName: String,
    yearsWorked: String
  }],
  keyProjects: [{
    projectName: String,
    roleDescription: String
  }],
  userType: {
    type: String,
    default: 'alumni'
  },
  idCardStatus: {
    type: String,
    enum: ['Pending', 'Sanctioned', 'Rejected'],
    default: 'Pending'
  }
}, { timestamps: true });

alumniSchema.pre('save', function() {
  if (this.isRegistered && !this.password) {
    throw new Error('Password is required for registered alumni');
  }
});

module.exports = mongoose.model('Alumni', alumniSchema);