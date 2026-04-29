// Plan 4.1: Sentry Frontend Client Config
// Install: npm install @sentry/nextjs
// Set NEXT_PUBLIC_SENTRY_DSN in .env.local

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  // Capture 100% in dev, 20% in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  // Only enable replay in production to avoid noise in dev
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration(),
  ],
  // Filter out low-signal errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],
  beforeSend(event) {
    // Strip sensitive data from request bodies in error reports
    if (event.request?.data) {
      const data = event.request.data;
      if (data.password) data.password = '[REDACTED]';
      if (data.token) data.token = '[REDACTED]';
    }
    return event;
  },
});
