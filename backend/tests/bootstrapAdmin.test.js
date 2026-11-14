const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { after, before, test } = require('node:test');
const User = require('../models/User');
const { createInitialAdmin, getInitialAdminData } = require('../scripts/bootstrapAdmin');

const databaseUri = 'mongodb://127.0.0.1:27017/studentFeedbackBootstrapTestDB';

before(async function () {
  await mongoose.connect(databaseUri);
  await User.init();
});

after(async function () {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

test('creates an initial admin once and hashes its password', async function () {
  const credentials = getInitialAdminData({
    INITIAL_ADMIN_NAME: 'Bootstrap Test Admin',
    INITIAL_ADMIN_EMAIL: 'bootstrap-admin@example.test',
    INITIAL_ADMIN_PASSWORD: 'TemporaryBootstrapPassword42!'
  });
  const admin = await createInitialAdmin(credentials);
  const storedAdmin = await User.findById(admin._id).select('+password');

  assert.equal(admin.role, 'admin');
  assert.notEqual(storedAdmin.password, credentials.password);
  await assert.rejects(
    createInitialAdmin(credentials),
    /An admin account already exists/
  );
});
