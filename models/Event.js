const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true, trim: true, match: [/^\d{1,2}:\d{2}(?:\s?[aApP][mM])?$/, 'Please fill a valid time format (e.g., 14:30 or 02:30 PM)'] },
    location: { type: String, required: true },
    eligibility: { type: String, required: true },
    description: { type: String, required: true },
    contact: { type: String },
    image: { type: String }, // Base64 string
    postedBy: { type: String, required: true },
    uploaderId: { type: mongoose.Schema.Types.ObjectId },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    registeredUsers: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'Alumni' },
        registeredAt: { type: Date, default: Date.now }
    }],
    reminderSent: {
        type: Boolean,
        default: false
    }
}, 
{
    timestamps: true,
    collection: 'events'
});

eventSchema.index({ status: 1 });
eventSchema.index({ postedBy: 1 });

module.exports = mongoose.model('Event', eventSchema);