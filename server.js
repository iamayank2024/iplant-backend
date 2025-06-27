const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const path = require("path");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const logger = require("./utils/logger");
const requestLogger = require("./middleware/requestLogger");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/posts");
const uploadRoutes = require("./routes/upload");
const userRoutes = require("./routes/users");

// Initialize Express app
const app = express();

// Middlewares
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add morgan for HTTP request logging
const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
app.use(morgan(morganFormat, { stream: logger.stream }));

// Add custom request logger
app.use(requestLogger);

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Static folder for uploads (if needed)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/users", userRoutes);

// Basic route for testing
app.get("/", (req, res) => {
  res.json({ message: "Welcome to iPlant API" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });
  res.status(500).json({ message: err.message || "Something went wrong!" });
});

// Connect to MongoDB
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
    logger.info("Connected to MongoDB");
  })
  .catch((err) => {
    logger.error(`MongoDB connection error: ${err.message}`, {
      stack: err.stack,
    });
    process.exit(1);
  });

module.exports = app;
