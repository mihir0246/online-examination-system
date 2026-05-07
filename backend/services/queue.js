import Queue from 'bull';
import prisma from './prisma.js';
import logger from './logger.js';

let reportQueue;

try {
  reportQueue = new Queue('report-generation', {
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 500, 3000);
      },
    }
  });

  reportQueue.on('error', (err) => {
    // Only log once, don't spam
    if (!reportQueue._errorLogged) {
      logger.warn(`⚠️ Bull Queue error (non-fatal): ${err.message}`);
      reportQueue._errorLogged = true;
    }
  });

  reportQueue.process(async (job) => {
    const { testId, type } = job.data;
    logger.info(`Processing report for test ${testId} (Type: ${type})`);

    try {
      const test = await prisma.test.findUnique({
        where: { id: testId },
        include: { trainees: true }
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      logger.info(`Report generated for test ${testId}`);
      return { success: true, testTitle: test.title };
    } catch (error) {
      logger.error(`Report generation failed for ${testId}: ${error.message}`);
      throw error;
    }
  });

  logger.info('📋 Bull Queue initialized');
} catch (err) {
  logger.warn(`⚠️ Bull Queue unavailable: ${err.message} — report generation disabled`);
}

export { reportQueue };
