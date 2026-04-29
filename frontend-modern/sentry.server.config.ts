// Plan 4.1: Sentry Frontend Server Config
// Captures server-side Next.js errors (SSR, API routes, server components)

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  // Don't print debug output in production
  debug: process.env.NODE_ENV !== 'production',
});
