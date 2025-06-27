const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");
const logger = require("../utils/logger");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");

// Helper to upload buffer to Cloudinary via stream
const bufferToStream = (buffer) => {
  const readable = new Readable({
    read() {
      this.push(buffer);
      this.push(null);
    },
  });
  return readable;
};

// Helper function to format comments according to the Comment interface
const formatComment = (comment, userId = null) => {
  return {
    id: comment._id.toString(),
    postId: comment.post.toString(),
    userId: comment.user._id.toString(),
    userName: comment.user.name,
    userAvatar: comment.user.avatarUrl || undefined,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
    likes: comment.likes.length,
    isLiked: userId ? comment.likes.includes(userId) : false,
    parentComment: comment.parentComment
      ? comment.parentComment.toString()
      : null,
  };
};

/**
 * @desc    Create a new post
 * @route   POST /api/posts
 * @access  Private
 */
const createPost = async (req, res, next) => {
  try {
    const { caption, plantType } = req.body;
    let location = req.body.location;
    let image;

    // Parse location if it's a string (from form data)
    if (location && typeof location === "string") {
      try {
        location = JSON.parse(location);
      } catch (error) {
        return res.status(400).json({ message: "Invalid location format" });
      }
    }

    // If there's an image file in the request, upload it to Cloudinary
    if (req.file) {
      logger.info(`Uploading image for new post: ${req.file.originalname}`, {
        userId: req.user._id,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });

      try {
        // Create upload promise
        const uploadPromise = new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "iplant",
              resource_type: "image",
              use_filename: false,
              unique_filename: true,
            },
            (error, result) => {
              if (error) return reject(error);
              return resolve(result);
            }
          );

          // Convert buffer to stream and pipe to Cloudinary
          bufferToStream(req.file.buffer).pipe(uploadStream);
        });

        // Wait for upload to complete
        const result = await uploadPromise;
        image = result.secure_url;

        logger.info(
          `Image uploaded to Cloudinary for new post: ${result.public_id}`
        );
      } catch (uploadError) {
        logger.error(
          `Failed to upload image for post: ${uploadError.message}`,
          {
            userId: req.user._id,
            error: uploadError.message,
          }
        );
        return res.status(500).json({ message: "Failed to upload image" });
      }
    } else if (req.body.image) {
      // If no file but image URL is provided in the body
      image = req.body.image;
    } else {
      return res.status(400).json({ message: "Image is required for a post" });
    }

    const newPost = new Post({
      user: req.user._id,
      image,
      caption,
      location,
      plantType: plantType || "Unknown",
    });

    const post = await newPost.save();

    // If plant type is specified, increment user's plant count
    if (plantType && plantType !== "Unknown") {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { numberOfPlants: 1 },
      });
    }

    res.status(201).json(post);
  } catch (error) {
    logger.error(`Error creating post: ${error.message}`, {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Get all posts
 * @route   GET /api/posts
 * @access  Public (with optional auth)
 */
const getPosts = async (req, res, next) => {
  try {
    // Set pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query based on filters
    const query = {};

    // Filter by user if provided
    if (req.query.user) {
      query.user = req.query.user;
    }

    // Filter by plant type if provided
    if (req.query.plantType) {
      // Allow comma-separated list for multiple types
      const types = req.query.plantType.split(",").map((type) => type.trim());
      if (types.length === 1) {
        query.plantType = types[0];
      } else if (types.length > 1) {
        query.plantType = { $in: types };
      }
    }

    // Filter by time range if provided
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};

      if (req.query.startDate) {
        query.createdAt.$gte = new Date(req.query.startDate);
      }

      if (req.query.endDate) {
        query.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    // Execute query with proper population for user data
    const posts = await Post.find(query)
      .populate("user", "name email avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Count total documents for pagination info
    const totalPosts = await Post.countDocuments(query);

    // Get authenticated user if available for determining liked/saved/commented status
    const userId = req.user ? req.user._id : null;

    // Get post IDs for batch operations
    const postIds = posts.map((post) => post._id);

    // Get comments count for all posts in batch
    const commentsCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);

    // Create a map for quick lookup
    const commentsCountMap = {};
    commentsCounts.forEach((item) => {
      commentsCountMap[item._id.toString()] = item.count;
    });

    // Get user's comments on these posts (to check if user has commented)
    let userCommentsMap = {};
    if (userId) {
      const userComments = await Comment.find({
        post: { $in: postIds },
        user: userId,
      }).select("post");

      userComments.forEach((comment) => {
        const postId = comment.post.toString();
        if (!userCommentsMap[postId]) {
          userCommentsMap[postId] = true;
        }
      });
    }

    // Transform posts to match the required interface
    const formattedPosts = posts.map((post) => {
      const postId = post._id.toString();
      const commentsCount = commentsCountMap[postId] || 0;

      // Base post object with public data
      const formattedPost = {
        id: postId,
        userId: post.user._id.toString(),
        userName: post.user.name,
        userAvatar: post.user.avatarUrl || undefined,
        caption: post.caption || "",
        imageUrl: post.image,
        likes: post.likes.length,
        saves: post.savedBy.length,
        commentsCount,
        plantType: post.plantType || "Unknown",
        location: post.location
          ? {
              coordinates: post.location.coordinates,
              address: post.location.address || "",
            }
          : undefined,
        createdAt: post.createdAt.toISOString(),
      };

      // Add authenticated user-specific fields if user is logged in
      if (userId) {
        formattedPost.isLiked = post.likes.includes(userId);
        formattedPost.isSaved = post.savedBy.includes(userId);
        formattedPost.isCommented = userCommentsMap[postId] || false;
      }

      return formattedPost;
    });

    res.json({
      posts: formattedPosts,
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts,
    });
  } catch (error) {
    logger.error(`Error fetching posts: ${error.message}`, {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Get a single post by ID
 * @route   GET /api/posts/:id
 * @access  Public (with optional auth)
 */
const getPostById = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("user", "name email avatarUrl")
      .populate("likes", "name avatarUrl");

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Get authenticated user if available for determining liked/saved/commented status
    const userId = req.user ? req.user._id : null;

    // Get comments count for this post
    const commentsCount = await Comment.countDocuments({ post: post._id });

    // Base post object with public data
    const formattedPost = {
      id: post._id.toString(),
      userId: post.user._id.toString(),
      userName: post.user.name,
      userAvatar: post.user.avatarUrl || undefined,
      caption: post.caption || "",
      imageUrl: post.image,
      likes: post.likes.length,
      saves: post.savedBy.length,
      commentsCount,
      plantType: post.plantType || "Unknown",
      location: post.location
        ? {
            coordinates: post.location.coordinates,
            address: post.location.address || "",
          }
        : undefined,
      createdAt: post.createdAt.toISOString(),
    };

    // Add authenticated user-specific fields if user is logged in
    if (userId) {
      // Check if current user has liked or saved this post
      const isLiked = post.likes.some(
        (like) => like._id.toString() === userId.toString()
      );
      const isSaved = post.savedBy.includes(userId);

      // Check if current user has commented on this post
      const userComment = await Comment.findOne({
        post: post._id,
        user: userId,
      });
      const isCommented = !!userComment;

      // Add user-specific fields
      formattedPost.isLiked = isLiked;
      formattedPost.isSaved = isSaved;
      formattedPost.isCommented = isCommented;
    }

    res.json(formattedPost);
  } catch (error) {
    logger.error(`Error fetching post by ID: ${error.message}`, {
      postId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Update a post
 * @route   PUT /api/posts/:id
 * @access  Private
 */
const updatePost = async (req, res, next) => {
  try {
    const { caption, location, plantType } = req.body;

    const post = await Post.findById(req.params.id).populate(
      "user",
      "name email avatarUrl"
    );

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if the post belongs to the user
    if (post.user._id.toString() !== req.user._id.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to update this post" });
    }

    // Update fields
    post.caption = caption || post.caption;
    post.location = location || post.location;
    post.plantType = plantType || post.plantType;

    const updatedPost = await post.save();

    // Get comments count for this post
    const commentsCount = await Comment.countDocuments({
      post: updatedPost._id,
    });

    // Check if current user has commented on this post
    const userComment = await Comment.findOne({
      post: updatedPost._id,
      user: req.user._id,
    });
    const isCommented = !!userComment;

    // Format post according to interface
    const formattedPost = {
      id: updatedPost._id.toString(),
      userId: updatedPost.user._id.toString(),
      userName: updatedPost.user.name,
      userAvatar: updatedPost.user.avatarUrl || undefined,
      caption: updatedPost.caption || "",
      imageUrl: updatedPost.image,
      likes: updatedPost.likes.length,
      isLiked: updatedPost.likes.includes(req.user._id),
      isSaved: updatedPost.savedBy.includes(req.user._id),
      isCommented,
      commentsCount,
      plantType: updatedPost.plantType || "Unknown",
      location: updatedPost.location
        ? {
            coordinates: updatedPost.location.coordinates,
            address: updatedPost.location.address || "",
          }
        : undefined,
      createdAt: updatedPost.createdAt.toISOString(),
      comments: [], // Comments array would need to be populated separately if needed
    };

    res.json(formattedPost);
  } catch (error) {
    logger.error(`Error updating post: ${error.message}`, {
      postId: req.params.id,
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Delete a post
 * @route   DELETE /api/posts/:id
 * @access  Private
 */
const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if the post belongs to the user
    if (post.user.toString() !== req.user._id.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to delete this post" });
    }

    // If post has plant type, decrement user's plant count
    if (post.plantType && post.plantType !== "Unknown") {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { numberOfPlants: -1 },
      });
    }

    await Post.deleteOne({ _id: post._id });

    res.json({ message: "Post removed" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle like on a post
 * @route   POST /api/posts/:id/like
 * @access  Private
 */
const toggleLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate(
      "user",
      "name email avatarUrl"
    );

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if the post has already been liked by this user
    const alreadyLiked = post.likes.includes(req.user._id);

    // If already liked, remove like; otherwise, add like
    if (alreadyLiked) {
      post.likes = post.likes.filter(
        (likeId) => likeId.toString() !== req.user._id.toString()
      );
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();

    // Get comments count for this post
    const commentsCount = await Comment.countDocuments({ post: post._id });

    // Check if current user has commented on this post
    const userComment = await Comment.findOne({
      post: post._id,
      user: req.user._id,
    });
    const isCommented = !!userComment;

    // Format post according to interface
    const formattedPost = {
      id: post._id.toString(),
      userId: post.user._id.toString(),
      userName: post.user.name,
      userAvatar: post.user.avatarUrl || undefined,
      caption: post.caption || "",
      imageUrl: post.image,
      likes: post.likes.length,
      isLiked: !alreadyLiked, // Toggled state
      isSaved: post.savedBy.includes(req.user._id),
      isCommented,
      commentsCount,
      plantType: post.plantType || "Unknown",
      location: post.location
        ? {
            coordinates: post.location.coordinates,
            address: post.location.address || "",
          }
        : undefined,
      createdAt: post.createdAt.toISOString(),
      comments: [], // Comments array would need to be populated separately if needed
    };

    res.json({
      post: formattedPost,
      likes: post.likes,
      likesCount: post.likes.length,
      isLiked: !alreadyLiked,
    });
  } catch (error) {
    logger.error(`Error toggling like on post: ${error.message}`, {
      postId: req.params.id,
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Toggle save on a post
 * @route   POST /api/posts/:id/save
 * @access  Private
 */
const toggleSave = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate(
      "user",
      "name email avatarUrl"
    );
    const user = await User.findById(req.user._id);

    if (!post || !user) {
      return res.status(404).json({ message: "Post or user not found" });
    }

    // Check if the post is already saved by this user
    const alreadySaved = post.savedBy.includes(req.user._id);
    const userHasSaved = user.savedPosts.includes(post._id);

    // Update post's savedBy array
    if (alreadySaved) {
      post.savedBy = post.savedBy.filter(
        (userId) => userId.toString() !== req.user._id.toString()
      );
    } else {
      post.savedBy.push(req.user._id);
    }

    // Update user's savedPosts array
    if (userHasSaved) {
      user.savedPosts = user.savedPosts.filter(
        (postId) => postId.toString() !== post._id.toString()
      );
    } else {
      user.savedPosts.push(post._id);
    }

    await Promise.all([post.save(), user.save()]);

    // Get comments count for this post
    const commentsCount = await Comment.countDocuments({ post: post._id });

    // Check if current user has commented on this post
    const userComment = await Comment.findOne({
      post: post._id,
      user: req.user._id,
    });
    const isCommented = !!userComment;

    // Format post according to interface
    const formattedPost = {
      id: post._id.toString(),
      userId: post.user._id.toString(),
      userName: post.user.name,
      userAvatar: post.user.avatarUrl || undefined,
      caption: post.caption || "",
      imageUrl: post.image,
      likes: post.likes.length,
      isLiked: post.likes.includes(req.user._id),
      isSaved: !alreadySaved, // Toggled state
      isCommented,
      commentsCount,
      plantType: post.plantType || "Unknown",
      location: post.location
        ? {
            coordinates: post.location.coordinates,
            address: post.location.address || "",
          }
        : undefined,
      createdAt: post.createdAt.toISOString(),
      comments: [], // Comments array would need to be populated separately if needed
    };

    res.json({
      post: formattedPost,
      savedBy: post.savedBy,
      savesCount: post.savedBy.length,
      isSaved: !alreadySaved,
    });
  } catch (error) {
    logger.error(`Error toggling save on post: ${error.message}`, {
      postId: req.params.id,
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Get nearby posts
 * @route   GET /api/posts/nearby
 * @access  Public (with optional auth)
 */
const getNearbyPosts = async (req, res, next) => {
  try {
    // Get parameters from query with defaults
    const { longitude, latitude, radius = 10, plantType } = req.query;

    // Build the base query for geospatial search
    const baseQuery = {
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseFloat(radius) * 1000,
        },
      },
    };

    // Add optional plant type filter if provided
    if (plantType) {
      // Allow comma-separated list for multiple types
      const types = plantType.split(",").map((type) => type.trim());
      if (types.length === 1) {
        baseQuery.plantType = types[0];
      } else if (types.length > 1) {
        baseQuery.plantType = { $in: types };
      }
    }

    // Find posts using the built query
    const posts = await Post.find(baseQuery)
      .populate("user", "name email avatarUrl")
      .select(
        "_id image caption location plantType createdAt user likes savedBy"
      )
      .sort({ createdAt: -1 });

    // Get authenticated user ID if available
    const userId = req.user ? req.user._id : null;

    // Get post IDs for batch operations
    const postIds = posts.map((post) => post._id);

    // Get comments count for all posts in batch
    const commentsCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);

    // Create a map for quick lookup
    const commentsCountMap = {};
    commentsCounts.forEach((item) => {
      commentsCountMap[item._id.toString()] = item.count;
    });

    // Get user's comments on these posts (to check if user has commented)
    let userCommentsMap = {};
    if (userId) {
      const userComments = await Comment.find({
        post: { $in: postIds },
        user: userId,
      }).select("post");

      userComments.forEach((comment) => {
        const postId = comment.post.toString();
        if (!userCommentsMap[postId]) {
          userCommentsMap[postId] = true;
        }
      });
    }

    // Format posts to match interface
    const formattedPosts = posts.map((post) => {
      const postId = post._id.toString();
      const commentsCount = commentsCountMap[postId] || 0;

      // Base post object with public data
      const formattedPost = {
        id: postId,
        userId: post.user._id.toString(),
        userName: post.user.name,
        userAvatar: post.user.avatarUrl || undefined,
        caption: post.caption || "",
        imageUrl: post.image,
        likes: post.likes.length,
        saves: post.savedBy.length,
        commentsCount,
        plantType: post.plantType || "Unknown",
        location: post.location
          ? {
              coordinates: post.location.coordinates,
              address: post.location.address || "",
            }
          : undefined,
        createdAt: post.createdAt.toISOString(),
      };

      // Add authenticated user-specific fields if user is logged in
      if (userId) {
        formattedPost.isLiked = post.likes.includes(userId);
        formattedPost.isSaved = post.savedBy.includes(userId);
        formattedPost.isCommented = userCommentsMap[postId] || false;
      }

      return formattedPost;
    });

    // Format as GeoJSON-compatible response for frontend mapping
    const geoJSONResponse = {
      type: "FeatureCollection",
      features: posts.map((post) => {
        const postId = post._id.toString();
        const commentsCount = commentsCountMap[postId] || 0;

        // Base feature properties with public data
        const properties = {
          id: post._id,
          image: post.image,
          caption: post.caption,
          plantType: post.plantType,
          createdAt: post.createdAt,
          user: {
            id: post.user._id,
            name: post.user.name,
            avatarUrl: post.user.avatarUrl,
          },
          address: post.location.address || "",
          likes: post.likes.length,
          saves: post.savedBy.length,
          commentsCount,
        };

        // Add authenticated user-specific fields if user is logged in
        if (userId) {
          properties.isLiked = post.likes.includes(userId);
          properties.isSaved = post.savedBy.includes(userId);
          properties.isCommented = userCommentsMap[postId] || false;
        }

        return {
          type: "Feature",
          geometry: {
            type: post.location.type,
            coordinates: post.location.coordinates,
          },
          properties,
        };
      }),
    };

    // Return both standard posts array and GeoJSON format
    res.json({
      posts: formattedPosts,
      geoJSON: geoJSONResponse,
      count: posts.length,
      searchParams: {
        center: [parseFloat(longitude), parseFloat(latitude)],
        radiusKm: parseFloat(radius),
        plantType: plantType || "All",
      },
    });
  } catch (error) {
    logger.error(`Error fetching nearby posts: ${error.message}`, {
      lng: req.query.longitude,
      lat: req.query.latitude,
      distance: req.query.radius,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Get filter examples with dummy data
 * @route   GET /api/posts/filter-examples
 * @access  Public
 */
const getFilterExamples = async (req, res, next) => {
  try {
    // Get query parameters for example purposes
    const {
      plantType,
      startDate,
      endDate,
      user,
      page = 1,
      limit = 10,
    } = req.query;

    // Create a dummy response demonstrating the filters that would be applied
    const dummyResponse = {
      message: "This is an example response showing how filters work",
      appliedFilters: {
        pagination: { page: parseInt(page), limit: parseInt(limit) },
        timeRange: {
          startDate: startDate || "Not specified",
          endDate: endDate || "Not specified",
          example: "?startDate=2023-10-01&endDate=2023-11-01",
        },
        plantTypeFilter: {
          requestedTypes: plantType
            ? plantType.split(",").map((type) => type.trim())
            : "Not specified",
          example: "?plantType=Rose,Tulip,Sunflower",
        },
        userFilter: {
          userId: user || "Not specified",
          example: "?user=65a3f4c887d34b287d9e1234",
        },
      },
      exampleApiCalls: [
        "/api/posts?plantType=Rose,Tulip&startDate=2023-09-01&endDate=2023-12-31",
        "/api/posts?user=65a3f4c887d34b287d9e1234&page=1&limit=20",
        "/api/posts?startDate=2023-10-01",
      ],
      dummyPosts: [
        {
          _id: "65a3f4c887d34b287d9e5678",
          image:
            "https://res.cloudinary.com/demo/image/upload/v1/iplant/rose.jpg",
          caption: "My beautiful rose plant!",
          plantType: "Rose",
          location: {
            type: "Point",
            coordinates: [-73.985428, 40.748817],
            address: "New York, NY",
          },
          createdAt: "2023-10-15T14:30:00Z",
          user: {
            _id: "65a3f4c887d34b287d9e1234",
            name: "John Doe",
            avatarUrl:
              "https://res.cloudinary.com/demo/image/upload/v1/iplant/users/john.jpg",
          },
          likesCount: 24,
          savesCount: 5,
        },
        {
          _id: "65a3f4c887d34b287d9e5679",
          image:
            "https://res.cloudinary.com/demo/image/upload/v1/iplant/tulip.jpg",
          caption: "Spring tulips in my garden",
          plantType: "Tulip",
          location: {
            type: "Point",
            coordinates: [-122.419416, 37.774929],
            address: "San Francisco, CA",
          },
          createdAt: "2023-11-02T09:15:00Z",
          user: {
            _id: "65a3f4c887d34b287d9e1235",
            name: "Jane Smith",
            avatarUrl:
              "https://res.cloudinary.com/demo/image/upload/v1/iplant/users/jane.jpg",
          },
          likesCount: 31,
          savesCount: 8,
        },
        {
          _id: "65a3f4c887d34b287d9e5680",
          image:
            "https://res.cloudinary.com/demo/image/upload/v1/iplant/sunflower.jpg",
          caption: "My sunflowers are so tall now!",
          plantType: "Sunflower",
          location: {
            type: "Point",
            coordinates: [-87.629798, 41.878114],
            address: "Chicago, IL",
          },
          createdAt: "2023-09-22T16:45:00Z",
          user: {
            _id: "65a3f4c887d34b287d9e1234",
            name: "John Doe",
            avatarUrl:
              "https://res.cloudinary.com/demo/image/upload/v1/iplant/users/john.jpg",
          },
          likesCount: 42,
          savesCount: 12,
        },
      ],
    };

    res.json(dummyResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add a comment to a post
 * @route   POST /api/posts/:id/comments
 * @access  Private
 */
const addComment = async (req, res, next) => {
  try {
    const { text, parentComment } = req.body;
    const postId = req.params.id;

    // Validate the post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Create a new comment
    const newComment = new Comment({
      post: postId,
      user: req.user._id,
      text,
      parentComment: parentComment || null,
    });

    // Save the comment
    const savedComment = await newComment.save();

    // Populate user information for the response
    const populatedComment = await Comment.findById(savedComment._id)
      .populate("user", "name avatarUrl")
      .populate("parentComment");

    // Format the comment for response
    const formattedComment = formatComment(populatedComment, req.user._id);

    logger.info(`Comment added to post ${postId}`, {
      userId: req.user._id,
      postId,
      commentId: savedComment._id,
    });

    res.status(201).json({
      message: "Comment added successfully",
      comment: formattedComment,
    });
  } catch (error) {
    logger.error(`Error adding comment: ${error.message}`, {
      postId: req.params.id,
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Get all comments for a post
 * @route   GET /api/posts/:id/comments
 * @access  Public
 */
const getComments = async (req, res, next) => {
  try {
    const postId = req.params.id;
    const userId = req.user ? req.user._id : null;

    // Validate the post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get top-level comments (null parentComment)
    const rootComments = await Comment.find({
      post: postId,
      parentComment: null,
    })
      .populate("user", "name avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // For each root comment, get replies (optional, can be paginated separately)
    const commentsWithReplies = await Promise.all(
      rootComments.map(async (comment) => {
        const replies = await Comment.find({ parentComment: comment._id })
          .populate("user", "name avatarUrl")
          .sort({ createdAt: 1 })
          .limit(5); // Limit to first 5 replies, rest can be loaded separately

        const formattedReplies = replies.map((reply) =>
          formatComment(reply, userId)
        );
        const formattedComment = formatComment(comment, userId);

        return {
          ...formattedComment,
          replies: formattedReplies,
          replyCount: await Comment.countDocuments({
            parentComment: comment._id,
          }),
        };
      })
    );

    // Count total comments for pagination info
    const totalComments = await Comment.countDocuments({
      post: postId,
      parentComment: null,
    });

    res.json({
      comments: commentsWithReplies,
      currentPage: page,
      totalPages: Math.ceil(totalComments / limit),
      totalComments,
    });
  } catch (error) {
    logger.error(`Error fetching comments: ${error.message}`, {
      postId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Get replies for a specific comment
 * @route   GET /api/posts/:id/comments/:commentId/replies
 * @access  Public
 */
const getCommentReplies = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user ? req.user._id : null;

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Validate the comment exists
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Get replies for the comment
    const replies = await Comment.find({ parentComment: commentId })
      .populate("user", "name avatarUrl")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    // Format replies
    const formattedReplies = replies.map((reply) =>
      formatComment(reply, userId)
    );

    // Count total replies for pagination
    const totalReplies = await Comment.countDocuments({
      parentComment: commentId,
    });

    res.json({
      replies: formattedReplies,
      parentComment: commentId,
      currentPage: page,
      totalPages: Math.ceil(totalReplies / limit),
      totalReplies,
    });
  } catch (error) {
    logger.error(`Error fetching comment replies: ${error.message}`, {
      commentId: req.params.commentId,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Delete a comment
 * @route   DELETE /api/posts/:id/comments/:commentId
 * @access  Private
 */
const deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    // Find the comment
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check if the user is authorized to delete the comment
    if (comment.user.toString() !== req.user._id.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to delete this comment" });
    }

    // If parent comment, delete all replies
    if (!comment.parentComment) {
      await Comment.deleteMany({ parentComment: commentId });
    }

    // Delete the comment
    await Comment.deleteOne({ _id: commentId });

    logger.info(`Comment deleted: ${commentId}`, {
      userId: req.user._id,
      postId: req.params.id,
      commentId,
    });

    res.json({ message: "Comment deleted" });
  } catch (error) {
    logger.error(`Error deleting comment: ${error.message}`, {
      commentId: req.params.commentId,
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Toggle like on a comment
 * @route   POST /api/posts/:id/comments/:commentId/like
 * @access  Private
 */
const toggleCommentLike = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    // Find the comment
    const comment = await Comment.findById(commentId).populate(
      "user",
      "name avatarUrl"
    );

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check if already liked
    const alreadyLiked = comment.likes.includes(req.user._id);

    // Toggle like
    if (alreadyLiked) {
      comment.likes = comment.likes.filter(
        (like) => like.toString() !== req.user._id.toString()
      );
    } else {
      comment.likes.push(req.user._id);
    }

    // Save the comment
    await comment.save();

    // Format the comment
    const formattedComment = formatComment(comment, req.user._id);

    res.json({
      message: alreadyLiked ? "Comment unliked" : "Comment liked",
      comment: formattedComment,
      isLiked: !alreadyLiked,
    });
  } catch (error) {
    logger.error(`Error toggling comment like: ${error.message}`, {
      commentId: req.params.commentId,
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

module.exports = {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  toggleLike,
  toggleSave,
  getNearbyPosts,
  getFilterExamples,
  // Comment-related exports
  addComment,
  getComments,
  getCommentReplies,
  deleteComment,
  toggleCommentLike,
};
