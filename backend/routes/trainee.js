import express from "express";
import passport from "../services/passportconf.js";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redisClient from "../services/redis.js";
import { auditLog, AuditEvent } from "../services/auditLog.js";
import { requireSelf } from "../middleware/rbac.js";

const router = express.Router();

import {
  traineeenter,
  feedback,
  resendmail,
  correctAnswers,
  Answersheet,
  TraineeDetails,
  Testquestions,
  chosenOptions,
  UpdateAnswers,
  EndTest,
  getQuestion,
  checkFeedback,
  getTestInfo,
  fetchOwnResult,
  logEvent,
  saveSnapshot,
  syncState,
  heartbeat,
  exportMyData
} from "../services/trainee.js";

// Graceful Redis store — falls back to in-memory when Redis is unavailable
function createRedisStore() {
  if (redisClient.status === 'ready') {
    return new RedisStore({ sendCommand: (...args) => redisClient.call(...args) });
  }
  return undefined;
}

const traineeEnterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  ...(redisClient.status === 'ready' && { store: createRedisStore() }),
  handler: async (req, res, next, options) => {
    await auditLog({ 
      event: AuditEvent.RATE_LIMIT_HIT, 
      ip: req.ip,
      metadata: { route: req.path }
    });
    res.status(429).json({ success: false, message: options.message });
  },
  message: 'Too many registration attempts, please try again later.'
});

const answerUpdateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  ...(redisClient.status === 'ready' && { store: createRedisStore() }),
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: async (req, res, next, options) => {
    await auditLog({ 
      event: AuditEvent.RATE_LIMIT_HIT, 
      ip: req.ip,
      metadata: { route: req.path }
    });
    res.status(429).json({ success: false, message: options.message });
  },
  message: 'Too many answer updates'
});

const requireAuth = (req, res, next) => {
  passport.authenticate('user-token', { session: false }, async (err, user, info) => {
    if (err || !user) {
      await auditLog({
        event: AuditEvent.AUTH_FAILURE,
        ip: req.ip,
        metadata: { route: req.path, reason: err?.message || info?.message || 'Unauthorized' }
      });
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = user;
    next();
  })(req, res, next);
};

// --- Truly public routes (registration only — no token exists yet) ---
router.post('/enter', traineeEnterLimiter, traineeenter);
router.post('/feedback', requireAuth, feedback);  // protected against unauthenticated spam

// --- Authenticated trainee routes (require valid trainee JWT) ---
router.post('/resend/testlink',  requireAuth, requireSelf, resendmail);
router.post('/correct/answers',  requireAuth, requireSelf, correctAnswers);
router.post('/details',          requireAuth, requireSelf, TraineeDetails);
router.post('/paper/questions',  requireAuth, requireSelf, Testquestions);
router.post('/chosen/options',   requireAuth, requireSelf, chosenOptions);
router.post('/get/question',     requireAuth, requireSelf, getQuestion);
router.post('/feedback/status',  requireAuth, requireSelf, checkFeedback);
router.post('/test-info',        requireAuth, requireSelf, getTestInfo);

// --- Phase 5: Protected Routes (requireSelf enforces resource ownership at route layer) ---
router.post('/answersheet',       requireAuth, requireSelf, Answersheet);
router.post('/update/answer',     requireAuth, requireSelf, answerUpdateLimiter, UpdateAnswers);
router.post('/end/test',          requireAuth, requireSelf, EndTest);
router.post('/sync-state',        requireAuth, requireSelf, syncState);
router.post('/save-snapshot',     requireAuth, requireSelf, saveSnapshot);
router.post('/heartbeat',         requireAuth, requireSelf, heartbeat);
router.post('/fetch-own-result',  requireAuth, requireSelf, fetchOwnResult);
router.post('/log-event',         requireAuth, requireSelf, logEvent);
router.get('/export-my-data',     requireAuth, exportMyData);



export default router;