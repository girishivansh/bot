/**
 * MongoDB Database Connection Manager
 * 
 * Configures Mongoose connection using environment variables.
 * Gracefully handles connection failures without silent fallbacks.
 */

const mongoose = require('mongoose');

let isConnected = false;

/**
 * Connects to MongoDB using the configured URI.
 * @param {string} [uri] Optional URI override (useful for tests)
 * @returns {Promise<mongoose.Connection>}
 */
async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    const errorMsg = 'MONGODB_URI environment variable is missing.';
    console.error(`Database Configuration Error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000 // Fail fast if MongoDB is unreachable
    });

    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (error) {
    isConnected = false;
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
}

/**
 * Closes the active MongoDB connection.
 * @returns {Promise<void>}
 */
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB disconnected.');
  }
}

/**
 * Checks if MongoDB is currently connected.
 * @returns {boolean}
 */
function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = {
  connectDB,
  disconnectDB,
  isDbConnected
};
