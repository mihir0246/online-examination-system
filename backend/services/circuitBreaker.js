/**
 * Plan 3.4: Circuit Breaker (Redis Fail-Open)
 *
 * Prevents cascading failures when Redis is unavailable.
 * States: CLOSED (normal) → OPEN (failing, fast-fail) → HALF_OPEN (testing recovery)
 *
 * Design choices:
 * - Fail-OPEN: on OPEN, operations return null rather than throw.
 *   This means Redis-dependent features (idempotency, heartbeat, blacklist) degrade
 *   gracefully instead of taking down the whole service.
 * - Threshold: 5 consecutive failures → OPEN
 * - Recovery: 30s after OPEN, allow one probe request (HALF_OPEN).
 *   If it succeeds → CLOSED. If it fails → stay OPEN another 30s.
 */
import logger from './logger.js';

const STATE = Object.freeze({
  CLOSED:    'CLOSED',
  OPEN:      'OPEN',
  HALF_OPEN: 'HALF_OPEN',
});

export class CircuitBreaker {
  constructor({
    name = 'redis',
    failureThreshold = 5,
    recoveryTimeoutMs = 30_000,
  } = {}) {
    this.name             = name;
    this.failureThreshold = failureThreshold;
    this.recoveryTimeoutMs = recoveryTimeoutMs;

    this.state          = STATE.CLOSED;
    this.failureCount   = 0;
    this.lastFailureTime = null;
  }

  /** Execute `fn`. Returns `null` (fail-open) when circuit is OPEN. */
  async execute(fn) {
    if (this.state === STATE.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.recoveryTimeoutMs) {
        this._transition(STATE.HALF_OPEN);
        logger.info(`[CircuitBreaker:${this.name}] HALF_OPEN — probing recovery`);
      } else {
        // Fast-fail: return null without calling Redis
        return null;
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      return null; // Fail-open: never re-throw
    }
  }

  _onSuccess() {
    if (this.state === STATE.HALF_OPEN) {
      logger.info(`[CircuitBreaker:${this.name}] CLOSED — recovery confirmed`);
    }
    this.failureCount = 0;
    this.state = STATE.CLOSED;
  }

  _onFailure(err) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === STATE.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this._transition(STATE.OPEN);
      logger.error(
        `[CircuitBreaker:${this.name}] OPEN after ${this.failureCount} failure(s): ${err.message}`
      );
    } else {
      logger.warn(
        `[CircuitBreaker:${this.name}] Failure ${this.failureCount}/${this.failureThreshold}: ${err.message}`
      );
    }
  }

  _transition(newState) {
    this.state = newState;
  }

  getState() {
    return this.state;
  }
}

// Singleton breaker for the Redis client
export const redisBreaker = new CircuitBreaker({ name: 'redis' });
