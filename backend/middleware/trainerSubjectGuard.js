/**
 * Middleware: Trainer Subject Access Guard
 *
 * Extracts the test ID from the request (body, params, or query),
 * then checks whether the requesting TRAINER is assigned to at
 * least one of the test's subjects.
 *
 * ADMINs bypass this check entirely.
 * Must be applied AFTER passport.authenticate('user-token').
 *
 * Replaces 4 copy-pasted inline subject-access checks across testpaper.js.
 */
import prisma from '../services/prisma.js';
import logger from '../services/logger.js';

export const requireTestAccess = async (req, res, next) => {
  // ADMINs have unrestricted access
  if (!req.user || req.user.type !== 'TRAINER') return next();

  // Accept testId from any common field name used across routes
  const testId =
    req.body._id ||
    req.body.testId ||
    req.body.testid ||
    req.params._id ||
    req.params.testId;

  // If no test ID is identifiable, let the service handle it (may return 400/404)
  if (!testId) return next();

  try {
    const [user, test] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { subjectIds: true }
      }),
      prisma.test.findUnique({
        where: { id: testId },
        select: { subjectIds: true }
      })
    ]);

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    // Tests with no subjects assigned are accessible to all trainers
    if (test.subjectIds.length === 0) return next();

    const assigned = user?.subjectIds || [];
    const hasAccess = test.subjectIds.some(s => assigned.includes(s));

    if (!hasAccess) {
      logger.warn(
        `[RBAC] Trainer ${req.user.id} denied access to test ${testId}: subject not assigned`
      );
      return res.status(403).json({
        success: false,
        message: 'Access denied: this test belongs to a subject not assigned to you.'
      });
    }

    next();
  } catch (err) {
    logger.error(`[trainerSubjectGuard] Error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Server error during access check' });
  }
};
