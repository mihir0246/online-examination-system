import Queue from 'bull';
import prisma from './prisma.js';
import logger from './logger.js';

export const reportQueue = new Queue('report-generation', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379
  }
});

reportQueue.process(async (job) => {
  const { testId, type } = job.data;
  logger.info(`Processing report for test ${testId} (Type: ${type})`);

  try {
    // Heavy logic for generating Excel/PDF goes here
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { trainees: true }
    });

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 5000));

    logger.info(`Report generated for test ${testId}`);
    return { success: true, testTitle: test.title };
  } catch (error) {
    logger.error(`Report generation failed for ${testId}: ${error.message}`);
    throw error;
  }
});
