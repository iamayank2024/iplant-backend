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

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get all posts with optional filters
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of posts per page
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: Filter posts by user ID
 *       - in: query
 *         name: plantType
 *         schema:
 *           type: string
 *         description: Filter posts by plant type
 *     responses:
 *       200:
 *         description: List of posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PostResponse'
 *                 currentPage:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalPosts:
 *                   type: integer
 */
router.get("/", optionalAuth, getPosts);

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               caption:
 *                 type: string
 *               plantType:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                   address:
 *                     type: string
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostResponse'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 */
router.post(
  "/",
  protect,
  upload.single("image"),
  handleMulterErrors,
  createPost
);

/**
 * @swagger
 * /api/posts/nearby:
 *   get:
 *     summary: Get nearby posts based on location
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude coordinate
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude coordinate
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: Search radius in kilometers (default 10)
 *       - in: query
 *         name: plantType
 *         schema:
 *           type: string
 *         description: Filter by plant type
 *     responses:
 *       200:
 *         description: List of nearby posts with GeoJSON format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PostResponse'
 *                 geoJSON:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [FeatureCollection]
 *                     features:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get("/nearby", protect, nearbyPostsValidation, getNearbyPosts);

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get a post by ID
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostResponse'
 *       404:
 *         description: Post not found
 */
router.get("/:id", optionalAuth, getPostById);

/**
 * @swagger
 * /api/posts/{id}:
 *   put:
 *     summary: Update a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               caption:
 *                 type: string
 *               plantType:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                   address:
 *                     type: string
 *     responses:
 *       200:
 *         description: Post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostResponse'
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Post not found
 */
router.put("/:id", protect, updatePost);

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Post not found
 */
router.delete("/:id", protect, deletePost);

/**
 * @swagger
 * /api/posts/{id}/like:
 *   post:
 *     summary: Toggle like on a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Like toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 post:
 *                   $ref: '#/components/schemas/PostResponse'
 *                 isLiked:
 *                   type: boolean
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Post not found
 */
router.post("/:id/like", protect, toggleLike);

/**
 * @swagger
 * /api/posts/{id}/save:
 *   post:
 *     summary: Toggle save on a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Save toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 post:
 *                   $ref: '#/components/schemas/PostResponse'
 *                 isSaved:
 *                   type: boolean
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Post not found
 */
router.post("/:id/save", protect, toggleSave);

/**
 * @swagger
 * /api/posts/{id}/comments:
 *   get:
 *     summary: Get comments for a post
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Comments per page
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       text:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       userName:
 *                         type: string
 *                       userAvatar:
 *                         type: string
 *                       likes:
 *                         type: number
 *                       isLiked:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *   post:
 *     summary: Add a comment to a post
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *               parentComment:
 *                 type: string
 *                 description: ID of parent comment for replies
 *     responses:
 *       201:
 *         description: Comment added successfully
 */
router.get("/:id/comments", optionalAuth, getComments);
router.post("/:id/comments", protect, commentValidation, addComment);

/**
 * @swagger
 * /api/posts/{id}/comments/{commentId}/replies:
 *   get:
 *     summary: Get replies to a comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Replies per page
 *     responses:
 *       200:
 *         description: List of replies
 */
router.get("/:id/comments/:commentId/replies", optionalAuth, getCommentReplies);

/**
 * @swagger
 * /api/posts/{id}/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       401:
 *         description: Not authorized to delete this comment
 */
router.delete("/:id/comments/:commentId", protect, deleteComment);

/**
 * @swagger
 * /api/posts/{id}/comments/{commentId}/like:
 *   post:
 *     summary: Toggle like on a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Like toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isLiked:
 *                   type: boolean
 *                 comment:
 *                   type: object
 */
router.post("/:id/comments/:commentId/like", protect, toggleCommentLike);

module.exports = router;
