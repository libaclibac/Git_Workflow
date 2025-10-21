import { getClient, connectRedis } from '../database/redis.js';
import {
  getRateLimitConfig,
  setRateLimitHeaders,
  calculateResetTime,
  createRateLimitExceededResponse,
  getClientIP,
  generateRedisKey,
  calculateRemainingRequests,
  isRateLimitExceeded,
} from '../utils/rateLimitHeaders.js';

const redisRateLimiter = async (req, res, next) => {
  const clientIP = getClientIP(req);
  const config = getRateLimitConfig();
  const key = generateRedisKey(clientIP);

  try {
    // Ensure Redis is connected
    await connectRedis();
    const client = getClient();

    // Get current count using Redis pipeline for atomic operations
    const pipeline = client.multi();

    // Increment the counter
    pipeline.incr(key);

    // Set expiration if this is the first request
    pipeline.expire(key, config.windowSeconds);

    // Get TTL to calculate reset time
    pipeline.ttl(key);

    const results = await pipeline.exec();

    const currentCount = results[0];
    const ttl = results[2];

    // Calculate remaining requests and reset time
    const remainingRequests = calculateRemainingRequests(
      currentCount,
      config.maxRequests,
    );
    const resetTime = calculateResetTime(ttl);

    // Add rate limit headers
    setRateLimitHeaders(res, {
      limit: config.maxRequests,
      remaining: remainingRequests,
      resetTime,
      type: 'Redis',
    });

    // Check if rate limit is exceeded
    if (isRateLimitExceeded(currentCount, config.maxRequests)) {
      const resetTime = calculateResetTime(ttl);
      const errorResponse = createRateLimitExceededResponse({
        type: 'Redis',
        resetTime,
      });

      return res.status(429).json(errorResponse);
    }

    next();
  } catch (error) {
    console.error('Redis rate limiter error:', error);
    // In case of Redis error, allow the request to proceed
    // You might want to implement a fallback strategy here
    next();
  }
};

export default redisRateLimiter;
