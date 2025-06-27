const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../utils/logger");

const protect = async (req, res, next) => {
  try {
    // Get token from the authorization header
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      // Extract the token (remove "Bearer" prefix)
      token = req.headers.authorization.split(" ")[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        message: "Not authorized to access this route",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request object
      req.user = await User.findById(decoded.id);

      if (!req.user) {
        return res.status(401).json({
          message: "User not found",
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        message: "Not authorized to access this route",
      });
    }
  } catch (error) {
    next(error);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    // Get token from the authorization header
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      // Extract the token (remove "Bearer" prefix)
      token = req.headers.authorization.split(" ")[1];
    }

    // If no token, continue without authentication
    if (!token) {
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request object
      req.user = await User.findById(decoded.id);
    } catch (error) {
      // If token is invalid, continue without authentication
      logger.warn("Invalid token in optional auth", { error: error.message });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const validateRefreshToken = async (req, res, next) => {
  try {
    // Get refresh token from authorization header
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      // Extract the token (remove "Bearer" prefix)
      token = req.headers.authorization.split(" ")[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        message: "Refresh token required",
      });
    }

    try {
      // Verify token against refresh token secret or fall back to JWT secret
      const decoded = jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );

      // Attach user to request object
      req.user = await User.findById(decoded.id);

      if (!req.user) {
        logger.warn("Refresh token used for non-existent user", {
          id: decoded.id,
        });
        return res.status(401).json({
          message: "Invalid refresh token",
        });
      }

      // Attach token info to request for potential token rotation
      req.refreshToken = token;

      next();
    } catch (error) {
      logger.warn("Invalid refresh token", { error: error.message });
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { protect, optionalAuth, validateRefreshToken };
