const { body, query, validationResult } = require("express-validator");

// Validation middleware to check for errors
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// User registration validation rules
const registerValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email"),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  validateRequest,
];

// Login validation rules
const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email"),
  body("password").trim().notEmpty().withMessage("Password is required"),
  validateRequest,
];

// Post creation validation rules
const postValidation = [
  body("image").trim().notEmpty().withMessage("Image URL is required"),
  body("caption")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Caption cannot be more than 500 characters"),
  body("location.coordinates")
    .isArray()
    .withMessage("Location coordinates must be an array [longitude, latitude]"),
  validateRequest,
];

// Nearby posts validation rules
const nearbyPostsValidation = [
  query("latitude")
    .notEmpty()
    .withMessage("Latitude is required")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be a valid number between -90 and 90"),
  query("longitude")
    .notEmpty()
    .withMessage("Longitude is required")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be a valid number between -180 and 180"),
  query("radius")
    .optional()
    .isFloat({ min: 0.1, max: 100 })
    .withMessage(
      "Distance must be a valid number between 0.1 and 100 kilometers"
    ),
  validateRequest,
];

// Comment validation rules
const commentValidation = [
  body("text")
    .trim()
    .notEmpty()
    .withMessage("Comment text is required")
    .isLength({ max: 500 })
    .withMessage("Comment cannot be more than 500 characters"),
  body("parentComment")
    .optional()
    .isMongoId()
    .withMessage("Invalid parent comment ID format"),
  validateRequest,
];

module.exports = {
  registerValidation,
  loginValidation,
  postValidation,
  nearbyPostsValidation,
  commentValidation,
};
