/**
 * Plan 4.1: Sentry Backend Integration
 *
 * Install: npm install @sentry/node
 * Configure: Set SENTRY_DSN in your .env file
 *
 * Only activates when SENTRY_DSN is set — safe for local dev without a DSN.
 */
import logger from './logger.js';

let Sentry = null;

export const initSentry = async (app) => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry: SENTRY_DSN not set — monitoring disabled (safe for local dev)');
    return;
  }

  try {
    const sentryModule = await import('@sentry/node');
    Sentry = sentryModule;

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      // Capture 100% of transactions in dev, 20% in production
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      // Attach user context to errors when available
      beforeSend(event) {
        return event;
      },
    });

    // Must be added BEFORE routes
    app.use(Sentry.expressErrorHandler());
    logger.info(`✅ Sentry initialized (env=${process.env.NODE_ENV})`);
  } catch (err) {
    logger.warn(`Sentry init failed (is @sentry/node installed?): ${err.message}`);
  }
};

/**
 * Express error handler middleware — captures all 5xx errors to Sentry.
 * Must be added AFTER all routes.
 */
export const sentryErrorHandler = (err, req, res, next) => {
  if (Sentry && err.status !== 404) {
    Sentry.captureException(err, {
      user: req.user ? { id: req.user.id, type: req.user.type } : undefined,
      tags: {
        method: req.method,
        path: req.path,
        status: err.status || 500,
      },
    });
  }
  next(err);
};

/**
 * Capture a manual event (e.g. for critical business logic failures).
 */
export const captureEvent = (message, context = {}) => {
  if (Sentry) {
    Sentry.captureMessage(message, { extra: context });
  }
};
