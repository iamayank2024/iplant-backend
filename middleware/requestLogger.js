const logger = require("../utils/logger");

/**
 * Middleware to log all API requests
 */
const requestLogger = (req, res, next) => {
  // Get start time
  const start = Date.now();

  // Log request initiation
  logger.info(`Request: ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip:
      req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress,
    userAgent: req.headers["user-agent"],
    userId: req.user?._id || "Not authenticated",
  });

  // Process the request
  res.on("finish", () => {
    // Calculate duration
    const duration = Date.now() - start;

    // Set log level based on status code
    let logLevel = "info";
    if (res.statusCode >= 400 && res.statusCode < 500) {
      logLevel = "warn";
    } else if (res.statusCode >= 500) {
      logLevel = "error";
    }

    // Log response
    logger[logLevel](
      `Response: ${res.statusCode} ${req.method} ${req.originalUrl} - ${duration}ms`,
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        requestId: req.id, // This would need to be added with a request ID middleware
      }
    );
  });

  next();
};

module.exports = requestLogger;
