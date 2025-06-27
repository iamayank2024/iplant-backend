const logger = require("./logger");

/**
 * Log the request details - useful for debugging API calls
 * @param {Object} req - Express request object
 */
const logRequestDetails = (req) => {
  logger.debug("Request details", {
    method: req.method,
    url: req.originalUrl,
    params: req.params,
    query: req.query,
    body: req.body,
    headers: {
      "user-agent": req.headers["user-agent"],
      "content-type": req.headers["content-type"],
      authorization: req.headers.authorization ? "Bearer [REDACTED]" : "None",
    },
    userId: req.user?._id || "Not authenticated",
  });
};

/**
 * Log database operation results - useful for monitoring performance
 * @param {string} operation - Operation name (e.g., 'find', 'update')
 * @param {string} model - Model name (e.g., 'User', 'Post')
 * @param {Object} query - Query parameters used
 * @param {number} duration - Duration of the operation in ms
 * @param {number} resultCount - Number of records affected/returned
 */
const logDbOperation = (operation, model, query, duration, resultCount) => {
  logger.info(`DB ${operation} on ${model}`, {
    operation,
    model,
    query: JSON.stringify(query),
    duration: `${duration}ms`,
    resultCount,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log API errors with context - useful for debugging
 * @param {Error} error - Error object
 * @param {string} context - Context where the error occurred
 * @param {Object} metadata - Additional metadata to log
 */
const logApiError = (error, context, metadata = {}) => {
  logger.error(`Error in ${context}: ${error.message}`, {
    context,
    ...metadata,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log successful authentication - useful for security audit
 * @param {string} userId - User ID
 * @param {string} method - Authentication method (e.g., 'local', 'jwt')
 * @param {string} ip - IP address
 */
const logAuthentication = (userId, method, ip) => {
  logger.info(`User authenticated: ${userId}`, {
    userId,
    method,
    ip,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log failed authentication attempt - useful for security audit
 * @param {string} email - Email used in attempt
 * @param {string} reason - Reason for failure
 * @param {string} ip - IP address
 */
const logAuthFailure = (email, reason, ip) => {
  logger.warn(`Authentication failed for ${email}`, {
    email: email ? email.substring(0, 3) + "***" : "unknown",
    reason,
    ip,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  logRequestDetails,
  logDbOperation,
  logApiError,
  logAuthentication,
  logAuthFailure,
};
