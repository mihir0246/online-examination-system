/**
 * Deep Health Check Route
 *
 * GET /health — returns full dependency status
 *
 * Used by:
 * - Load balancers (return 200 = healthy, 503 = unhealthy)
 * - Monitoring dashboards
 * - Kubernetes liveness + readiness probes
 */
import express from 'express';
import prisma from '../services/prisma.js';
import redis from '../services/redis.js';
import logger from '../services/logger.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const start = Date.now();
  const checks = {};
  let overallHealthy = true;

  // ── Database check ──────────────────────────────────────────────────────────
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    checks.database = { status: 'UP', latencyMs: Date.now() - start };
  } catch (err) {
    checks.database = { status: 'DOWN', error: err.message };
    overallHealthy = false;
    logger.error(`[Health] DB check failed: ${err.message}`);
  }

  // ── Redis check ─────────────────────────────────────────────────────────────
  const redisStart = Date.now();
  try {
    if (redis.status === 'ready') {
      await redis.ping();
      checks.redis = { status: 'UP', latencyMs: Date.now() - redisStart };
    } else {
      checks.redis = { status: 'DEGRADED', note: 'Running without Redis (fail-open)' };
    }
  } catch (err) {
    checks.redis = { status: 'DEGRADED', note: 'Redis unavailable — fail-open mode active' };
    // Redis degraded is NOT fatal — we have fail-open fallbacks
  }

  // ── Queue check ─────────────────────────────────────────────────────────────
  try {
    const { reportQueue } = await import('../services/worker.js');
    if (reportQueue) {
      const counts = await reportQueue.getJobCounts();
      checks.queue = {
        status: 'UP',
        waiting: counts.waiting,
        active: counts.active,
        failed: counts.failed,
      };
    } else {
      checks.queue = { status: 'DEGRADED', note: 'Queue not initialized (Redis required)' };
    }
  } catch {
    checks.queue = { status: 'DEGRADED' };
  }

  const httpStatus = overallHealthy ? 200 : 503;

  res.status(httpStatus).json({
    status: overallHealthy ? 'UP' : 'DEGRADED',
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    totalLatencyMs: Date.now() - start,
    checks,
  });
});

export default router;
