const express = require("express");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/multer");
const { handleMulterErrors } = require("../middleware/multer");
const {
  uploadImage,
  deleteImage,
  uploadProfileImage,
  uploadMultipleImages,
} = require("../controllers/uploadController");

const router = express.Router();

// All upload routes are protected
router.post(
  "/",
  protect,
  upload.single("image"),
  handleMulterErrors,
  uploadImage
);
router.post(
  "/multiple",
  protect,
  upload.array("images", 10),
  handleMulterErrors,
  uploadMultipleImages
);
router.post(
  "/profile",
  protect,
  upload.single("image"),
  handleMulterErrors,
  uploadProfileImage
);
router.delete("/:publicId", protect, deleteImage);

module.exports = router;
