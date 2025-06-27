const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "iPlant API Documentation",
      version: "1.0.0",
      description: "API documentation for the iPlant social platform",
      license: {
        name: "ISC",
        url: "https://opensource.org/licenses/ISC",
      },
      contact: {
        name: "iPlant Support",
        url: "https://iplant-taupe.vercel.app",
        email: "support@iplant.com",
      },
    },
    servers: [
      {
        url: "http://localhost:8000",
        description: "Development server",
      },
      {
        url: "https://iplant-backend.vercel.app",
        description: "Production server",
      },
    ],
    tags: [
      {
        name: "Authentication",
        description: "User authentication endpoints",
      },
      {
        name: "Users",
        description: "User management and profile endpoints",
      },
      {
        name: "Posts",
        description: "Post creation and management endpoints",
      },
      {
        name: "Comments",
        description: "Comment management endpoints",
      },
      {
        name: "Upload",
        description: "File upload endpoints",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Error message",
            },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Validation error message",
            },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: {
                    type: "string",
                  },
                  message: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
        Location: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["Point"],
            },
            coordinates: {
              type: "array",
              items: {
                type: "number",
              },
              minItems: 2,
              maxItems: 2,
            },
            address: {
              type: "string",
            },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            currentPage: {
              type: "integer",
              minimum: 1,
            },
            totalPages: {
              type: "integer",
              minimum: 1,
            },
            totalItems: {
              type: "integer",
              minimum: 0,
            },
            limit: {
              type: "integer",
              minimum: 1,
            },
          },
        },
        Comment: {
          type: "object",
          properties: {
            id: {
              type: "string",
            },
            postId: {
              type: "string",
            },
            userId: {
              type: "string",
            },
            userName: {
              type: "string",
            },
            userAvatar: {
              type: "string",
            },
            text: {
              type: "string",
            },
            likes: {
              type: "number",
            },
            isLiked: {
              type: "boolean",
            },
            parentComment: {
              type: "string",
              nullable: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        LeaderboardStats: {
          type: "object",
          properties: {
            platformStats: {
              type: "object",
              properties: {
                totalUsers: {
                  type: "number",
                },
                totalPosts: {
                  type: "number",
                },
                totalPlants: {
                  type: "number",
                },
                environmentalImpact: {
                  type: "number",
                },
              },
            },
            topPerformers: {
              type: "object",
              properties: {
                topPlantGrower: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                    },
                    plants: {
                      type: "number",
                    },
                  },
                },
                mostActiveUser: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                    },
                    postCount: {
                      type: "number",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./routes/*.js", "./models/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
