import { pool } from '../database/mysql.js';
import {
  getRateLimitConfig,
  setRateLimitHeaders,
  calculateResetTime,
  createRateLimitExceededResponse,
  getClientIP,
  calculateRemainingRequests,
  isRateLimitExceeded
} from '../utils/rateLimitHeaders.js';

const mysqlRateLimiter = async (req, res, next) => {
  const clientIP = getClientIP(req);
  const config = getRateLimitConfig();
  const currentTime = new Date();
  const windowStart = new Date(currentTime.getTime() - config.windowMilliseconds);

  try {
    const connection = await pool.getConnection();

    // Clean up old entries (older than the current window)
    await connection.execute(
      'DELETE FROM rate_limits WHERE window_start < ?',
      [windowStart]
    );

    // Check current request count for this IP in the current window
    const [rows] = await connection.execute(
      'SELECT request_count FROM rate_limits WHERE ip_address = ? AND window_start > ?',
      [clientIP, windowStart]
    );

    let currentCount = 0;
    if (rows.length > 0) {
      currentCount = rows.reduce((sum, row) => sum + row.request_count, 0);
    }

    // Add rate limit headers
    const remainingRequests = calculateRemainingRequests(currentCount + 1, config.maxRequests);
    const resetTime = calculateResetTime();

    setRateLimitHeaders(res, {
      limit: config.maxRequests,
      remaining: remainingRequests,
      resetTime,
      type: 'MySQL'
    });

    // Check if rate limit is exceeded
    if (isRateLimitExceeded(currentCount, config.maxRequests)) {
      connection.release();
      const resetTime = calculateResetTime();
      const errorResponse = createRateLimitExceededResponse({
        type: 'MySQL',
        resetTime
      });
      return res.status(429).json(errorResponse);
    }

    // Record this request
    const existingEntryQuery = `
      SELECT id FROM rate_limits 
      WHERE ip_address = ? AND window_start > ? 
      ORDER BY window_start DESC 
      LIMIT 1
    `;

    const [existingRows] = await connection.execute(existingEntryQuery, [clientIP, windowStart]);

    if (existingRows.length > 0) {
      // Update existing entry
      await connection.execute(
        'UPDATE rate_limits SET request_count = request_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [existingRows[0].id]
      );
    } else {
      // Create new entry for this window
      await connection.execute(
        'INSERT INTO rate_limits (ip_address, request_count, window_start) VALUES (?, 1, ?)',
        [clientIP, currentTime]
      );
    }

    connection.release();

    next();
  } catch (error) {
    console.error('MySQL rate limiter error:', error);
    // In case of database error, allow the request to proceed
    // You might want to implement a fallback strategy here
    next();
  }
};

export default mysqlRateLimiter;
