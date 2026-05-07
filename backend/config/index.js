/**
 * Centralized Configuration
 * Single source of truth for all environment-derived constants.
 * Fails fast at startup if required values are missing.
 */

// Fallback DATABASE_URL to MONGODB_URI if needed (e.g. on AWS EB)
if (!process.env.DATABASE_URL && process.env.MONGODB_URI) {
  process.env.DATABASE_URL = process.env.MONGODB_URI;
}

function require_env(key, fallback) {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  isProd: process.env.NODE_ENV === 'production',

  db: {
    url: require_env('DATABASE_URL'),
  },

  jwt: {
    secret: require_env('JWT_SECRET', 'change-me-in-production'),
    expiresIn: '24h',
  },

  csrf: {
    secret: require_env('CSRF_SECRET', 'csrf-change-me'),
  },

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },

  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },

  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucket: process.env.S3_BUCKET_NAME || '',
  },

  // Cache TTLs (seconds)
  cache: {
    testFixture: 4 * 60 * 60,   // 4 hours — questions never change during exam
    maxMarks: 4 * 60 * 60,      // 4 hours
    examState: 4 * 60 * 60,     // 4 hours
    heartbeat: 45,               // 45 seconds sliding
    idempotency: 3,              // 3 second dedup window
    rateLimit: 15 * 60,         // 15 minute window
  },

  // Concurrency limits
  concurrency: {
    resultGenBatchSize: 5,
    emailBatchSize: 10,
  },
};
