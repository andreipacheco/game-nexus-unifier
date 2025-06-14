const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load .env variables if not already loaded (e.g. when running tests or specific scripts)
// In server.js, dotenv.config() is already called, but good practice for standalone DB script.
if (process.env.NODE_ENV !== 'test') { // Avoid loading .env during tests if specific test env vars are used
  dotenv.config({ path: require('find-config')('.env') || require('path').resolve(__dirname, '../.env') });
}


const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      const errorMsg = 'MONGODB_URI is not defined in your environment variables.';
      if (process.env.NODE_ENV === 'test') {
        // In test environment, throw error to avoid process.exit and allow tests to catch it
        throw new Error(errorMsg);
      }
      console.error(errorMsg);
      process.exit(1); // Exit if not in test environment
    }
    await mongoose.connect(process.env.MONGODB_URI, {
      // Mongoose 6 deprecated these options, but good to be aware of them for older versions:
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      // useCreateIndex: true, // For unique: true in schema
      // useFindAndModify: false,
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    if (process.env.NODE_ENV === 'test') {
      // In test environment, re-throw the error or a specific error
      // This helps in testing the connection failure itself if needed
      throw new Error(`MongoDB connection failed: ${err.message}`);
    }
    // Exit process with failure if not in test environment
    process.exit(1);
  }
};

module.exports = connectDB;
