const cloudinary = require("../config/cloudinary");
const User = require("../models/User");
const logger = require("../utils/logger");
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

/**
 * @desc    Upload image to Cloudinary
 * @route   POST /api/upload
 * @access  Private
 */
const uploadImage = async (req, res, next) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    logger.info(`Processing image upload: ${req.file.originalname}`, {
      userId: req.user._id,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    // Upload options
    const uploadOptions = {
      folder: "iplant",
      resource_type: "image",
      use_filename: false,
      unique_filename: true,
    };

    // Add transformation options if provided in query
    if (req.query.width && req.query.height) {
      uploadOptions.transformation = [
        {
          width: parseInt(req.query.width),
          height: parseInt(req.query.height),
          crop: req.query.crop || "fill",
        },
      ];
    }

    // Create upload promise
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
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

    logger.info(
      `Image successfully uploaded to Cloudinary: ${result.public_id}`
    );

    // Return the secure URL
    res.json({
      message: "Image uploaded successfully",
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    });
  } catch (error) {
    logger.error(`Image upload failed: ${error.message}`, {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });

    next(error);
  }
};

/**
 * @desc    Delete image from Cloudinary
 * @route   DELETE /api/upload/:publicId
 * @access  Private
 */
const deleteImage = async (req, res, next) => {
  try {
    const { publicId } = req.params;

    // Delete image from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === "ok") {
      res.json({ message: "Image deleted successfully" });
    } else {
      res.status(404).json({ message: "Image not found or already deleted" });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload profile image (avatar or cover image)
 * @route   POST /api/upload/profile
 * @access  Private
 */
const uploadProfileImage = async (req, res, next) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { type } = req.query; // 'avatar' or 'cover'

    if (!type || (type !== "avatar" && type !== "cover")) {
      return res.status(400).json({
        message: "Image type must be specified as either 'avatar' or 'cover'",
      });
    }

    // Set upload options for Cloudinary
    const uploadOptions = {
      folder: `iplant/profiles/${type === "avatar" ? "avatars" : "covers"}`,
      resource_type: "image",
      use_filename: false,
      unique_filename: true,
      transformation:
        type === "avatar"
          ? [{ width: 400, height: 400, crop: "fill", gravity: "face" }]
          : [{ width: 1200, height: 400, crop: "fill" }],
    };

    // Create upload promise
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
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

    // Update user profile directly
    const fieldToUpdate = type === "avatar" ? "avatarUrl" : "coverImageUrl";

    await User.findByIdAndUpdate(req.user._id, {
      [fieldToUpdate]: result.secure_url,
    });

    // Return the secure URL and update status
    res.json({
      message: `${
        type === "avatar" ? "Avatar" : "Cover image"
      } uploaded successfully`,
      url: result.secure_url,
      public_id: result.public_id,
      field: fieldToUpdate,
    });
  } catch (error) {
    logger.error(`Profile image upload failed: ${error.message}`, {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });

    next(error);
  }
};

/**
 * @desc    Upload multiple images to Cloudinary
 * @route   POST /api/upload/multiple
 * @access  Private
 */
const uploadMultipleImages = async (req, res, next) => {
  try {
    // Check if files exist
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    logger.info(`Processing multiple image upload: ${req.files.length} files`, {
      userId: req.user._id,
      fileCount: req.files.length,
    });

    // Upload each file to Cloudinary
    const uploadPromises = req.files.map(async (file) => {
      try {
        // Set upload options
        const uploadOptions = {
          folder: "iplant",
          resource_type: "image",
          use_filename: false,
          unique_filename: true,
        };

        // Create individual file upload promise
        const uploadPromise = new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) return reject(error);
              return resolve(result);
            }
          );

          // Convert buffer to stream and pipe to Cloudinary
          bufferToStream(file.buffer).pipe(uploadStream);
        });

        // Wait for this specific file upload to complete
        const result = await uploadPromise;

        // Return result
        return {
          originalName: file.originalname,
          url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
        };
      } catch (error) {
        logger.error(
          `Error uploading file ${file.originalname}: ${error.message}`
        );
        throw error;
      }
    });

    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);

    logger.info(
      `Multiple image upload complete: ${results.length} images uploaded`
    );

    // Return results
    res.json({
      message: `${results.length} images uploaded successfully`,
      images: results,
    });
  } catch (error) {
    logger.error(`Multiple image upload failed: ${error.message}`, {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });

    next(error);
  }
};

module.exports = {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  uploadProfileImage,
};
