require('dotenv').config(); // MUST be at the top
const mongoose = require('mongoose');
const Alumni = require('./models/alumni');

// For debugging: This will tell us if it's reading the file
if (!process.env.MONGO_URL && !process.env.MONGO_URI) {
    console.error("❌ ERROR: MONGO_URI or MONGO_URL is not defined in your .env file!");
    process.exit(1);
}

const sampleAlumni = [
  { rollNumber: 'MCA2401', name: 'Gudi Bhanu Teja', batchYear: 2024 },
  { rollNumber: 'MCA2402', name: 'NITC Student', batchYear: 2024 },
  { rollNumber: 'MCA2403', name: 'Another Student', batchYear: 2024 }
];

const mongoUrl = process.env.MONGO_URI || process.env.MONGO_URL;

// Using the main database. 
const mongoDbName = process.env.MONGO_DB_NAME || 'mca_alumni_portal'; 

mongoose.connect(mongoUrl, { dbName: mongoDbName })
  .then(async () => {
    console.log('📡 Connected to MongoDB successfully...');
    
    for (const alumnus of sampleAlumni) {
      const exists = await Alumni.findOne({ rollNumber: alumnus.rollNumber });
      if (!exists) {
        await Alumni.create(alumnus);
        console.log(`Added: ${alumnus.rollNumber} - ${alumnus.name}`);
      } else {
        console.log(`Skipped (already exists): ${alumnus.rollNumber}`);
      }
    }
    process.exit();
  })
  .catch(err => {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  });
