import prisma from "./prisma.js";
import { z } from "zod";
import logger from "./logger.js";
import { getIO } from "./socket.js";
import { sendmail } from "./mail.js";
import { gresult } from "./generateResults.js";
import redis, { recordHeartbeat, getActiveTrainees } from "./redis.js";
import { auditLog, auditFromReq, AuditEvent } from "./auditLog.js";

const traineeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  emailid: z.string().email("Invalid email"),
  contact: z.string().length(10, "Invalid contact number"),
  organisation: z.string().min(1, "Organisation is required"),
  testid: z.string().min(1, "Test ID is required"),
  location: z.string().min(1, "Location is required")
});

export const traineeenter = async (req, res, next) => {
  const validation = traineeSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error.issues.map(e => e.message).join(", ")
    });
  }

  try {
    const { name, emailid, contact, organisation, testid, location } = validation.data;

    const testPaper = await prisma.test.findUnique({
      where: { id: testid, isRegistrationavailable: true }
    });

    if (!testPaper) {
      return res.status(404).json({
        success: false,
        message: "Registration for this test is closed!"
      });
    }

    const existing = await prisma.trainee.findFirst({
      where: {
        OR: [
          { emailid, testId: testid },
          { contact, testId: testid }
        ]
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Already registered for this test!"
      });
    }

    const trainee = await prisma.trainee.create({
      data: {
        name,
        emailid,
        contact,
        organisation,
        location,
        testId: testid
      }
    });

    // Notify trainer via Socket.io
    const io = getIO();
    io.to(testid).emit("candidate-registered", {
      id: trainee.id,
      name: trainee.name,
      organisation: trainee.organisation
    });

    const testLink = `${process.env.FRONTEND_URL}/exam/instructions/${testid}/${trainee.id}`;
    
    sendmail(emailid, "Registration Successful", `Take your test here: ${testLink}`)
      .catch(err => logger.error(`Mail error: ${err.message}`));

    return res.json({
      success: true,
      message: "Candidate registered successfully!",
      user: trainee
    });

  } catch (err) {
    logger.error(`Trainee registration error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server error!" });
  }
};

export const Answersheet = async (req, res, next) => {
  try {
    const { userid, testid } = req.body;
    logger.info(`Starting Answersheet for user: ${userid}, test: ${testid}`);
    
    const [trainee, testPaper] = await Promise.all([
      prisma.trainee.findFirst({ where: { id: userid, testId: testid } }),
      prisma.test.findUnique({ where: { id: testid } })
    ]);

    if (!trainee) {
      return res.status(404).json({ success: false, message: "Candidate not found for this test" });
    }

    if (!testPaper || !testPaper.testbegins || testPaper.testconducted) {
      return res.status(400).json({ success: false, message: "Test is not live or has already ended" });
    }

    const existingSheet = await prisma.answerSheet.findFirst({
      where: { traineeId: userid, testId: testid },
      include: { answers: true }
    });

    // --- Plan 2.3: Restore saved exam state from Redis ---
    let savedState = null;
    try {
      const stateRaw = await redis.get(`exam_state:${userid}:${testid}`);
      if (stateRaw) savedState = JSON.parse(stateRaw);
    } catch (e) {
      logger.warn(`Could not restore exam state: ${e.message}`);
    }

    if (existingSheet) {
      // Reset completed status to allow re-entry
      await prisma.answerSheet.update({
        where: { id: existingSheet.id },
        data: { completed: false }
      });

      return res.json({ 
        success: true, 
        message: "Sheet exists", 
        data: existingSheet,
        duration: testPaper.duration,
        savedState // null if no saved state, or { currentQuestionIdx, remainingTime }
      });
    }

    const newSheet = await prisma.answerSheet.create({
      data: {
        startTime: Math.floor(Date.now() / 1000),
        testId: testid,
        traineeId: userid,
        answers: {
          create: testPaper.questionIds.map(qId => ({
            questionId: qId,
            options: []
          }))
        }
      }
    });

    return res.json({ 
      success: true, 
      message: "Test started!", 
      data: newSheet,
      duration: testPaper.duration,
      savedState: null
    });

  } catch (err) {
    logger.error(`Start test error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
};

// --- Plan 2.1: UpdateAnswers with Redis idempotency ---
export const UpdateAnswers = async (req, res, next) => {
  try {
    const { testid, userid, qid, newAnswer, isBookmarked } = req.body;
    logger.info(`Update answer request: ${JSON.stringify(req.body)}`);

    // Idempotency: deduplicate same answer within a 3-second window
    const optionsArray = Array.isArray(newAnswer) ? newAnswer : (newAnswer ? [newAnswer] : []);
    const idempotencyKey = `answer_idem:${userid}:${testid}:${qid}:${JSON.stringify(optionsArray)}`;
    
    try {
      const alreadySeen = await redis.set(idempotencyKey, '1', 'EX', 3, 'NX');
      if (alreadySeen === null) {
        // Key already existed — duplicate request within window, silently accept
        logger.info(`Duplicate answer save deduplicated: ${idempotencyKey}`);
        return res.json({ success: true, message: "Answer saved (deduplicated)" });
      }
    } catch (redisErr) {
      // Redis down — degrade gracefully and continue to save
      logger.warn(`Redis idempotency check failed: ${redisErr.message}`);
    }

    const sheet = await prisma.answerSheet.findFirst({
      where: { traineeId: userid, testId: testid }
    });

    if (!sheet) {
      logger.warn(`Update answer failed: No sheet found for trainee ${userid} and test ${testid}`);
      return res.status(404).json({ success: false, message: "Exam session not found" });
    }

    if (sheet.completed) {
      logger.warn(`Update answer blocked: Sheet already completed. Sheet: ${sheet.id}`);
      return res.status(403).json({ success: false, message: "Exam session closed" });
    }

    await prisma.answer.updateMany({
      where: { answerSheetId: sheet.id, questionId: qid },
      data: { 
        options: optionsArray,
        isBookmarked: !!isBookmarked
      }
    });

    return res.json({ success: true, message: "Answer saved" });

  } catch (err) {
    logger.error(`Update answer error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Error saving answer" });
  }
};

// --- Plan 2.3: Save exam state (currentQuestion + remainingTime) to Redis ---
export const syncState = async (req, res) => {
  try {
    const { userid, testid, currentQuestionIdx, remainingTime } = req.body;
    
    if (!userid || !testid) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const stateKey = `exam_state:${userid}:${testid}`;
    const state = { currentQuestionIdx, remainingTime, savedAt: Date.now() };
    
    // TTL: 4 hours (longer than any reasonable exam duration)
    await redis.set(stateKey, JSON.stringify(state), 'EX', 4 * 60 * 60);
    
    return res.json({ success: true, message: "State saved" });
  } catch (err) {
    logger.error(`syncState error: ${err.message}`);
    return res.status(500).json({ success: false, message: "State sync failed" });
  }
};

// --- Plan 2.1: EndTest wrapped in prisma.$transaction ---
export const EndTest = async (req, res) => {
  try {
    const { testid, userid } = req.body;

    await prisma.$transaction(async (tx) => {
      const sheet = await tx.answerSheet.findFirst({
        where: { traineeId: userid, testId: testid }
      });

      if (!sheet) {
        throw new Error("Answer sheet not found");
      }

      if (sheet.completed) {
        // Already submitted — idempotent response
        return;
      }

      await tx.answerSheet.update({
        where: { id: sheet.id },
        data: { completed: true }
      });
    });

    // Generate results outside transaction (can be retried independently)
    await gresult(userid, testid);

    // Plan 3.1: Audit log exam submission
    auditLog({ event: AuditEvent.EXAM_SUBMITTED, traineeId: userid, testId: testid, ip: req.ip });

    // Clean up persisted exam state from Redis
    try {
      await redis.del(`exam_state:${userid}:${testid}`);
    } catch (e) {
      logger.warn(`Could not clear exam state: ${e.message}`);
    }

    return res.json({ success: true, message: "Submitted" });
  } catch (err) {
    logger.error(`EndTest error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Failed to submit exam." });
  }
};

export const feedback = async (req, res) => {
  try {
    const { userid, testid, feedback, rating } = req.body;
    
    // Save feedback using Prisma
    await prisma.feedback.create({
      data: {
        comment: feedback,
        rating: parseFloat(rating),
        traineeId: userid,
        testId: testid
      }
    });

    return res.json({ success: true, message: "Feedback saved" });
  } catch (err) {
    logger.error(`Save feedback error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Unable to save feedback" });
  }
};

export const fetchOwnResult = async (req, res) => {
  try {
    const { userid, testid } = req.body;

    // --- Plan 2.1: Result Privacy Guard ---
    const test = await prisma.test.findUnique({ where: { id: testid } });
    if (!test || !test.isResultgenerated) {
      return res.status(403).json({ 
        success: false, 
        message: "Results have not been published yet." 
      });
    }

    const result = await gresult(userid, testid);
    const trainee = await prisma.trainee.findUnique({
      where: { id: userid }
    });
    return res.json({ success: true, result, trainee });
  } catch (err) {
    logger.error(`Fetch own result error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Unable to fetch result" });
  }
};

export const checkFeedback = async (req, res) => {
  try {
    const { userid, testid } = req.body;
    const existing = await prisma.feedback.findUnique({
      where: { traineeId: userid }
    });
    return res.json({ success: true, status: !!existing });
  } catch (err) {
    return res.json({ success: true, status: false });
  }
};

export const Testquestions = async (req, res) => {
  const { id } = req.body;

  // --- Plan 3.2: Content Gating — block if test not yet live ---
  const test = await prisma.test.findUnique({
    where: { id },
    include: { questions: { include: { options: true } } }
  });

  if (!test) {
    return res.status(404).json({ success: false, message: 'Test not found' });
  }

  if (!test.testbegins) {
    return res.status(403).json({
      success: false,
      message: 'Exam questions are not available before the scheduled start time.'
    });
  }

  // --- Plan 3.2: Strip correct answer flags before sending to client ---
  const safeQuestions = test.questions.map(q => ({
    ...q,
    options: q.options.map(({ isAnswer: _, ...opt }) => opt)
  }));

  // --- Plan 3.2: Deterministic per-trainee shuffle (seeded by traineeId) ---
  // Extract traineeId from body for seed; fall back to unsorted if missing
  const traineeId = req.body.traineeId || req.body.userid;
  if (traineeId) {
    // Simple seeded shuffle — consistent across refreshes for same trainee
    let seed = traineeId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const seededRandom = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };
    for (let i = safeQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [safeQuestions[i], safeQuestions[j]] = [safeQuestions[j], safeQuestions[i]];
    }
  }

  return res.json({ success: true, data: safeQuestions });
};

export const resendmail = async (req, res) => {
  return res.json({ success: true, message: "Link resent" });
};

// --- Plan 3.3: Heartbeat endpoint ---
export const heartbeat = async (req, res) => {
  try {
    const { userid, testid } = req.body;
    if (!userid || !testid) {
      return res.status(400).json({ success: false, message: 'Missing userid or testid' });
    }
    await recordHeartbeat(userid, testid);
    return res.json({ success: true });
  } catch (err) {
    logger.error(`Heartbeat error: ${err.message}`);
    return res.status(500).json({ success: false });
  }
};

export const correctAnswers = async (req, res) => {
  const { testid } = req.body;

  // --- Plan 2.1: Result Privacy Guard ---
  const testRecord = await prisma.test.findUnique({ where: { id: testid } });
  if (!testRecord || !testRecord.isResultgenerated) {
    return res.status(403).json({ 
      success: false, 
      message: "Results have not been published yet." 
    });
  }

  const test = await prisma.test.findUnique({
    where: { id: testid },
    include: { questions: { include: { options: { where: { isAnswer: true } } } } }
  });
  return res.json({ success: true, data: test?.questions || [] });
};

export const flags = async (req, res) => {
  return res.json({ success: true, data: [] });
};

export const TraineeDetails = async (req, res) => {
  const { userid } = req.body;
  const trainee = await prisma.trainee.findUnique({ where: { id: userid } });
  return res.json({ success: true, data: trainee });
};

export const chosenOptions = async (req, res) => {
  const { userid, testid } = req.body;

  // --- Plan 2.1: Result Privacy Guard ---
  const testRecord = await prisma.test.findUnique({ where: { id: testid } });
  if (!testRecord || !testRecord.isResultgenerated) {
    return res.status(403).json({ 
      success: false, 
      message: "Results have not been published yet." 
    });
  }

  const sheet = await prisma.answerSheet.findFirst({
    where: { traineeId: userid, testId: testid },
    include: { answers: true }
  });
  return res.json({ success: true, data: sheet?.answers || [] });
};

export const getQuestion = async (req, res) => {
  const { qid } = req.body;
  const question = await prisma.question.findUnique({
    where: { id: qid },
    include: { options: true }
  });
  return res.json({ success: true, data: question });
};

export const getTestInfo = async (req, res) => {
  try {
    const { testid } = req.body;
    const test = await prisma.test.findUnique({
      where: { id: testid },
      select: { title: true, duration: true, type: true }
    });
    return res.json({ success: true, data: test });
  } catch (err) {
    logger.error(`Get test info error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const logEvent = async (req, res) => {
  logger.info(`Exam Event: ${JSON.stringify(req.body)}`);
  return res.json({ success: true });
};

export const saveSnapshot = async (req, res) => {
  logger.info(`Snapshot received for trainee: ${req.body.traineeid}`);
  return res.json({ success: true });
};