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

/**
 * @swagger
 * /api/users/leaderboard:
 *   get:
 *     summary: Get user leaderboard
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [plants, co2, engagement]
 *         description: Category to sort by
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [week, month, all]
 *         description: Time range for the leaderboard
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of users to return
 *     responses:
 *       200:
 *         description: Leaderboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       avatarUrl:
 *                         type: string
 *                       score:
 *                         type: number
 *                       rank:
 *                         type: number
 */
router.get("/leaderboard", optionalAuth, getLeaderboard);

/**
 * @swagger
 * /api/users/leaderboard/stats:
 *   get:
 *     summary: Get leaderboard statistics
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [week, month, all]
 *         description: Time range for the stats
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [plants, co2, engagement]
 *         description: Category for the stats
 *     responses:
 *       200:
 *         description: Leaderboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 platformStats:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: number
 *                     totalPosts:
 *                       type: number
 *                     totalPlants:
 *                       type: number
 *                     environmentalImpact:
 *                       type: number
 */
router.get("/leaderboard/stats", optionalAuth, getLeaderboardStats);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 avatarUrl:
 *                   type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: number
 *                     plants:
 *                       type: number
 *                     likesReceived:
 *                       type: number
 */
router.get("/:id", optionalAuth, getUserProfile);

/**
 * @swagger
 * /api/users/{id}/posts:
 *   get:
 *     summary: Get user's posts
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Posts per page
 *     responses:
 *       200:
 *         description: List of user's posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PostResponse'
 */
router.get("/:id/posts", optionalAuth, getUserPosts);

/**
 * @swagger
 * /api/users/{id}/saved:
 *   get:
 *     summary: Get user's saved posts
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID (must be the authenticated user)
 *     responses:
 *       200:
 *         description: List of user's saved posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PostResponse'
 *       401:
 *         description: Not authorized to access saved posts of another user
 */
router.get("/:id/saved", protect, getUserSavedPosts);

module.exports = router;
