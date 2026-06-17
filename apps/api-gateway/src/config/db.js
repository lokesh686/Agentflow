const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

function getMongoStatus() {
  return mongoose.connection.readyState === 1 ? 'ok' : 'error';
}

module.exports = { connectDB, getMongoStatus };
