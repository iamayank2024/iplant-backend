const express = require("express");
const { protect, optionalAuth } = require("../middleware/auth");
const {
  postValidation,
  nearbyPostsValidation,
  commentValidation,
} = require("../middleware/validator");
const upload = require("../middleware/multer");
const { handleMulterErrors } = require("../middleware/multer");
const {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  toggleLike,
  toggleSave,
  getNearbyPosts,
  getFilterExamples,
  // Comment controller functions
  addComment,
  getComments,
  getCommentReplies,
  deleteComment,
  toggleCommentLike,
} = require("../controllers/postController");

const router = express.Router();

// Public routes with optional auth for personalization
router.get("/", optionalAuth, getPosts);
router.get("/filter-examples", getFilterExamples);

// Community map endpoint (protected)
router.get("/nearby", protect, nearbyPostsValidation, getNearbyPosts);

// Post by ID must come after all other GET routes with specific paths
router.get("/:id", optionalAuth, getPostById);

// Protected routes
router.post(
  "/",
  protect,
  upload.single("image"),
  handleMulterErrors,
  createPost
);
router.put("/:id", protect, updatePost);
router.delete("/:id", protect, deletePost);
router.post("/:id/like", protect, toggleLike);
router.post("/:id/save", protect, toggleSave);

// Comment routes - public routes with optional auth for personalization
router.get("/:id/comments", optionalAuth, getComments);
router.get("/:id/comments/:commentId/replies", optionalAuth, getCommentReplies);

// Protected comment routes
router.post("/:id/comments", protect, commentValidation, addComment);
router.delete("/:id/comments/:commentId", protect, deleteComment);
router.post("/:id/comments/:commentId/like", protect, toggleCommentLike);

module.exports = router;
