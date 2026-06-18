const mongoose = require('mongoose');
const logger = require('./logger');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error({ err }, 'MongoDB connection error');
    process.exit(1);
  }
}

function getMongoStatus() {
  return mongoose.connection.readyState === 1 ? 'ok' : 'error';
}

module.exports = { connectDB, getMongoStatus };
