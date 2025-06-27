const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Comment text is required"],
      trim: true,
      maxlength: [500, "Comment cannot be more than 500 characters"],
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // For reply functionality
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
  },
  { timestamps: true }
);

// Virtual for likes count
CommentSchema.virtual("likesCount").get(function () {
  return this.likes.length;
});

// Enable virtuals in JSON
CommentSchema.set("toJSON", { virtuals: true });
CommentSchema.set("toObject", { virtuals: true });

const Comment = mongoose.model("Comment", CommentSchema);

module.exports = Comment;
