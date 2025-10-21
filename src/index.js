import 'dotenv/config';
import express from 'express';
import { initializeDatabase, testConnection } from './database/mysql.js';
import { connectRedis, closeRedis, healthCheck } from './database/redis.js';
import mysqlRateLimiter from './middlewares/mysqlRateLimiter.js';
import redisRateLimiter from './middlewares/redisRateLimiter.js';
import {
  getRateLimitConfig,
  createSuccessResponse,
  getClientIP,
} from './utils/rateLimitHeaders.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON and enable trust proxy for accurate IP detection
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route with MySQL rate limiting
app.get('/api/mysql-protected', mysqlRateLimiter, (req, res) => {
  const response = createSuccessResponse({
    message: 'This endpoint is protected by MySQL rate limiting',
    type: 'MySQL',
    clientIP: getClientIP(req),
  });
  res.json(response);
});

// Route with Redis rate limiting
app.get('/api/redis-protected', redisRateLimiter, (req, res) => {
  const response = createSuccessResponse({
    message: 'This endpoint is protected by Redis rate limiting',
    type: 'Redis',
    clientIP: getClientIP(req),
  });
  res.json(response);
});

// Initialize databases and start server
const startServer = async () => {
  try {
    console.log('Starting Rate Limiting Demo API...');

    // Test MySQL connection and initialize database
    console.log('Connecting to MySQL...');
    const mysqlConnected = await testConnection();
    if (mysqlConnected) {
      await initializeDatabase();
    } else {
      console.warn(
        'MySQL connection failed. MySQL rate limiting may not work properly.',
      );
    }

    // Connect to Redis
    console.log('Connecting to Redis...');
    await connectRedis();

    const rateLimitConfig = getRateLimitConfig();

    // Start the Express server
    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(
        `\n⚡ Rate Limit: ${rateLimitConfig.maxRequests} requests per ${rateLimitConfig.windowSeconds} seconds`,
      );
      console.log(`\n📋 Available endpoints:`);
      console.log(`   curl http://localhost:${PORT}/api/mysql-protected`);
      console.log(`   curl http://localhost:${PORT}/api/redis-protected`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  try {
    await closeRedis();
    console.log('Server shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();
