require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { requiredString, validateEmail, validatePassword } = require('../utils/validation');

function getInitialAdminData(environment) {
  return {
    name: requiredString(environment.INITIAL_ADMIN_NAME, 'Admin name', 100),
    email: validateEmail(environment.INITIAL_ADMIN_EMAIL),
    password: validatePassword(environment.INITIAL_ADMIN_PASSWORD)
  };
}

async function createInitialAdmin(adminData) {
  if (await User.exists({ role: 'admin' })) {
    throw new Error('An admin account already exists; bootstrap will not modify existing users.');
  }
  if (await User.exists({ email: adminData.email })) {
    throw new Error('An account with the requested admin email already exists.');
  }

  return User.create({
    ...adminData,
    role: 'admin',
    department: 'Administration',
    semester: 'Initial setup'
  });
}

async function run() {
  try {
    const adminData = getInitialAdminData(process.env);
    await connectDB();
    const admin = await createInitialAdmin(adminData);
    console.log(`Initial admin account created: ${admin.email}`);
  } catch (error) {
    console.error(`Admin bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) run();

module.exports = { createInitialAdmin, getInitialAdminData };
