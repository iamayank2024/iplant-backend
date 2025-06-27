const mongoose = require("mongoose");

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
