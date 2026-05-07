// Load .env FIRST — must happen before reading process.env.SENTRY_DSN
import dotenv from 'dotenv';
dotenv.config();

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      nodeProfilingIntegration(),
    ],

    // Send structured logs to Sentry
    enableLogs: true,
    // Tracing
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    // Set sampling rate for profiling
    profileSessionSampleRate: 1.0,
    // Trace lifecycle automatically enables profiling during active traces
    profileLifecycle: 'trace',
    // Setting this option to true will send default PII data to Sentry.
    sendDefaultPii: true,
  });

  console.log(`✅ Sentry initialized (env=${process.env.NODE_ENV})`);
} else {
  console.log('ℹ️  Sentry: SENTRY_DSN not set — monitoring disabled (safe for local dev)');
}
