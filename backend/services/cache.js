/**
 * Cache Service
 *
 * Fail-open Redis caching abstraction used by the application layer.
 * All methods degrade gracefully — a Redis outage causes a cache miss,
 * NOT an application error.
 *
 * Key Patterns:
 *   cache:test_fixture:{testId}        — full test with questions+options (4h)
 *   cache:max_marks:{testId}           — sum of question weightages (4h)
 *   exam_state:{traineeId}:{testId}    — cursor + time snapshot (4h)
 *   answer_idem:{uid}:{tid}:{qid}:{h}  — idempotency dedup (3s)
 */
import redis from './redis.js';
import logger from './logger.js';
import { config } from '../config/index.js';
import { redisBreaker } from './circuitBreaker.js';

// ── Generic Helpers ───────────────────────────────────────────────────────────

/**
 * Get a cached value. Returns null on miss or Redis failure (fail-open).
 */
export const cacheGet = async (key) => {
  try {
    const raw = await redisBreaker.execute(() => redis.get(key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // cache miss — caller falls through to DB
  }
};

/**
 * Set a cached value with TTL. Silently no-ops on Redis failure (fail-open).
 */
export const cacheSet = async (key, value, ttlSeconds) => {
  try {
    await redisBreaker.execute(() =>
      redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    );
  } catch {
    // Silently swallow — caching is best-effort
  }
};

/**
 * Delete a cached key (cache invalidation on mutation).
 */
export const cacheDel = async (...keys) => {
  try {
    if (keys.length > 0) {
      await redisBreaker.execute(() => redis.del(...keys));
    }
  } catch {
    // Silently swallow
  }
};

/**
 * Cache-aside pattern helper.
 * Returns cached value if present, otherwise calls loader(), caches it, returns it.
 *
 * @param {string} key - Cache key
 * @param {Function} loader - Async function returning fresh data
 * @param {number} ttl - TTL in seconds
 */
export const cacheAside = async (key, loader, ttl) => {
  const cached = await cacheGet(key);
  if (cached !== null) return cached;

  const fresh = await loader();
  if (fresh !== null && fresh !== undefined) {
    await cacheSet(key, fresh, ttl);
  }
  return fresh;
};

// ── Domain-Specific Cache Operations ─────────────────────────────────────────

/**
 * Cache a full test fixture (questions + options).
 * This is the most expensive query — called once per gresult() per test.
 */
export const getTestFixture = (testId, loader) =>
  cacheAside(
    `cache:test_fixture:${testId}`,
    loader,
    config.cache.testFixture
  );

export const invalidateTestFixture = (testId) =>
  cacheDel(`cache:test_fixture:${testId}`, `cache:max_marks:${testId}`);

/**
 * Cache max marks for a test (sum of question weightages).
 */
export const getMaxMarks = (testId, loader) =>
  cacheAside(
    `cache:max_marks:${testId}`,
    loader,
    config.cache.maxMarks
  );

/**
 * Idempotency key for answer updates.
 * Prevents duplicate DB writes within a 3-second window.
 * Uses SET NX — only the first call in the window returns true.
 */
export const checkIdempotency = async (uid, tid, qid, answerHash) => {
  const key = `answer_idem:${uid}:${tid}:${qid}:${answerHash}`;
  try {
    // SET NX EX — atomic: set only if not exists, expire in 3s
    const result = await redisBreaker.execute(() =>
      redis.set(key, '1', 'NX', 'EX', config.cache.idempotency)
    );
    // result === 'OK' means this is a NEW request (not duplicate)
    return result === 'OK';
  } catch {
    return true; // Redis down — allow the write through (fail-open)
  }
};

/**
 * Save and restore exam state (current question cursor + remaining time).
 */
export const saveExamState = async (traineeId, testId, state) => {
  const key = `exam_state:${traineeId}:${testId}`;
  await cacheSet(key, state, config.cache.examState);
};

export const loadExamState = async (traineeId, testId) => {
  return cacheGet(`exam_state:${traineeId}:${testId}`);
};

export const deleteExamState = async (traineeId, testId) => {
  await cacheDel(
    `exam_state:${traineeId}:${testId}`,
    `heartbeat:${traineeId}:${testId}`
  );
};
