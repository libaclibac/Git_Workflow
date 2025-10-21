import redis from 'redis';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
};

// Create Redis client
const client = redis.createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
  },
  password: redisConfig.password,
  database: redisConfig.db,
});

// Handle Redis connection events
client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

client.on('connect', () => {
  console.log('Redis client connected successfully');
});

client.on('ready', () => {
  console.log('Redis client ready to use');
});

client.on('end', () => {
  console.log('Redis client connection ended');
});

// Connect to Redis
const connectRedis = async () => {
  try {
    if (!client.isOpen) {
      await client.connect();
      console.log('Redis connection established');
    }
    return true;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    return false;
  }
};

// Test Redis connection
const testConnection = async () => {
  try {
    if (!client.isOpen) {
      await connectRedis();
    }

    // Test with a simple ping
    const pong = await client.ping();
    if (pong === 'PONG') {
      console.log('Redis connection test successful');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Redis connection test failed:', error);
    return false;
  }
};

// Get Redis client instance
const getClient = () => {
  if (!client.isOpen) {
    throw new Error(
      'Redis client is not connected. Call connectRedis() first.',
    );
  }
  return client;
};

// Graceful shutdown
const closeRedis = async () => {
  try {
    if (client.isOpen) {
      await client.quit();
      console.log('Redis connection closed gracefully');
    }
  } catch (error) {
    console.error('Error closing Redis connection:', error);
    // Force close if graceful close fails
    try {
      await client.disconnect();
    } catch (disconnectError) {
      console.error('Error force disconnecting Redis:', disconnectError);
    }
  }
};

// Health check
const healthCheck = async () => {
  try {
    if (!client.isOpen) {
      return { status: 'disconnected', message: 'Redis client not connected' };
    }

    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;

    return {
      status: 'healthy',
      latency: `${latency}ms`,
      config: {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
      },
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
    };
  }
};

export {
  client,
  connectRedis,
  testConnection,
  getClient,
  closeRedis,
  healthCheck,
  redisConfig,
};
