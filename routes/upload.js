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

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload a single image
 *     tags: [Upload]
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
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                 public_id:
 *                   type: string
 *                 width:
 *                   type: number
 *                 height:
 *                   type: number
 *                 format:
 *                   type: string
 */
router.post(
  "/",
  protect,
  upload.single("image"),
  handleMulterErrors,
  uploadImage
);

/**
 * @swagger
 * /api/upload/multiple:
 *   post:
 *     summary: Upload multiple images (up to 10)
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - images
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       url:
 *                         type: string
 *                       public_id:
 *                         type: string
 */
router.post(
  "/multiple",
  protect,
  upload.array("images", 10),
  handleMulterErrors,
  uploadMultipleImages
);

/**
 * @swagger
 * /api/upload/profile:
 *   post:
 *     summary: Upload profile image (avatar or cover)
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *               - type
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *               type:
 *                 type: string
 *                 enum: [avatar, cover]
 *     responses:
 *       200:
 *         description: Profile image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                 public_id:
 *                   type: string
 */
router.post(
  "/profile",
  protect,
  upload.single("avatar"),
  handleMulterErrors,
  uploadProfileImage
);

/**
 * @swagger
 * /api/upload/{publicId}:
 *   delete:
 *     summary: Delete an uploaded image
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema:
 *           type: string
 *         description: Public ID of the image to delete
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       404:
 *         description: Image not found
 */
router.delete("/:publicId", protect, deleteImage);

module.exports = router;
