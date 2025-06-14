const winston = require('winston');
const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs'); // Place logs directory one level up from config, i.e., server/logs

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom log format for console
const consoleLogFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message} `;
  if (Object.keys(metadata).length > 0 && !(metadata instanceof Error)) {
    // Only stringify metadata if it's not an Error object, as Error objects are handled well by default
    // and stringifying them might lose stack trace information in some contexts.
    const meta = { ...metadata }; // Clone to avoid modifying original
    delete meta.level; delete meta.message; delete meta.timestamp; // Remove redundant fields
    if (Object.keys(meta).length > 0) {
        msg += JSON.stringify(meta);
    }
  }
  return msg;
});

const logger = winston.createLogger({
  levels: winston.config.npm.levels, // Use npm logging levels (error, warn, info, http, verbose, debug, silly)
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json() // Default format for files, can be overridden per transport
  ),
  transports: [
    new winston.transports.Console({
      level: 'debug', // Show all logs down to debug level in the console
      format: combine(
        colorize(), // Add colors to the console output
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleLogFormat
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'server.log'), // All logs
      level: 'info', // Log info, warn, error to this file
      format: combine( // Ensure json format for this file transport
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        json()
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'), // Error logs only
      level: 'error', // Only log errors to this file
      format: combine( // Ensure json format for this file transport
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        json()
      ),
    }),
  ],
  exceptionHandlers: [ // Optional: Catch and log uncaught exceptions
    new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
  ],
  rejectionHandlers: [ // Optional: Catch and log unhandled promise rejections
    new winston.transports.File({ filename: path.join(logDir, 'rejections.log') })
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

// Stream for morgan (HTTP request logger) if you plan to use it
logger.stream = {
  write: function(message, encoding) {
    logger.http(message.trim()); // Use 'http' level for morgan logs
  },
};

module.exports = logger;
