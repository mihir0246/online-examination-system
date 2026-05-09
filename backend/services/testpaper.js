import prisma from "./prisma.js";
import { z } from "zod";
import logger from "./logger.js";
import { reportQueue } from "./queue.js";
import { gresult } from "./generateResults.js";
import { getIO } from "./socket.js";
import { sendmail } from "./mail.js";
import { auditFromReq, AuditEvent } from "./auditLog.js";

const testSchema = z.object({
  type: z.string().min(1, "Type is required"),
  title: z.string().min(1, "Title is required"),
  questions: z.array(z.string()).min(1, "At least one question is required"),
  duration: z.number().min(1, "Duration is required"),
  organisation: z.string().optional(),
  difficulty: z.number().default(1),
  subjects: z.array(z.string()).optional(),
  _id: z.string().optional().nullable()
});

export const createEditTest = async (req, res, next) => {
  const validation = testSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error.errors.map(e => e.message).join(", ")
    });
  }

  // Role check delegated to requireRole middleware in routes/testpaper.js
  try {
    const { title, questions, type, difficulty, organisation, duration, subjects, _id } = validation.data;

    // RBAC: Trainers can only create/edit tests for subjects they are assigned to
    if (req.user.type === 'TRAINER') {
      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { subjectIds: true }});
      const assigned = u.subjectIds || [];
      const hasUnassigned = (subjects || []).some(s => !assigned.includes(s));
      if (hasUnassigned) {
        return res.status(403).json({ success: false, message: "Unauthorized: You can only assign tests to your assigned subjects." });
      }
    }

    if (_id) {
      // Ownership: TRAINERs may only edit tests they created
      if (req.user.type === 'TRAINER') {
        const existing = await prisma.test.findUnique({ where: { id: _id }, select: { createdById: true } });
        if (!existing || existing.createdById !== req.user.id) {
          return res.status(403).json({ success: false, message: 'Forbidden: You can only edit tests you created.' });
        }
      }

      await prisma.test.update({
        where: { id: _id },
        data: { 
          title, 
          questionIds: questions,
          subjectIds: subjects || []
        }
      });
      return res.json({ success: true, message: "Testpaper updated!" });
    } else {
      const existing = await prisma.test.findFirst({
        where: { title, type, status: true, testbegins: false }
      });

      if (existing) {
        return res.status(409).json({ success: false, message: "Testpaper already exists!" });
      }

      const newTest = await prisma.test.create({
        data: {
          type,
          title,
          duration,
          difficulty,
          organisation,
          createdById: req.user.id,
          questionIds: questions,
          subjectIds: subjects || []
        }
      });

      return res.json({
        success: true,
        message: "New testpaper created successfully!",
        testid: newTest.id
      });
    }
  } catch (err) {
    logger.error(`Test creation error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getSingletest = async (req, res, next) => {
  try {
    const { _id } = req.params;
    const testpaper = await prisma.test.findUnique({
      where: { id: _id, status: true },
      include: {
        createdBy: { select: { name: true } },
        subjects: { select: { id: true, topic: true } },
        questions: {
          include: { options: true }
        }
      }
    });

    if (!testpaper) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    // Trainer subject access validated by requireTestAccess middleware
    return res.json({
      success: true,
      message: "Success",
      data: [testpaper]
    });
  } catch (err) {
    logger.error(`Fetch single test error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getAlltests = async (req, res, next) => {
  try {
    const query = { status: true };
    
    // RBAC: Trainers only see tests covering their assigned subjects
    if (req.user.type === 'TRAINER') {
      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { subjectIds: true }});
      if (u.subjectIds && u.subjectIds.length > 0) {
        query.subjectIds = { hasSome: u.subjectIds };
      } else {
        query.subjectIds = { hasSome: ["000000000000000000000000"] }; // No access
      }
    }
    // ADMIN sees everything (no filter needed)

    const testpapers = await prisma.test.findMany({
      where: query,
      include: {
        subjects: { select: { id: true, topic: true } },
        _count: { select: { questions: true } }
      }
    });

    return res.json({
      success: true,
      message: "Success",
      data: testpapers
    });
  } catch (err) {
    logger.error(`Fetch all tests error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const deleteTest = async (req, res, next) => {
  try {
    const { _id } = req.body;

    // Safety guard: refuse to delete a test that is currently live
    const testRecord = await prisma.test.findUnique({
      where: { id: _id },
      select: { testbegins: true, testconducted: true }
    });

    if (!testRecord) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    if (testRecord.testbegins && !testRecord.testconducted) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a test that is currently live. End the exam first."
      });
    }

    await prisma.test.update({
      where: { id: _id },
      data: { status: false }
    });
    return res.json({ success: true, message: "Test deleted" });
  } catch (err) {
    logger.error(`Delete test error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const beginTest = async (req, res, next) => {
  try {
    const { id } = req.body;
    
    const testRecord = await prisma.test.findUnique({ where: { id } });
    if (!testRecord) return res.status(404).json({ success: false, message: "Test not found." });
    if (testRecord.testconducted) return res.status(400).json({ success: false, message: "Test has already been conducted." });

    // Ownership: TRAINERs may only start tests they created
    if (req.user.type === 'TRAINER' && testRecord.createdById !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only start tests you created.' });
    }
    
    const updated = await prisma.test.update({
      where: { id },
      data: { testbegins: true, isRegistrationavailable: false }
    });
    
    // Phase 6: Audit log
    await auditFromReq(req, AuditEvent.TEST_PUBLISHED, { testId: id });

    // Notify waiting candidates
    try {
      const io = getIO();
      io.to(id).emit("test-started", { testId: id });
    } catch (socketErr) {
      logger.error(`Socket notification failed for beginTest: ${socketErr.message}`);
    }

    return res.json({
      success: true,
      message: 'Test started.',
      data: updated
    });
  } catch (err) {
    logger.error(`Begin test error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Unable to start test." });
  }
};

export const endTest = async (req, res, next) => {
  try {
    const { id } = req.body;

    const testRecord = await prisma.test.findUnique({ where: { id } });
    if (!testRecord) return res.status(404).json({ success: false, message: "Test not found." });
    if (testRecord.testconducted) return res.status(400).json({ success: false, message: "Test has already ended." });
    if (!testRecord.testbegins) return res.status(400).json({ success: false, message: "Test has not started yet." });

    // Ownership: TRAINERs may only end tests they created
    if (req.user.type === 'TRAINER' && testRecord.createdById !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only end tests you created.' });
    }

    const test = await prisma.test.update({
      where: { id },
      data: { 
        testbegins: false, 
        testconducted: true, 
        isResultgenerated: true 
      }
    });

    // Queue background job for report generation (degrades gracefully if Redis is down)
    if (reportQueue) {
      await reportQueue.add({ testId: id, type: 'FULL_REPORT' });
    } else {
      logger.warn(`⚠️ reportQueue unavailable — skipping background report for test ${id}`);
    }

    // Mark all answer sheets as completed
    const answerSheets = await prisma.answerSheet.findMany({
      where: { testId: id, completed: false }
    });
    if (answerSheets.length > 0) {
      await prisma.answerSheet.updateMany({
        where: { testId: id, completed: false },
        data: { completed: true }
      });
    }

    // Force result generation for everyone who started an answer sheet
    // Uses Promise.allSettled so one failure doesn't block others
    const allSheets = await prisma.answerSheet.findMany({ where: { testId: id } });
    const RESULT_CONCURRENCY = 5; // max parallel gresult() calls
    for (let i = 0; i < allSheets.length; i += RESULT_CONCURRENCY) {
      const batch = allSheets.slice(i, i + RESULT_CONCURRENCY);
      await Promise.allSettled(
        batch.map(sheet =>
          gresult(sheet.traineeId, id).catch(err =>
            logger.error(`Error generating result for trainee ${sheet.traineeId}: ${err.message}`)
          )
        )
      );
    }

    // Phase 6: Audit log
    await auditFromReq(req, AuditEvent.TEST_CLOSED, { testId: id });
    await auditFromReq(req, AuditEvent.RESULT_GENERATED, { testId: id });

    return res.json({
      success: true,
      message: 'Test ended. Report generation queued.',
      data: test
    });
  } catch (err) {
    logger.error(`End test error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Unable to end test." });
  }
};

export const MaxMarks = async (testid) => {
  const test = await prisma.test.findUnique({
    where: { id: testid },
    include: { questions: { select: { weightage: true } } }
  });

  return test?.questions.reduce((sum, q) => sum + q.weightage, 0) || 0;
};

export const MM = async (req, res, next) => {
  try {
    const { testid } = req.body;
    const maxM = await MaxMarks(testid);
    return res.json({ success: true, data: maxM });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching max marks" });
  }
};

export const basicTestdetails = async (req, res) => {
  try {
    const { _id } = req.body;
    const test = await prisma.test.findUnique({
      where: { id: _id },
      include: { subjects: true, _count: { select: { trainees: true } } }
    });
    return res.json({ success: true, data: test });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getTestquestions = async (req, res) => {
  try {
    const { _id } = req.body;
    const test = await prisma.test.findUnique({
      where: { id: _id },
      include: { questions: { include: { options: true } } }
    });
    return res.json({ success: true, data: test?.questions || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getCandidates = async (req, res) => {
  try {
    const { _id } = req.body;
    const trainees = await prisma.trainee.findMany({ 
      where: { testId: _id },
      include: { results: { orderBy: { createdAt: 'asc' } } }
    });
    return res.json({ success: true, data: trainees });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getTestResultsList = async (req, res) => {
  try {
    const { testid } = req.body;
    const testId = testid || req.body._id || req.body.testId;
    const trainees = await prisma.trainee.findMany({
      where: { testId: testId },
      include: { results: { orderBy: { createdAt: 'asc' } } }
    });
    
    const mapped = trainees.map(t => ({
      userid: {
        name: t.name,
        emailid: t.emailid,
        organisation: t.organisation
      },
      score: t.results.length > 0 ? t.results[t.results.length - 1].score : 0,
      _id: t.id
    }));
    
    return res.json({ success: true, data: mapped });
  } catch (err) {
    logger.error(`Get test results list error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const TestDetails = async (req, res) => {
  try {
    const { _id } = req.body;
    const test = await prisma.test.findUnique({
      where: { id: _id },
      include: { subjects: true, questions: { select: { id: true, body: true, weightage: true, type: true, explanation: true } } }
    });
    return res.json({ success: true, data: test });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getCandidateDetails = async (req, res) => {
  try {
    const { _id } = req.body;

    const trainee = await prisma.trainee.findUnique({
      where: { id: _id },
      include: { 
        results: { orderBy: { createdAt: 'asc' } },
        feedback: true
      }
    });

    if (!trainee) {
      return res.status(404).json({ success: false, data: null });
    }

    // Security: withhold live answer selections while the exam is in progress
    const test = await prisma.test.findUnique({
      where: { id: trainee.testId },
      select: { testbegins: true, testconducted: true }
    });

    const examIsLive = test && test.testbegins && !test.testconducted;

    let answerSheet = null;
    if (!examIsLive) {
      // Exam has ended or not yet started — safe to expose answer data
      answerSheet = await prisma.answerSheet.findFirst({
        where: { traineeId: _id },
        include: { answers: true }
      });
    }

    return res.json({ success: true, data: { ...trainee, answerSheet } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};


export const checkTestName = async (req, res) => {
  const { testname } = req.body;
  const existing = await prisma.test.findFirst({ where: { title: testname } });
  return res.json({ success: true, can_use: !existing });
};

export const getTestStats = async (req, res) => {
  try {
    const testId = req.body.testId || req.body._id || req.body.testid;
    
    if (!testId) {
      return res.status(400).json({ success: false, message: "Test ID is required" });
    }

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { 
        questions: { select: { weightage: true } },
        trainees: { 
          include: { 
            results: { orderBy: { createdAt: 'asc' } } 
          } 
        } 
      }
    });
    
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });

    const maxMarks = test.questions.reduce((sum, q) => sum + q.weightage, 0) || 100;
    const results = test.trainees
      .map(t => t.results.length > 0 ? t.results[t.results.length - 1] : null)
      .filter(r => r !== null);
    
    const stats = {
      totalCandidates: test.trainees.length,
      appeared: results.length,
      maxMarks,
      scoreDistribution: [], 
      passFail: [
        { name: 'Pass', value: 0 },
        { name: 'Fail', value: 0 }
      ],
      percentageCategories: [
        { name: '91% to 100%', value: 0 },
        { name: '81% to 90%', value: 0 },
        { name: '71% to 80%', value: 0 },
        { name: '61% to 70%', value: 0 },
        { name: '50% to 60%', value: 0 },
        { name: 'Below 50%', value: 0 }
      ]
    };

    const scoreMap = {};

    results.forEach(r => {
      const percentage = (r.score / maxMarks) * 100;
      scoreMap[r.score] = (scoreMap[r.score] || 0) + 1;
      if (percentage >= 50) stats.passFail[0].value++;
      else stats.passFail[1].value++;
      
      if (percentage > 90) stats.percentageCategories[0].value++;
      else if (percentage > 80) stats.percentageCategories[1].value++;
      else if (percentage > 70) stats.percentageCategories[2].value++;
      else if (percentage > 60) stats.percentageCategories[3].value++;
      else if (percentage >= 50) stats.percentageCategories[4].value++;
      else stats.percentageCategories[5].value++;
    });

    stats.scoreDistribution = Object.keys(scoreMap).map(s => ({
      score: parseFloat(s),
      count: scoreMap[s]
    })).sort((a, b) => a.score - b.score);

    return res.json({ success: true, data: stats });
  } catch (err) {
    logger.error(`Get test stats error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const evaluateAnswer = async (req, res) => {
  try {
    const { answerId, score, traineeId, testId } = req.body;

    // Trainer subject access validated by requireTestAccess middleware

    // Fetch Answer and its parent sheet to verify cross-ownership
    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      include: { answerSheet: { select: { testId: true, traineeId: true } } }
    });

    if (!answer) return res.status(404).json({ success: false, message: "Answer not found" });

    // IDOR fix: verify the answer belongs to the test being evaluated
    if (answer.answerSheet.testId !== testId) {
      logger.warn(`[Security] evaluateAnswer: answer ${answerId} belongs to test ${answer.answerSheet.testId}, not ${testId}. User: ${req.user?.id}`);
      return res.status(403).json({ success: false, message: "Forbidden: This answer does not belong to the specified test." });
    }

    // IDOR fix: verify the traineeId in the request matches the sheet owner
    if (answer.answerSheet.traineeId !== traineeId) {
      logger.warn(`[Security] evaluateAnswer: traineeId mismatch. Claimed: ${traineeId}, Actual: ${answer.answerSheet.traineeId}`);
      return res.status(403).json({ success: false, message: "Forbidden: traineeId does not match this answer." });
    }

    const question = await prisma.question.findUnique({
      where: { id: answer.questionId }
    });

    const finalScore = Math.min(Math.max(0, score), question.weightage);

    await prisma.answer.update({
      where: { id: answerId },
      data: { score: finalScore, isEvaluated: true }
    });

    // Scoped delete: only delete the result for this specific (traineeId, testId) pair
    // NOT deleteMany({ where: { traineeId } }) which would wipe results across ALL tests
    await prisma.result.deleteMany({
      where: { traineeId, testId }
    });

    // Recalculate
    const newResult = await gresult(traineeId, testId);

    return res.json({ success: true, message: "Score evaluated successfully", result: newResult });
  } catch (err) {
    logger.error(`Evaluate answer error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};


export const sendResultEmail = async (req, res, next) => {
  try {
    const { testId, traineeId } = req.body;
    
    if (req.user.type !== 'ADMIN' && req.user.type !== 'TRAINER') {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const trainee = await prisma.trainee.findUnique({
      where: { id: traineeId },
      include: { 
        test: { select: { title: true } },
        results: { where: { testId: testId }, orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    if (!trainee || !trainee.results.length) {
      return res.status(404).json({ success: false, message: 'Result not found for this candidate' });
    }

    const score = trainee.results[0].score;
    const testTitle = trainee.test.title;

    const html = `<div style='font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;'>
      <h2 style='color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;'>Exam Result Released</h2>
      <p>Dear <strong>${trainee.name}</strong>,</p>
      <p>Your official performance report for the <strong>${testTitle}</strong> examination is now available.</p>
      <div style='background: #f8f9fa; padding: 30px; text-align: center; border-radius: 15px; margin: 20px 0;'>
        <p style='margin: 0; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;'>Final Score</p>
        <h1 style='margin: 10px 0; font-size: 48px; color: #111827;'>${score}</h1>
      </div>
      <p>This is an automated notification. For any queries regarding your score, please contact your trainer directly.</p>
      <br/>
      <p style='color: #9ca3af; font-size: 12px;'>Regards,<br/>Examination Management Team</p>
    </div>`;

    await sendmail(trainee.emailid, `Result: ${testTitle} - ${trainee.name}`, `Your score for ${testTitle} is ${score}`, html);

    return res.json({ success: true, message: 'Result email sent successfully!' });
  } catch (err) {
    logger.error('Send result email error: ' + err.message);
    return res.status(500).json({ success: false, message: 'Failed to send email' });
  }
};


export const sendAllResultsEmail = async (req, res, next) => {
  try {
    const { testId } = req.body;
    
    if (req.user.type !== 'ADMIN' && req.user.type !== 'TRAINER') {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { 
        trainees: {
          include: {
            results: { where: { testId: testId }, orderBy: { createdAt: 'desc' }, take: 1 }
          }
        }
      }
    });

    if (!test || !test.trainees.length) {
      return res.status(404).json({ success: false, message: 'No candidates found for this test' });
    }

    const testTitle = test.title;
    let sentCount = 0;

    // Collect trainees who have results
    const traineesWithResults = test.trainees
      .filter(t => t.results.length > 0)
      .map(t => ({ trainee: t, score: t.results[0].score }));

    // Send emails in parallel batches of 10 to avoid overwhelming SMTP
    const BATCH_SIZE = 10;
    for (let i = 0; i < traineesWithResults.length; i += BATCH_SIZE) {
      const batch = traineesWithResults.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(({ trainee, score }) => {
          const html = `<div style='font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;'>
          <h2 style='color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;'>Official Result: ${testTitle}</h2>
          <p>Dear <strong>${trainee.name}</strong>,</p>
          <p>Your official performance report for the <strong>${testTitle}</strong> examination has been released.</p>
          <div style='background: #f8f9fa; padding: 30px; text-align: center; border-radius: 15px; margin: 20px 0;'>
            <p style='margin: 0; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;'>Final Score</p>
            <h1 style='margin: 10px 0; font-size: 48px; color: #111827;'>${score}</h1>
          </div>
          <p>This is an automated notification. For any queries regarding your score, please contact your trainer directly.</p>
          <br/>
          <p style='color: #9ca3af; font-size: 12px;'>Regards,<br/>Examination Management Team</p>
        </div>`;
          return sendmail(trainee.emailid, `Result Released: ${testTitle}`, `Your score is ${score}`, html)
            .then(() => { sentCount++; })
            .catch(err => logger.error(`Email failed for ${trainee.emailid}: ${err.message}`));
        })
      );
    }

    // Phase 6: Publish results and Audit
    await prisma.test.update({
      where: { id: testId },
      data: { isResultPublished: true }
    });
    await auditFromReq(req, AuditEvent.RESULT_PUBLISHED, { testId, traineeCount: sentCount, notifiedAt: new Date().toISOString() });

    return res.json({ success: true, message: `Successfully released results to ${sentCount} candidates!` });
  } catch (err) {
    logger.error('Bulk email error: ' + err.message);
    return res.status(500).json({ success: false, message: 'Failed to release all results' });
  }
};
