/**
 * Plan 3.1: Immutable Audit Logging
 *
 * Append-only audit trail for all critical exam and auth events.
 * Uses raw MongoDB command to ensure no accidental Prisma-level deletes.
 * TTL: 5 years per institutional data retention policy.
 */
import { createRequire } from 'module';
import logger from './logger.js';
import prisma from './prisma.js';

// ── Event types ───────────────────────────────────────────────────────────────
export const AuditEvent = Object.freeze({
  // Auth events
  USER_LOGIN:           'USER_LOGIN',
  USER_LOGOUT:          'USER_LOGOUT',
  // Exam lifecycle
  EXAM_START:           'EXAM_START',
  ANSWER_SAVED:         'ANSWER_SAVED',
  EXAM_SUBMITTED:       'EXAM_SUBMITTED',
  EXAM_FORCE_SUBMITTED: 'EXAM_FORCE_SUBMITTED',  // time expired
  // Results
  RESULT_GENERATED:     'RESULT_GENERATED',
  RESULT_PUBLISHED:     'RESULT_PUBLISHED',
  // Test management
  TEST_PUBLISHED:       'TEST_PUBLISHED',
  TEST_CLOSED:          'TEST_CLOSED',
  // Security
  TOKEN_REVOKED:        'TOKEN_REVOKED',
  UNAUTHORIZED_ACCESS:  'UNAUTHORIZED_ACCESS',
});

// ── Core log writer ────────────────────────────────────────────────────────────
/**
 * Write an immutable audit log entry.
 * @param {Object} params
 * @param {string} params.event     - AuditEvent constant
 * @param {string} [params.userId]  - Authenticated user/trainer ID
 * @param {string} [params.traineeId]
 * @param {string} [params.testId]
 * @param {string} [params.ip]      - Client IP from req.ip
 * @param {Object} [params.metadata] - Arbitrary extra context
 */
export const auditLog = async ({
  event,
  userId = null,
  traineeId = null,
  testId = null,
  ip = null,
  metadata = {}
}) => {
  const entry = {
    event,
    userId,
    traineeId,
    testId,
    ip,
    metadata,
    timestamp: new Date(),
    // TTL: expire after 5 years (Mongo TTL index on 'timestamp' with expireAfterSeconds)
  };

  try {
    // Use $runCommandRaw to bypass Prisma — ensures append-only semantics
    await prisma.$runCommandRaw({
      insert: 'AuditLog',
      documents: [entry],
      ordered: true,
    });
  } catch (err) {
    // Audit logging must NEVER crash the main request — only warn
    logger.warn(`[AUDIT] Failed to write log entry (event=${event}): ${err.message}`);
  }
};

/**
 * Convenience: log from an Express request object.
 * Extracts ip and user automatically.
 */
export const auditFromReq = (req, event, extra = {}) => {
  return auditLog({
    event,
    userId: req.user?.id || null,
    ip: req.ip || req.headers?.['x-forwarded-for'] || null,
    ...extra,
  });
};
