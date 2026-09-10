import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const isTls = redisUrl.startsWith('rediss://');

// Singleton Redis client with automatic reconnection and TLS support for Render.
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
  lazyConnect: true,
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log(`[Redis] Connected${isTls ? ' (TLS enabled)' : ''}`);
});

export default redis;
