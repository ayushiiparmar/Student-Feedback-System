const mongoose = require('mongoose');

function redactCredentials(message) {
  return String(message).replace(
    /(mongodb(?:\+srv)?:\/\/)[^\s@/]+@/gi,
    '$1[credentials-redacted]@'
  );
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const error = new Error('MONGODB_URI is not set. Copy .env.example to .env and configure it.');
    console.error(`MongoDB connection failed: ${error.message}`);
    throw error;
  }

  try {
    const connection = await mongoose.connect(uri);
    console.log('MongoDB connection successful.');
    console.log(`Database name: ${connection.connection.name}`);
    return connection;
  } catch (error) {
    console.error(`MongoDB connection failed: ${redactCredentials(error.message)}`);
    throw error;
  }
}

module.exports = connectDB;
