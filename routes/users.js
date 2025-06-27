const express = require("express");
const { protect, optionalAuth } = require("../middleware/auth");
const {
  getUserProfile,
  getUserPosts,
  getUserSavedPosts,
  getLeaderboard,
  getLeaderboardStats,
} = require("../controllers/userController");

const router = express.Router();

// Public routes with optional auth for personalization
router.get("/leaderboard", optionalAuth, getLeaderboard);
router.get("/leaderboard/stats", optionalAuth, getLeaderboardStats);
router.get("/:id", optionalAuth, getUserProfile);
router.get("/:id/posts", optionalAuth, getUserPosts);

// Protected routes
router.get("/:id/saved", protect, getUserSavedPosts);

module.exports = router;
