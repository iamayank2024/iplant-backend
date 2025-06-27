const express = require("express");
const { protect, validateRefreshToken } = require("../middleware/auth");
const {
  registerValidation,
  loginValidation,
} = require("../middleware/validator");
const {
  register,
  login,
  getCurrentUser,
  updateProfile,
  refreshToken,
} = require("../controllers/authController");

const router = express.Router();

// Public routes
router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.post("/refresh-token", validateRefreshToken, refreshToken);

// Protected routes
router.get("/me", protect, getCurrentUser);
router.put("/me", protect, updateProfile);

module.exports = router;
