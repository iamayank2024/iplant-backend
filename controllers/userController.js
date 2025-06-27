const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");

/**
 * @desc    Get user profile
 * @route   GET /api/users/:id
 * @access  Public
 */
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user stats

    const posts = await Post.find({ user: user._id });

    const likesReceived = await Post.aggregate([
      { $match: { user: user._id } },
      { $project: { likesCount: { $size: "$likes" } } },
      { $group: { _id: null, total: { $sum: "$likesCount" } } },
    ]);

    const totalLikes = likesReceived.length > 0 ? likesReceived[0].total : 0;
    const savedPostsCount = user.savedPosts.length;

    // Get environmental impact score
    const environmentalImpact = user.numberOfPlants * 20;

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      location: user.location,
      bio: user.bio,
      stats: {
        posts: posts.length,
        plants: user.numberOfPlants,
        likesReceived: totalLikes,
        savedPosts: savedPostsCount,
        environmentalImpact,
      },
      createdAt: user.createdAt,
      posts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's posts
 * @route   GET /api/users/:id/posts
 * @access  Public
 */
const getUserPosts = async (req, res, next) => {
  try {
    // Set pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ user: req.params.id })
      .populate("user", "name email avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments({ user: req.params.id });

    // Get authenticated user if available for determining liked/saved/commented status
    const userId = req.params.id ? req.params.id : null;

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

      // Check if current user has liked, saved, or commented on this post
      const isLiked = userId ? post.likes.includes(userId) : false;
      const isSaved = userId ? post.savedBy.includes(userId) : false;
      const isCommented = userId ? userCommentsMap[postId] || false : false;
      const commentsCount = commentsCountMap[postId] || 0;

      return {
        id: postId,
        userId: post.user._id.toString(),
        userName: post.user.name,
        userAvatar: post.user.avatarUrl || undefined,
        caption: post.caption || "",
        imageUrl: post.image,
        likes: post.likes.length,
        isLiked,
        isSaved,
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
    });

    res.json({
      posts: formattedPosts,
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts,
    });
  } catch (error) {
    logger.error(`Error fetching user posts: ${error.message}`, {
      userId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Get user's saved posts
 * @route   GET /api/users/:id/saved
 * @access  Private
 */
const getUserSavedPosts = async (req, res, next) => {
  try {
    // Check if the requesting user is the same as the profile user
    if (req.user._id.toString() !== req.params.id) {
      return res.status(401).json({
        message: "Not authorized to access saved posts of another user",
      });
    }

    const user = await User.findById(req.params.id).populate({
      path: "savedPosts",
      populate: {
        path: "user",
        select: "name avatarUrl",
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get post IDs for batch operations
    const postIds = user.savedPosts.map((post) => post._id);

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
    const userComments = await Comment.find({
      post: { $in: postIds },
      user: req.user._id,
    }).select("post");

    const userCommentsMap = {};
    userComments.forEach((comment) => {
      const postId = comment.post.toString();
      if (!userCommentsMap[postId]) {
        userCommentsMap[postId] = true;
      }
    });

    // Transform saved posts to match the required interface
    const formattedPosts = user.savedPosts.map((post) => {
      const postId = post._id.toString();
      const commentsCount = commentsCountMap[postId] || 0;
      const isCommented = userCommentsMap[postId] || false;

      return {
        id: postId,
        userId: post.user._id.toString(),
        userName: post.user.name,
        userAvatar: post.user.avatarUrl || undefined,
        caption: post.caption || "",
        imageUrl: post.image,
        likes: post.likes.length,
        isLiked: post.likes.includes(req.user._id),
        isSaved: true, // Since these are saved posts
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
    });

    res.json({
      posts: formattedPosts,
      count: formattedPosts.length,
    });
  } catch (error) {
    logger.error(`Error fetching saved posts: ${error.message}`, {
      userId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Get leaderboard
 * @route   GET /api/users/leaderboard
 * @access  Public
 */
const getLeaderboard = async (req, res, next) => {
  try {
    const sortBy = req.query.sortBy || "plants";
    const limit = parseInt(req.query.limit) || 10;
    const timeRange = req.query.timeRange || "all"; // week, month, all
    const category = req.query.category || "plants"; // plants, co2, engagement
    let users;

    // Build time filter based on timeRange
    let timeFilter = {};
    if (timeRange === "week") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      timeFilter = { createdAt: { $gte: oneWeekAgo } };
    } else if (timeRange === "month") {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      timeFilter = { createdAt: { $gte: oneMonthAgo } };
    }
    // For "all", timeFilter remains empty object

    switch (category) {
      case "plants":
        // Sort by number of plants (environmental impact)
        if (timeRange === "all") {
          // For "all" time, use user's total plant count
          users = await User.find()
            .sort({ numberOfPlants: -1 })
            .limit(limit)
            .select("name avatarUrl numberOfPlants");
        } else {
          // For week/month, count plants from posts in that time range
          const plantPosts = await Post.aggregate([
            { $match: { ...timeFilter, plantType: { $ne: "Unknown" } } },
            { $group: { _id: "$user", plantCount: { $sum: 1 } } },
            { $sort: { plantCount: -1 } },
            { $limit: limit },
          ]);

          const userIds = plantPosts.map((item) => item._id);
          users = await User.find({ _id: { $in: userIds } }).select(
            "name avatarUrl numberOfPlants"
          );

          // Combine user data with plant counts
          users = users.map((user) => {
            const plantData = plantPosts.find(
              (post) => post._id.toString() === user._id.toString()
            );
            return {
              _id: user._id,
              name: user.name,
              avatarUrl: user.avatarUrl,
              numberOfPlants: user.numberOfPlants,
              score: plantData ? plantData.plantCount : 0,
              category: "plants",
              rank: 0,
            };
          });
          users.sort((a, b) => b.score - a.score);
        }

        if (timeRange === "all") {
          users = users.map((user) => ({
            _id: user._id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            numberOfPlants: user.numberOfPlants,
            score: user.numberOfPlants,
            category: "plants",
            rank: 0,
          }));
        }
        break;

      case "co2":
        // Sort by environmental impact (CO2 reduction)
        if (timeRange === "all") {
          // For "all" time, use user's total environmental impact
          users = await User.find()
            .sort({ numberOfPlants: -1 })
            .limit(limit)
            .select("name avatarUrl numberOfPlants");
        } else {
          // For week/month, calculate environmental impact from posts in that time range
          const impactPosts = await Post.aggregate([
            { $match: { ...timeFilter, plantType: { $ne: "Unknown" } } },
            { $group: { _id: "$user", plantCount: { $sum: 1 } } },
            { $sort: { plantCount: -1 } },
            { $limit: limit },
          ]);

          const userIds = impactPosts.map((item) => item._id);
          users = await User.find({ _id: { $in: userIds } }).select(
            "name avatarUrl numberOfPlants"
          );

          // Combine user data with impact scores
          users = users.map((user) => {
            const impactData = impactPosts.find(
              (post) => post._id.toString() === user._id.toString()
            );
            return {
              _id: user._id,
              name: user.name,
              avatarUrl: user.avatarUrl,
              numberOfPlants: user.numberOfPlants,
              score: impactData ? impactData.plantCount * 20 : 0, // 20 CO2 points per plant
              category: "co2",
              rank: 0,
            };
          });
          users.sort((a, b) => b.score - a.score);
        }

        if (timeRange === "all") {
          users = users.map((user) => ({
            _id: user._id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            numberOfPlants: user.numberOfPlants,
            score: user.numberOfPlants * 20, // Environmental impact score
            category: "co2",
            rank: 0,
          }));
        }
        break;

      case "engagement":
        // Sort by engagement (posts + likes + comments)
        const engagementData = await Promise.all([
          // Posts count
          Post.aggregate([
            { $match: timeFilter },
            { $group: { _id: "$user", postCount: { $sum: 1 } } },
          ]),
          // Likes received
          Post.aggregate([
            { $match: timeFilter },
            { $project: { user: 1, likesCount: { $size: "$likes" } } },
            { $group: { _id: "$user", totalLikes: { $sum: "$likesCount" } } },
          ]),
          // Comments made
          Comment.aggregate([
            { $match: timeFilter },
            { $group: { _id: "$user", commentCount: { $sum: 1 } } },
          ]),
        ]);

        const [postCounts, likeCounts, commentCounts] = engagementData;

        // Combine all engagement metrics
        const engagementMap = new Map();

        // Add post counts
        postCounts.forEach((item) => {
          engagementMap.set(item._id.toString(), {
            posts: item.postCount,
            likes: 0,
            comments: 0,
            total: item.postCount,
          });
        });

        // Add like counts
        likeCounts.forEach((item) => {
          const existing = engagementMap.get(item._id.toString()) || {
            posts: 0,
            likes: 0,
            comments: 0,
            total: 0,
          };
          existing.likes = item.totalLikes;
          existing.total += item.totalLikes;
          engagementMap.set(item._id.toString(), existing);
        });

        // Add comment counts
        commentCounts.forEach((item) => {
          const existing = engagementMap.get(item._id.toString()) || {
            posts: 0,
            likes: 0,
            comments: 0,
            total: 0,
          };
          existing.comments = item.commentCount;
          existing.total += item.commentCount;
          engagementMap.set(item._id.toString(), existing);
        });

        // Sort by total engagement and get top users
        const sortedEngagement = Array.from(engagementMap.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, limit);

        const userIds = sortedEngagement.map((item) => item[0]);
        users = await User.find({ _id: { $in: userIds } }).select(
          "name avatarUrl numberOfPlants"
        );

        // Combine user data with engagement scores
        users = users.map((user) => {
          const engagementData = engagementMap.get(user._id.toString());
          return {
            _id: user._id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            numberOfPlants: user.numberOfPlants,
            score: engagementData ? engagementData.total : 0,
            category: "engagement",
            engagement: engagementData || { posts: 0, likes: 0, comments: 0 },
            rank: 0,
          };
        });

        users.sort((a, b) => b.score - a.score);
        break;

      default:
        // Fallback to plants category
        users = await User.find()
          .sort({ numberOfPlants: -1 })
          .limit(limit)
          .select("name avatarUrl numberOfPlants");

        users = users.map((user) => ({
          _id: user._id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          numberOfPlants: user.numberOfPlants,
          score: user.numberOfPlants,
          category: "plants",
          rank: 0,
        }));
        break;
    }

    // Add rank to each user
    users.forEach((user, index) => {
      user.rank = index + 1;
    });

    res.json({
      leaderboard: users,
      category,
      timeRange,
      limit,
      totalUsers: users.length,
    });
  } catch (error) {
    logger.error(`Error fetching leaderboard: ${error.message}`, {
      sortBy: req.query.sortBy,
      category: req.query.category,
      timeRange: req.query.timeRange,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * @desc    Get leaderboard statistics
 * @route   GET /api/users/leaderboard/stats
 * @access  Public
 */
const getLeaderboardStats = async (req, res, next) => {
  try {
    const timeRange = req.query.timeRange || "all"; // week, month, all
    const category = req.query.category || "plants"; // plants, co2, engagement

    // Build time filter based on timeRange
    let timeFilter = {};
    if (timeRange === "week") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      timeFilter = { createdAt: { $gte: oneWeekAgo } };
    } else if (timeRange === "month") {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      timeFilter = { createdAt: { $gte: oneMonthAgo } };
    }

    // Get overall platform statistics based on time range
    const [
      totalUsers,
      totalPosts,
      totalComments,
      totalLikes,
      totalPlants,
      topPlantGrower,
      mostActiveUser,
      mostLikedUser,
      mostCommentedUser,
    ] = await Promise.all([
      // Total users (always all time)
      User.countDocuments(),

      // Total posts in time range
      Post.countDocuments(timeFilter),

      // Total comments in time range
      Comment.countDocuments(timeFilter),

      // Total likes in time range
      Post.aggregate([
        { $match: timeFilter },
        { $project: { likesCount: { $size: "$likes" } } },
        { $group: { _id: null, total: { $sum: "$likesCount" } } },
      ]),

      // Total plants in time range
      Post.aggregate([
        { $match: { ...timeFilter, plantType: { $ne: "Unknown" } } },
        { $group: { _id: null, total: { $sum: 1 } } },
      ]),

      // Top plant grower in time range
      timeRange === "all"
        ? User.findOne()
            .sort({ numberOfPlants: -1 })
            .select("name numberOfPlants")
        : Post.aggregate([
            { $match: { ...timeFilter, plantType: { $ne: "Unknown" } } },
            { $group: { _id: "$user", plantCount: { $sum: 1 } } },
            { $sort: { plantCount: -1 } },
            { $limit: 1 },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user",
              },
            },
            { $unwind: "$user" },
            { $project: { name: "$user.name", plantCount: 1 } },
          ]),

      // Most active user (most posts) in time range
      Post.aggregate([
        { $match: timeFilter },
        { $group: { _id: "$user", postCount: { $sum: 1 } } },
        { $sort: { postCount: -1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        { $project: { name: "$user.name", postCount: 1 } },
      ]),

      // Most liked user in time range
      Post.aggregate([
        { $match: timeFilter },
        { $project: { user: 1, likesCount: { $size: "$likes" } } },
        { $group: { _id: "$user", totalLikes: { $sum: "$likesCount" } } },
        { $sort: { totalLikes: -1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        { $project: { name: "$user.name", totalLikes: 1 } },
      ]),

      // Most commented user in time range
      Comment.aggregate([
        { $match: timeFilter },
        { $group: { _id: "$user", commentCount: { $sum: 1 } } },
        { $sort: { commentCount: -1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        { $project: { name: "$user.name", commentCount: 1 } },
      ]),
    ]);

    // Calculate totals
    const totalLikesCount = totalLikes.length > 0 ? totalLikes[0].total : 0;
    const totalPlantsCount = totalPlants.length > 0 ? totalPlants[0].total : 0;
    const environmentalImpact = totalPlantsCount * 20; // 20 points per plant

    // Get top 3 users in each category based on time range
    const [topPlantGrowers, topPosters, topLikedUsers, topCommenters] =
      await Promise.all([
        // Top 3 plant growers in time range
        timeRange === "all"
          ? User.find()
              .sort({ numberOfPlants: -1 })
              .limit(3)
              .select("name numberOfPlants")
          : Post.aggregate([
              { $match: { ...timeFilter, plantType: { $ne: "Unknown" } } },
              { $group: { _id: "$user", plantCount: { $sum: 1 } } },
              { $sort: { plantCount: -1 } },
              { $limit: 3 },
              {
                $lookup: {
                  from: "users",
                  localField: "_id",
                  foreignField: "_id",
                  as: "user",
                },
              },
              { $unwind: "$user" },
              { $project: { name: "$user.name", plantCount: 1 } },
            ]),

        // Top 3 posters in time range
        Post.aggregate([
          { $match: timeFilter },
          { $group: { _id: "$user", postCount: { $sum: 1 } } },
          { $sort: { postCount: -1 } },
          { $limit: 3 },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          { $project: { name: "$user.name", postCount: 1 } },
        ]),

        // Top 3 most liked users in time range
        Post.aggregate([
          { $match: timeFilter },
          { $project: { user: 1, likesCount: { $size: "$likes" } } },
          { $group: { _id: "$user", totalLikes: { $sum: "$likesCount" } } },
          { $sort: { totalLikes: -1 } },
          { $limit: 3 },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          { $project: { name: "$user.name", totalLikes: 1 } },
        ]),

        // Top 3 commenters in time range
        Comment.aggregate([
          { $match: timeFilter },
          { $group: { _id: "$user", commentCount: { $sum: 1 } } },
          { $sort: { commentCount: -1 } },
          { $limit: 3 },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          { $project: { name: "$user.name", commentCount: 1 } },
        ]),
      ]);

    // Handle top plant grower data
    let topPlantGrowerData = null;
    if (timeRange === "all") {
      topPlantGrowerData = topPlantGrower
        ? {
            name: topPlantGrower.name,
            plants: topPlantGrower.numberOfPlants,
          }
        : null;
    } else {
      topPlantGrowerData =
        topPlantGrower.length > 0
          ? {
              name: topPlantGrower[0].name,
              plants: topPlantGrower[0].plantCount,
            }
          : null;
    }

    // Format top 3 data
    const formatTopThree = (data, key) => {
      return data.map((user, index) => ({
        rank: index + 1,
        name: user.name,
        [key]:
          timeRange === "all" && key === "plants"
            ? user.numberOfPlants
            : user[key],
      }));
    };

    res.json({
      platformStats: {
        totalUsers,
        totalPosts,
        totalComments,
        totalLikes: totalLikesCount,
        totalPlants: totalPlantsCount,
        environmentalImpact,
        timeRange,
        category,
      },
      topPerformers: {
        topPlantGrower: topPlantGrowerData,
        mostActiveUser: mostActiveUser.length > 0 ? mostActiveUser[0] : null,
        mostLikedUser: mostLikedUser.length > 0 ? mostLikedUser[0] : null,
        mostCommentedUser:
          mostCommentedUser.length > 0 ? mostCommentedUser[0] : null,
      },
      topThree: {
        plantGrowers: formatTopThree(
          topPlantGrowers,
          timeRange === "all" ? "plants" : "plantCount"
        ),
        posters: formatTopThree(topPosters, "postCount"),
        mostLiked: formatTopThree(topLikedUsers, "totalLikes"),
        commenters: formatTopThree(topCommenters, "commentCount"),
      },
    });
  } catch (error) {
    logger.error(`Error fetching leaderboard stats: ${error.message}`, {
      timeRange: req.query.timeRange,
      category: req.query.category,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

module.exports = {
  getUserProfile,
  getUserPosts,
  getUserSavedPosts,
  getLeaderboard,
  getLeaderboardStats,
};
