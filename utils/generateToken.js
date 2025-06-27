const jwt = require("jsonwebtoken");

/**
 * Generate a JWT token for user authentication
 * @param {string} id - User ID to be encoded in the token
 * @param {boolean} isRefreshToken - Whether to generate a refresh token
 * @returns {string} JWT token
 */
const generateToken = (id, isRefreshToken = false) => {
  return jwt.sign(
    { id },
    isRefreshToken
      ? process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      : process.env.JWT_SECRET,
    {
      expiresIn: isRefreshToken
        ? process.env.JWT_REFRESH_EXPIRES_IN || "7d"
        : process.env.JWT_EXPIRES_IN || "1d",
    }
  );
};

module.exports = generateToken;
