const winston = require("winston");

// Create logs directory if it doesn't exist

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${stack || ""}`;
  })
);

// Create colored format for console
const colorizedFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
  })
);

// Define logger configuration
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: logFormat,
  defaultMeta: { service: "iplant-api" },
  transports: [new winston.transports.Console()],
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: colorizedFormat,
      handleExceptions: true,
      handleRejections: true,
    })
  );
}

// Create a stream object for Morgan integration (if needed)
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
