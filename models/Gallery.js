const mongoose = require('mongoose');

const galleryCategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }
}, { timestamps: true });

const GalleryCategory = mongoose.model('GalleryCategory', galleryCategorySchema);

const gallerySchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    caption: { type: String },
    category: { type: String, required: true },
    categoryDetail: { type: String },
    postedBy: { type: String, required: true },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    isVisible: { type: Boolean, default: true }
}, { timestamps: true });

const Gallery = mongoose.model('Gallery', gallerySchema);
Gallery.GalleryCategory = GalleryCategory;

module.exports = Gallery;