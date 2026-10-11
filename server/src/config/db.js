const mongoose = require('mongoose');

const connectDB = async (uri) => {
  const mongoURI = uri || process.env.MONGODB_URI;
  if (!mongoURI && process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI environment variable is required in production.');
  }
  const targetURI = mongoURI || 'mongodb://127.0.0.1:27017/taskflow';

  try {
    const conn = await mongoose.connect(targetURI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    throw new Error(`Could not connect to MongoDB at "${targetURI.replace(/:[^:@]+@/, ':****@')}": ${error.message}`);
  }
};

module.exports = connectDB;
