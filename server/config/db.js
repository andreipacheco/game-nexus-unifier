const mongoose = require('mongoose');
const dotenv = require('dotenv'); // Keep for process.env access, but don't call config() here
const logger = require('./logger'); // Import logger

// Assuming dotenv.config() in server.js (or entry point) has already run.
// No need for:
// if (process.env.NODE_ENV !== 'test') {
//   dotenv.config({ path: require('find-config')('.env') || require('path').resolve(__dirname, '../.env') });
// }


const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      const errorMsg = 'MONGODB_URI is not defined in your environment variables.';
      if (process.env.NODE_ENV === 'test') {
        // In test environment, throw error to avoid process.exit and allow tests to catch it
        throw new Error(errorMsg);
      }
      logger.error(errorMsg); // Use logger
      process.exit(1); // Exit if not in test environment
    }
    await mongoose.connect(process.env.MONGODB_URI, {
      // Mongoose 6 deprecated these options, but good to be aware of them for older versions:
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      // useCreateIndex: true, // For unique: true in schema
      // useFindAndModify: false,
    });
    logger.info('MongoDB Connected...'); // Use logger
  } catch (err) {
    logger.error('MongoDB connection error:', { message: err.message, error: err }); // Use logger, include error object
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
