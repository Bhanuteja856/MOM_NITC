const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  date: { type: Date, required: true },
  expiryDate: { type: Date },
  postedBy: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

announcementSchema.index({ date: -1 });
announcementSchema.index({ isActive: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);