const mongoose = require('mongoose');

beforeAll(async () => {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/taskflow_test';
  process.env.JWT_SECRET = 'test_secret_key_12345';
  process.env.NODE_ENV = 'test';

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
});
