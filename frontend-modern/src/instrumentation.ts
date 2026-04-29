// Plan 4.1: Next.js Instrumentation Hook
// This file is required for @sentry/nextjs to work with Next.js App Router.
// It runs once on server startup to initialize Sentry.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime config (minimal)
    const { init } = await import('@sentry/nextjs');
    init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.2,
    });
  }
}
