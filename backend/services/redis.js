import Redis from 'ioredis';
import logger from './logger.js';
import { redisBreaker } from './circuitBreaker.js';

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  logger.info('🚀 Redis connected successfully');
});

let lastErrorLogged = 0;
redis.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    const now = Date.now();
    // Only log ECONNREFUSED once every minute to prevent console spam
    if (now - lastErrorLogged > 60000) {
      logger.warn(`⚠️ Redis is unavailable (circuit breaker active) - ${err.message}`);
      lastErrorLogged = now;
    }
  } else {
    logger.error(`❌ Redis Error: ${err.message}`);
  }
});

// ── Plan 3.4: Circuit-breaker-wrapped Redis helpers ───────────────────────────

/**
 * Blacklist a JWT token (fail-open: silently succeeds if Redis is down)
 */
export const blacklistToken = async (token, ttl) => {
  await redisBreaker.execute(async () => {
    await redis.set(`blacklist:${token}`, 'true', 'EX', ttl);
    logger.info(`Token blacklisted for ${ttl}s`);
  });
};

/**
 * Check if a token is blacklisted.
 * Returns false (fail-open) when Redis is down — user can proceed.
 */
export const isTokenBlacklisted = async (token) => {
  const result = await redisBreaker.execute(async () => {
    return redis.get(`blacklist:${token}`);
  });
  return result === 'true';
};

/**
 * Pre-warming strategy for high-concurrency exam starts.
 */
export const preWarm = async () => {
  logger.info('🔥 Running Pre-warming strategy...');
  const result = await redisBreaker.execute(() => redis.ping());
  if (result) {
    logger.info('✅ Pre-warming complete');
  } else {
    logger.warn('⚠️ Pre-warming skipped — Redis circuit is OPEN');
  }
};

// ── Plan 3.3: Heartbeat helpers ────────────────────────────────────────────────
const HEARTBEAT_TTL = 45; // seconds — longer than 30s client interval for leniency

/**
 * Record a trainee heartbeat (they are alive in the exam).
 */
export const recordHeartbeat = async (traineeId, testId) => {
  await redisBreaker.execute(() =>
    redis.set(`heartbeat:${traineeId}:${testId}`, Date.now().toString(), 'EX', HEARTBEAT_TTL)
  );
};

/**
 * Check if a trainee is currently active (heartbeat key exists).
 */
export const isTraineeActive = async (traineeId, testId) => {
  const result = await redisBreaker.execute(() =>
    redis.exists(`heartbeat:${traineeId}:${testId}`)
  );
  return result === 1;
};

/**
 * Get all active trainee IDs for a given testId.
 * Uses SCAN to avoid blocking Redis with KEYS.
 */
export const getActiveTrainees = async (testId) => {
  const pattern = `heartbeat:*:${testId}`;
  const active = [];

  const result = await redisBreaker.execute(async () => {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.forEach(key => {
        // key format: heartbeat:{traineeId}:{testId}
        const traineeId = key.split(':')[1];
        if (traineeId) active.push(traineeId);
      });
    } while (cursor !== '0');
    return active;
  });

  return result || [];
};

export default redis;
