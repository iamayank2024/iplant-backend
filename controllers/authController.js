const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const logger = require("../utils/logger");
const { logAuthentication, logAuthFailure } = require("../utils/logHelper");
const Post = require("../models/Post");

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, avatarUrl, location } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      avatarUrl: avatarUrl || undefined,
      location: location || undefined,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        location: user.location,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select("+password");

    // Get client IP - this might need adjustment based on your deployment setup
    const clientIp =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    // Check if user exists and password matches
    if (user && (await user.comparePassword(password))) {
      // Log successful login
      logAuthentication(user._id, "local", clientIp);

      // Get user stats for the response
      const [postCount, likesReceived, savedPostsCount] = await Promise.all([
        // Get post count
        Post.countDocuments({ user: user._id }),
        // Get likes received
        Post.aggregate([
          { $match: { user: user._id } },
          { $project: { likesCount: { $size: "$likes" } } },
          { $group: { _id: null, total: { $sum: "$likesCount" } } },
        ]),
        // Count saved posts
        User.findById(user._id).then((u) => u.savedPosts.length),
      ]);

      // Calculate total likes received
      const totalLikes = likesReceived.length > 0 ? likesReceived[0].total : 0;

      // Generate badges (example implementation - you might have different logic)
      const badges = [];
      if (user.numberOfPlants >= 10) badges.push("Plant Enthusiast");
      if (totalLikes >= 50) badges.push("Popular Planter");
      if (postCount >= 20) badges.push("Active Gardener");

      // Generate access and refresh tokens
      const accessToken = generateToken(user._id);
      const refreshToken = generateToken(user._id, true);

      // Format response according to interface
      res.json({
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          avatar: user.avatarUrl,
          plantsCount: user.numberOfPlants || 0,
          likesCount: totalLikes,
          savedCount: savedPostsCount,
          badges: badges,
        },
        accessToken,
        refreshToken,
      });
    } else {
      // Log failed login attempt
      logAuthFailure(
        email,
        user ? "Invalid password" : "User not found",
        clientIp
      );

      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    logger.error(`Login error: ${error.message}`, { stack: error.stack });
    next(error);
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getCurrentUser = async (req, res, next) => {
  try {
    // User is already attached to req by the protect middleware
    const userId = req.user._id;

    // Get full user data with a fresh query to ensure we have the latest data
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user stats for the response, same as in login and refresh
    const [postCount, likesReceived, savedPostsCount] = await Promise.all([
      // Get post count
      Post.countDocuments({ user: userId }),
      // Get likes received
      Post.aggregate([
        { $match: { user: userId } },
        { $project: { likesCount: { $size: "$likes" } } },
        { $group: { _id: null, total: { $sum: "$likesCount" } } },
      ]),
      // Count saved posts
      User.findById(userId).then((u) => u.savedPosts.length),
    ]);

    // Calculate total likes received
    const totalLikes = likesReceived.length > 0 ? likesReceived[0].total : 0;

    // Generate badges (following the same logic as login and refresh)
    const badges = [];
    if (user.numberOfPlants >= 10) badges.push("Plant Enthusiast");
    if (totalLikes >= 50) badges.push("Popular Planter");
    if (postCount >= 20) badges.push("Active Gardener");

    // Format location as string if it exists
    const locationString =
      user.location && user.location.address
        ? user.location.address
        : undefined;

    // Return the user data in the exact format specified by the interface
    return res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      bio: user.bio || undefined,
      location: locationString,
      avatar: user.avatarUrl,
      coverImage: undefined, // Not currently stored in our model
      joinedAt: user.createdAt.toISOString(),
      plantsCount: user.numberOfPlants || 0,
      likesCount: totalLikes,
      savedCount: savedPostsCount,
      badges: badges,
    });
  } catch (error) {
    logger.error(`Error fetching user profile: ${error.message}`, {
      userId: req.user?._id,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/me
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update text fields if provided
    if (req.body.name) user.name = req.body.name;
    if (req.body.bio !== undefined) user.bio = req.body.bio;

    // Handle location as a string (store in location.address)
    if (req.body.location !== undefined) {
      if (!user.location) {
        user.location = {
          type: "Point",
          coordinates: [0, 0], // Default coordinates
          address: req.body.location,
        };
      } else {
        user.location.address = req.body.location;
      }
    }

    // Avatar and coverImage are handled separately via the file upload endpoint
    // The client should first upload the images to /api/upload and then update the profile with the URLs

    if (req.body.avatarUrl) user.avatarUrl = req.body.avatarUrl;

    // Add coverImage field if not exists in schema
    if (req.body.coverImageUrl) {
      user.coverImageUrl = req.body.coverImageUrl;
    }

    const updatedUser = await user.save();

    // Get user stats for the response
    const [postCount, likesReceived, savedPostsCount] = await Promise.all([
      // Get post count
      Post.countDocuments({ user: user._id }),
      // Get likes received
      Post.aggregate([
        { $match: { user: user._id } },
        { $project: { likesCount: { $size: "$likes" } } },
        { $group: { _id: null, total: { $sum: "$likesCount" } } },
      ]),
      // Count saved posts
      User.findById(user._id).then((u) => u.savedPosts.length),
    ]);

    // Calculate total likes received
    const totalLikes = likesReceived.length > 0 ? likesReceived[0].total : 0;

    // Generate badges
    const badges = [];
    if (user.numberOfPlants >= 10) badges.push("Plant Enthusiast");
    if (totalLikes >= 50) badges.push("Popular Planter");
    if (postCount >= 20) badges.push("Active Gardener");

    // Return the updated user profile in the same format as getCurrentUser
    res.json({
      id: updatedUser._id.toString(),
      name: updatedUser.name,
      email: updatedUser.email,
      bio: updatedUser.bio || undefined,
      location: updatedUser.location?.address || undefined,
      avatar: updatedUser.avatarUrl,
      coverImage: updatedUser.coverImageUrl || undefined,
      joinedAt: updatedUser.createdAt.toISOString(),
      plantsCount: updatedUser.numberOfPlants || 0,
      likesCount: totalLikes,
      savedCount: savedPostsCount,
      badges: badges,
    });

    logger.info(`User profile updated: ${updatedUser._id}`, {
      userId: updatedUser._id,
      updatedFields: Object.keys(req.body),
    });
  } catch (error) {
    logger.error(`Error updating profile: ${error.message}`, {
      userId: req.user?._id,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Refresh access token using refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Public (with refresh token)
 */
const refreshToken = async (req, res, next) => {
  try {
    // User is already attached to req by validateRefreshToken middleware
    const user = req.user;

    // Get user stats for the response
    const [postCount, likesReceived, savedPostsCount] = await Promise.all([
      // Get post count
      Post.countDocuments({ user: user._id }),
      // Get likes received
      Post.aggregate([
        { $match: { user: user._id } },
        { $project: { likesCount: { $size: "$likes" } } },
        { $group: { _id: null, total: { $sum: "$likesCount" } } },
      ]),
      // Count saved posts
      User.findById(user._id).then((u) => u.savedPosts.length),
    ]);

    // Calculate total likes received
    const totalLikes = likesReceived.length > 0 ? likesReceived[0].total : 0;

    // Generate badges (example implementation)
    const badges = [];
    if (user.numberOfPlants >= 10) badges.push("Plant Enthusiast");
    if (totalLikes >= 50) badges.push("Popular Planter");
    if (postCount >= 20) badges.push("Active Gardener");

    // Generate new tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateToken(user._id, true);

    logger.info(`Token refreshed for user: ${user._id}`, {
      userId: user._id,
      method: "refresh_token",
    });

    // Return the same structure as login for consistency
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatarUrl,
        plantsCount: user.numberOfPlants || 0,
        likesCount: totalLikes,
        savedCount: savedPostsCount,
        badges: badges,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error(`Token refresh error: ${error.message}`, {
      stack: error.stack,
    });
    next(error);
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  updateProfile,
  refreshToken,
};
