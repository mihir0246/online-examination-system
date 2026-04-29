/**
 * Plan 3.5: RBAC Middleware
 *
 * Factory middleware for role-based access control.
 * Use: requireRole('ADMIN', 'TRAINER') as Express middleware.
 *
 * Must be applied AFTER passport.authenticate('user-token').
 * User role is sourced from req.user.type (set by passport).
 */
import logger from '../services/logger.js';
import { auditLog, AuditEvent } from '../services/auditLog.js';

/**
 * Middleware factory — returns middleware that allows only users with matching roles.
 * @param {...string} roles - Allowed role strings (e.g., 'ADMIN', 'TRAINER')
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  const userRole = req.user.type;
  if (!roles.includes(userRole)) {
    logger.warn(
      `[RBAC] Forbidden: user ${req.user.id} (role=${userRole}) tried ${req.method} ${req.path}. Required: ${roles.join('|')}`
    );

    // Fire-and-forget audit entry for unauthorized access attempt
    auditLog({
      event: AuditEvent.UNAUTHORIZED_ACCESS,
      userId: req.user.id,
      ip: req.ip,
      metadata: { method: req.method, path: req.path, requiredRoles: roles, actualRole: userRole }
    });

    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(' or ')}.`
    });
  }

  next();
};

/**
 * Middleware: allow access only if the user is the owner of the resource
 * (i.e., req.body.userid or req.params.userId matches req.user.id)
 * Used to prevent trainees from accessing each other's answer sheets.
 */
export const requireSelf = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const resourceUserId = req.body?.userid || req.params?.userId;
  if (resourceUserId && resourceUserId !== req.user.id) {
    logger.warn(`[RBAC] Self-check failed: ${req.user.id} tried to access resource of ${resourceUserId}`);
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  next();
};
