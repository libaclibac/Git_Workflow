/**
 * Utility functions for rate limiting response headers and responses
 */

// Get rate limiting configuration from environment
const getRateLimitConfig = () => {
  return {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10,
    windowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS) || 60,
    windowMilliseconds:
      (parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS) || 60) * 1000,
  };
};

/**
 * Set rate limiting headers on the response
 * @param {Object} res - Express response object
 * @param {Object} options - Rate limiting options
 * @param {number} options.limit - Maximum requests allowed
 * @param {number} options.remaining - Remaining requests in current window
 * @param {Date|string} options.resetTime - When the rate limit window resets
 * @param {string} options.type - Type of rate limiting (MySQL, Redis, etc.)
 */
const setRateLimitHeaders = (res, { limit, remaining, resetTime, type }) => {
  const config = getRateLimitConfig();

  res.set({
    'X-RateLimit-Limit': limit || config.maxRequests,
    'X-RateLimit-Remaining': Math.max(0, remaining || 0),
    'X-RateLimit-Reset':
      resetTime instanceof Date ? resetTime.toISOString() : resetTime,
    'X-RateLimit-Type': type || 'Unknown',
    'X-RateLimit-Window': `${config.windowSeconds}s`,
  });
};

/**
 * Calculate reset time for rate limiting window
 * @param {number} ttlSeconds - Time to live in seconds (optional)
 * @returns {Date} - Reset time as Date object
 */
const calculateResetTime = (ttlSeconds = null) => {
  const config = getRateLimitConfig();

  if (ttlSeconds !== null && ttlSeconds > 0) {
    return new Date(Date.now() + ttlSeconds * 1000);
  }

  return new Date(Date.now() + config.windowMilliseconds);
};

/**
 * Generate rate limit exceeded response
 * @param {Object} options - Response options
 * @param {string} options.type - Type of rate limiting
 * @param {Date|string} options.resetTime - When the rate limit resets
 * @param {string} options.message - Custom message (optional)
 * @returns {Object} - Standardized error response
 */
const createRateLimitExceededResponse = ({ type, resetTime, message }) => {
  const config = getRateLimitConfig();

  return {
    error: 'Rate limit exceeded',
    message:
      message ||
      `Too many requests. Maximum ${config.maxRequests} requests per ${config.windowSeconds} seconds allowed.`,
    rateLimitType: type,
    resetTime: resetTime instanceof Date ? resetTime.toISOString() : resetTime,
    limits: {
      maxRequests: config.maxRequests,
      windowSeconds: config.windowSeconds,
    },
  };
};

/**
 * Extract client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
const getClientIP = (req) => {
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
};

/**
 * Generate a Redis key for rate limiting
 * @param {string} ip - Client IP address
 * @param {string} prefix - Key prefix (optional)
 * @returns {string} - Redis key
 */
const generateRedisKey = (ip, prefix = 'rate_limit') => {
  return `${prefix}:${ip}`;
};

/**
 * Calculate remaining requests
 * @param {number} currentCount - Current request count
 * @param {number} maxRequests - Maximum allowed requests (optional)
 * @returns {number} - Remaining requests
 */
const calculateRemainingRequests = (currentCount, maxRequests = null) => {
  const config = getRateLimitConfig();
  const limit = maxRequests || config.maxRequests;
  return Math.max(0, limit - currentCount);
};

/**
 * Check if rate limit is exceeded
 * @param {number} currentCount - Current request count
 * @param {number} maxRequests - Maximum allowed requests (optional)
 * @returns {boolean} - True if rate limit is exceeded
 */
const isRateLimitExceeded = (currentCount, maxRequests = null) => {
  const config = getRateLimitConfig();
  const limit = maxRequests || config.maxRequests;
  return currentCount > limit;
};

/**
 * Create success response with rate limit info
 * @param {Object} options - Response options
 * @param {string} options.message - Success message
 * @param {string} options.type - Rate limiting type
 * @param {string} options.clientIP - Client IP address
 * @param {Object} options.additional - Additional data to include
 * @returns {Object} - Standardized success response
 */
const createSuccessResponse = ({
  message,
  type,
  clientIP,
  additional = {},
}) => {
  const config = getRateLimitConfig();

  return {
    message,
    rateLimitType: type,
    clientIP,
    timestamp: new Date().toISOString(),
    limits: {
      maxRequests: config.maxRequests,
      windowSeconds: config.windowSeconds,
    },
    ...additional,
  };
};

export {
  getRateLimitConfig,
  setRateLimitHeaders,
  calculateResetTime,
  createRateLimitExceededResponse,
  getClientIP,
  generateRedisKey,
  calculateRemainingRequests,
  isRateLimitExceeded,
  createSuccessResponse,
};
