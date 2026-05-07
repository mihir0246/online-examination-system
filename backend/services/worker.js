/**
 * Bull Queue Worker Processors
 *
 * Runs in the same process for the minimum-ready version.
 * In production, extract to a separate worker process:
 *   node --import ./instrument.js worker.js
 *
 * Handles:
 *   - FULL_REPORT: generate Excel report for all trainees of a test
 *   - BULK_RESULT_EMAIL: send results to all candidates
 *   - SINGLE_RESULT_EMAIL: send result to one candidate
 */
import Queue from 'bull';
import prisma from './prisma.js';
import logger from './logger.js';
import { sendmail } from './mail.js';
import { gresult } from './generateResults.js';
import { config } from '../config/index.js';
import ExcelJS from 'exceljs';

// ── Queue definitions ─────────────────────────────────────────────────────────
const REDIS_OPTS = {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (t) => (t > 3 ? null : Math.min(t * 500, 3000)),
  },
};

let reportQueue;
let emailQueue;

function createQueue(name) {
  try {
    const q = new Queue(name, REDIS_OPTS);
    q.on('error', (err) => {
      if (!q._errorLogged) {
        logger.warn(`⚠️ Queue [${name}] error (non-fatal): ${err.message}`);
        q._errorLogged = true;
      }
    });
    return q;
  } catch (err) {
    logger.warn(`⚠️ Queue [${name}] unavailable: ${err.message}`);
    return null;
  }
}

reportQueue = createQueue('report-generation');
emailQueue  = createQueue('email-dispatch');

// ── Processors ───────────────────────────────────────────────────────────────

if (reportQueue) {
  reportQueue.process(async (job) => {
    const { testId, type } = job.data;
    logger.info(`[Worker] Processing ${type} for test ${testId}`);

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        trainees: {
          include: { results: true, answerSheet: { include: { answers: true } } }
        },
        questions: { include: { options: true } }
      }
    });

    if (!test) {
      logger.warn(`[Worker] Test ${testId} not found — skipping`);
      return;
    }

    // Build Excel workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Results');

    sheet.addRow(['Name', 'Email', 'Organisation', 'Score', 'Max Marks', 'Percentage', 'Status']);
    sheet.getRow(1).font = { bold: true };

    const maxMarks = test.questions.reduce((s, q) => s + q.weightage, 0);

    for (const trainee of test.trainees) {
      const score = trainee.results[0]?.score ?? 0;
      const pct   = maxMarks > 0 ? ((score / maxMarks) * 100).toFixed(1) : '0.0';
      sheet.addRow([
        trainee.name,
        trainee.emailid,
        trainee.organisation,
        score,
        maxMarks,
        `${pct}%`,
        parseFloat(pct) >= 50 ? 'PASS' : 'FAIL'
      ]);
    }

    // Could be saved to S3 here; for now just log completion
    logger.info(`[Worker] Report ready for test ${testId} (${test.trainees.length} trainees)`);
    return { success: true, testId, traineeCount: test.trainees.length };
  });
}

if (emailQueue) {
  emailQueue.process(10 /* concurrency */, async (job) => {
    const { type, traineeId, testId, to, subject, text, html } = job.data;

    if (type === 'SINGLE') {
      await sendmail(to, subject, text, html);
      logger.info(`[Worker] Email sent to ${to}`);
      return;
    }

    if (type === 'BULK_RESULT_EMAIL') {
      const test = await prisma.test.findUnique({
        where: { id: testId },
        select: { title: true, trainees: { include: { results: true } } }
      });
      if (!test) return;

      const batch = config.concurrency.emailBatchSize;
      const candidates = test.trainees.filter(t => t.results.length > 0);

      for (let i = 0; i < candidates.length; i += batch) {
        await Promise.allSettled(
          candidates.slice(i, i + batch).map(t => {
            const score = t.results[0].score;
            return sendmail(
              t.emailid,
              `Result Released: ${test.title}`,
              `Your score: ${score}`,
              `<p>Dear ${t.name}, your score for <b>${test.title}</b> is <b>${score}</b>.</p>`
            ).catch(err => logger.error(`[Worker] Email failed ${t.emailid}: ${err.message}`));
          })
        );
      }
      logger.info(`[Worker] Bulk email done for test ${testId}`);
    }
  });
}

export { reportQueue, emailQueue };
