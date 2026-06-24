const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const magazineSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Magazine title is required.'],
    trim: true
  },
  publicationDate: {
    type: Date,
    required: [true, 'Publication date is required.']
  },
  readLink: {
    type: String,
    required: [true, 'A valid URL for the magazine is required.'],
    trim: true,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL.']
  },
  description: {
    type: String,
    required: [true, 'Description is required.'],
    trim: true
  },
  coverImage: {
    type: String // Storing as Base64 string
  },
  postedBy: {
    type: String,
    required: true
  },
  uploaderId: {
    type: Schema.Types.ObjectId,
    ref: 'Alumni',
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

const Magazine = mongoose.model('Magazine', magazineSchema);

module.exports = Magazine;