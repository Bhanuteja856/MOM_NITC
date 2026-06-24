require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin'); // Adjust the path if necessary

const uri = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';

// Using the main database. The Mongoose model will ensure it goes into an 'Admin' collection.
const dbName = process.env.MONGO_DB_NAME || 'mca_alumni_portal'; 

mongoose.connect(uri, { dbName: dbName }).then(async () => {
  console.log('Connected to MongoDB.');

  const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@nitc.ac.in';
  const plainTextPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!plainTextPassword) {
    console.error('Please set SUPER_ADMIN_PASSWORD in your .env file');
    process.exit(1);
  }

  // Check if the super admin already exists to prevent duplicates
  const existingSuperAdmin = await Admin.findOne({ email });
  
  if (existingSuperAdmin) {
    console.log(`Super Admin with email ${email} already exists!`);
  } else {
    // Hash the password securely before saving it to the database
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainTextPassword, salt);

    const superAdmin = new Admin({
      name: 'System Super Admin',
      email: email,
      password: hashedPassword,
      role: 'super_admin',
      department: 'System Directory'
    });

    await superAdmin.save();
    console.log('Successfully added the example Super Admin to the database.');
    console.log(`Login Email: ${email}`);
    console.log('Super Admin created. Check .env for credentials.');
  }
  
  mongoose.disconnect();
}).catch(console.error);