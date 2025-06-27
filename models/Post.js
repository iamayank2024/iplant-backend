const mongoose = require("mongoose");

/**
 * @swagger
 * components:
 *   schemas:
 *     Post:
 *       type: object
 *       required:
 *         - user
 *         - image
 *       properties:
 *         user:
 *           type: string
 *           description: Reference to the user who created the post
 *         image:
 *           type: string
 *           description: URL of the post image
 *         caption:
 *           type: string
 *           description: Caption for the post
 *         plantType:
 *           type: string
 *           description: Type of plant in the post
 *         location:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [Point]
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *             address:
 *               type: string
 *         likes:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of user IDs who liked the post
 *         savedBy:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of user IDs who saved the post
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the post was created
 *     PostResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         userName:
 *           type: string
 *         userAvatar:
 *           type: string
 *         caption:
 *           type: string
 *         imageUrl:
 *           type: string
 *         likes:
 *           type: number
 *         isLiked:
 *           type: boolean
 *         isSaved:
 *           type: boolean
 *         isCommented:
 *           type: boolean
 *         commentsCount:
 *           type: number
 *         plantType:
 *           type: string
 *         location:
 *           type: object
 *           properties:
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *             address:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 */

const PostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    image: {
      type: String,
      required: [true, "Image URL is required"],
    },
    caption: {
      type: String,
      trim: true,
      maxlength: [500, "Caption cannot be more than 500 characters"],
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      address: {
        type: String,
        default: "",
      },
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    savedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    plantType: {
      type: String,
      default: "Unknown",
    },
    environmentalImpact: {
      type: Number,
      default: 20, // Base environmental impact score per plant
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Create a geospatial index on the location field
PostSchema.index({ location: "2dsphere" });

// Virtual for likes count
PostSchema.virtual("likesCount").get(function () {
  return this.likes.length;
});

// Virtual for saves count
PostSchema.virtual("savesCount").get(function () {
  return this.savedBy.length;
});

// Virtual for comments - this will populate comments related to this post
PostSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "post",
  options: { sort: { createdAt: -1 } },
});

const Post = mongoose.model("Post", PostSchema);

module.exports = Post;
