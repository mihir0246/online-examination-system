import prisma from "./prisma.js";
import { z } from "zod";
import logger from "./logger.js";
import { getIO } from "./socket.js";
import { sendmail } from "./mail.js";
import { gresult } from "./generateResults.js";
import redis, { recordHeartbeat, getActiveTrainees } from "./redis.js";
import { saveExamState, loadExamState, deleteExamState } from "./cache.js";
import { auditLog, auditFromReq, AuditEvent } from "./auditLog.js";
import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set');
}

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
        testId: testid,
        consentGivenAt: new Date()
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

    const token = jwt.sign(
      { id: trainee.id, emailid: trainee.emailid, type: 'TRAINEE' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('Token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: "Candidate registered successfully!",
      user: trainee,
      token
    });

  } catch (err) {
    logger.error(`Trainee registration error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server error!" });
  }
};

export const Answersheet = async (req, res, next) => {
  try {
    const { userid, testid } = req.body;
    if (userid !== req.user?.id) {
      await auditLog({ event: AuditEvent.OWNERSHIP_VIOLATION, userId: req.user?.id, metadata: { claimedId: userid, route: req.path }, ip: req.ip });
      return res.status(403).json({ success: false, message: "Forbidden: Cannot access another user's answersheet" });
    }
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

    // Bug#6 Fix: Use cache.js wrapper (fail-open) instead of direct redis.get
    const savedState = await loadExamState(userid, testid);

    if (existingSheet) {
      // Bug#4 Fix: Never re-open a completed sheet — that allows post-submission edits
      if (existingSheet.completed) {
        return res.status(409).json({
          success: false,
          message: 'Exam already submitted. No further changes are allowed.'
        });
      }

      // Sheet exists but not submitted — legitimate re-entry (browser crash, etc.)
      return res.json({
        success: true,
        message: 'Sheet exists',
        data: existingSheet,
        duration: testPaper.duration,
        savedState
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
    if (userid !== req.user?.id) {
      await auditLog({ event: AuditEvent.OWNERSHIP_VIOLATION, userId: req.user?.id, metadata: { claimedId: userid, route: req.path }, ip: req.ip });
      return res.status(403).json({ success: false, message: "Forbidden: Cannot modify another user's answersheet" });
    }
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
      where: { traineeId: userid, testId: testid },
      include: { test: true }
    });

    if (!sheet) {
      logger.warn(`Update answer failed: No sheet found for trainee ${userid} and test ${testid}`);
      return res.status(404).json({ success: false, message: "Exam session not found" });
    }

    if (sheet.completed) {
      logger.warn(`Update answer blocked: Sheet already completed. Sheet: ${sheet.id}`);
      return res.status(403).json({ success: false, message: "Exam session closed" });
    }

    const endTimeSeconds = sheet.startTime + (sheet.test.duration * 60);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds > endTimeSeconds + 60) { // 60s grace period for network lag
      logger.warn(`Update answer blocked: Exam window closed. Sheet: ${sheet.id}`);
      await auditLog({ event: AuditEvent.EXAM_WINDOW_VIOLATION, traineeId: userid, testId: testid, metadata: { submissionTime: nowSeconds, deadline: endTimeSeconds, delta: nowSeconds - endTimeSeconds }, ip: req.ip });
      return res.status(403).json({ success: false, message: "Exam window closed" });
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
    if (userid !== req.user?.id) {
      await auditLog({ event: AuditEvent.OWNERSHIP_VIOLATION, userId: req.user?.id, metadata: { claimedId: userid, route: req.path }, ip: req.ip });
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (!userid || !testid) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Bug#6 Fix: Use cache.js wrapper — silently no-ops if Redis is down
    await saveExamState(userid, testid, {
      currentQuestionIdx,
      remainingTime,
      savedAt: Date.now()
    });

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
    if (userid !== req.user?.id) {
      await auditLog({ event: AuditEvent.OWNERSHIP_VIOLATION, userId: req.user?.id, metadata: { claimedId: userid, route: req.path }, ip: req.ip });
      return res.status(403).json({ success: false, message: "Forbidden: Cannot modify another user's answersheet" });
    }

    // Bug#5 Fix: Fast-path idempotency check OUTSIDE transaction
    const alreadySubmitted = await prisma.answerSheet.findFirst({
      where: { traineeId: userid, testId: testid, completed: true }
    });
    if (alreadySubmitted) {
      return res.json({ success: true, message: 'Already submitted' });
    }

    await prisma.$transaction(async (tx) => {
      const sheet = await tx.answerSheet.findFirst({
        where: { traineeId: userid, testId: testid },
        include: { test: true }
      });

      if (!sheet) throw new Error("Answer sheet not found");
      if (sheet.completed) return; // idempotent inside tx — handled above

      const endTimeSeconds = sheet.startTime + (sheet.test.duration * 60);
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (nowSeconds > endTimeSeconds + 120) {
        await auditLog({ event: AuditEvent.EXAM_WINDOW_VIOLATION, traineeId: userid, testId: testid, metadata: { submissionTime: nowSeconds, deadline: endTimeSeconds, delta: nowSeconds - endTimeSeconds }, ip: req.ip });
        throw new Error("Exam window closed");
      }

      await tx.answerSheet.update({
        where: { id: sheet.id },
        data: { completed: true }
      });
    });

    // Generate results outside transaction (idempotent via upsert)
    await gresult(userid, testid);

    auditLog({ event: AuditEvent.EXAM_SUBMITTED, traineeId: userid, testId: testid, ip: req.ip });

    // Bug#6 Fix: Use cache.js wrapper for cleanup
    await deleteExamState(userid, testid);

    return res.json({ success: true, message: "Submitted" });
  } catch (err) {
    logger.error(`EndTest error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Failed to submit exam." });
  }
};

export const feedback = async (req, res) => {
  try {
    const { userid, testid, feedback: comment, rating } = req.body;

    if (!userid || !testid || !comment || rating == null) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Bug#7 Fix: Check for existing feedback before insert to avoid P2002 crash
    const existing = await prisma.feedback.findFirst({
      where: { traineeId: userid, testId: testid }
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Feedback already submitted' });
    }

    await prisma.feedback.create({
      data: {
        comment,
        rating: parseFloat(rating),
        traineeId: userid,
        testId: testid
      }
    });
    return res.json({ success: true, message: "Feedback saved" });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Feedback already submitted' });
    }
    logger.error(`Save feedback error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Unable to save feedback" });
  }
};

export const fetchOwnResult = async (req, res) => {
  try {
    const { userid, testid } = req.body;
    if (userid !== req.user?.id) {
      await auditLog({ event: AuditEvent.OWNERSHIP_VIOLATION, userId: req.user?.id, metadata: { claimedId: userid, route: req.path }, ip: req.ip });
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // --- Plan 2.1: Result Privacy Guard ---
    const test = await prisma.test.findUnique({ where: { id: testid } });
    if (!test || !test.isResultPublished) {
      await auditLog({ event: AuditEvent.RESULT_ACCESS_DENIED, traineeId: userid, testId: testid, ip: req.ip });
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
    // findFirst because the compound (traineeId, testId) is not a unique index on Feedback
    const existing = await prisma.feedback.findFirst({
      where: { traineeId: userid, testId: testid }
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
  // Bug#13 Fix: FNV-1a hash seed — much better distribution than charCode sum.
  // charCode sum has ~30% collision rate on 24-char MongoDB ObjectIDs.
  if (traineeId) {
    let hash = 2166136261;
    for (let i = 0; i < traineeId.length; i++) {
      hash ^= traineeId.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    let seed = hash;
    const seededRandom = () => {
      seed ^= seed << 13;
      seed ^= seed >> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 0xFFFFFFFF;
    };
    for (let i = safeQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [safeQuestions[i], safeQuestions[j]] = [safeQuestions[j], safeQuestions[i]];
    }
  }

  return res.json({ success: true, data: safeQuestions });
};

// Bug#8 Fix: Implement actual email dispatch (was a silent stub)
export const resendmail = async (req, res) => {
  try {
    const { traineeId } = req.body;
    if (!traineeId) {
      return res.status(400).json({ success: false, message: 'traineeId required' });
    }

    const trainee = await prisma.trainee.findUnique({ where: { id: traineeId } });
    if (!trainee) {
      return res.status(404).json({ success: false, message: 'Trainee not found' });
    }

    const testLink = `${process.env.FRONTEND_URL}/exam/instructions/${trainee.testId}/${trainee.id}`;
    await sendmail(
      trainee.emailid,
      'Your Exam Link',
      `Access your test here: ${testLink}`,
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2>Exam Access Link</h2>
        <p>Dear <strong>${trainee.name}</strong>,</p>
        <p>Here is your personal exam link:</p>
        <p><a href="${testLink}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Access Exam</a></p>
        <p style="color:#6b7280;font-size:12px;margin-top:20px">This link is unique to you. Do not share it.</p>
      </div>`
    );

    return res.json({ success: true, message: 'Test link resent successfully' });
  } catch (err) {
    logger.error(`Resend mail error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to resend email' });
  }
};

// --- Plan 3.3: Heartbeat endpoint ---
export const heartbeat = async (req, res) => {
  try {
    const { userid, testid } = req.body;
    if (userid !== req.user?.id) {
      await auditLog({ event: AuditEvent.OWNERSHIP_VIOLATION, userId: req.user?.id, metadata: { claimedId: userid, route: req.path }, ip: req.ip });
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
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

  // IDOR fix: if caller is a TRAINEE, verify they are registered for this specific test
  if (req.user?.type === 'TRAINEE') {
    const registered = await prisma.trainee.findFirst({
      where: { id: req.user.id, testId: testid }
    });
    if (!registered) {
      await auditLog({ event: AuditEvent.OWNERSHIP_VIOLATION, userId: req.user.id, metadata: { testid, route: req.path }, ip: req.ip });
      return res.status(403).json({ success: false, message: 'Forbidden: You are not registered for this test.' });
    }
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

  // IDOR fix: trainees may only read their own details
  if (userid !== req.user?.id) {
    await auditLog({ event: AuditEvent.OWNERSHIP_VIOLATION, userId: req.user?.id, metadata: { claimedId: userid, route: req.path }, ip: req.ip });
    return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another trainee\'s details.' });
  }

  const trainee = await prisma.trainee.findUnique({ where: { id: userid } });
  return res.json({ success: true, data: trainee });
};

export const chosenOptions = async (req, res) => {
  const { userid, testid } = req.body;

  // IDOR fix: trainees may only read their own answer selections
  if (userid !== req.user?.id) {
    await auditLog({ event: AuditEvent.OWNERSHIP_VIOLATION, userId: req.user?.id, metadata: { claimedId: userid, route: req.path }, ip: req.ip });
    return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another trainee\'s answers.' });
  }

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
  const { qid, testid } = req.body;

  // Content gate: require testid so we can verify the exam is actually live
  if (!testid) {
    return res.status(400).json({ success: false, message: 'testid is required.' });
  }

  const test = await prisma.test.findUnique({ where: { id: testid }, select: { testbegins: true } });
  if (!test || !test.testbegins) {
    return res.status(403).json({ success: false, message: 'Exam questions are not available before the scheduled start time.' });
  }

  const question = await prisma.question.findUnique({
    where: { id: qid },
    include: { options: true }
  });

  if (!question) return res.status(404).json({ success: false, data: null });

  // Strip correct-answer flags before sending to client
  const safeQuestion = {
    ...question,
    options: question.options.map(({ isAnswer: _, ...opt }) => opt)
  };

  return res.json({ success: true, data: safeQuestion });
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
  try {
    const { userid, testid, eventType, metadata } = req.body;

    if (!userid || !testid || !eventType) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    if (userid !== req.user?.id) {
      await auditLog({ event: AuditEvent.OWNERSHIP_VIOLATION, userId: req.user?.id, metadata: { claimedId: userid, route: req.path }, ip: req.ip });
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Volume cap: Max 100 events per trainee per test
    const count = await prisma.examEvent.count({
      where: { traineeId: userid, testId: testid }
    });

    if (count >= 100) {
      // Quietly return 200, don't store more.
      return res.status(200).json({ success: true, message: "Event cap reached" });
    }

    await prisma.examEvent.create({
      data: {
        eventType,
        metadata: metadata || {},
        traineeId: userid,
        testId: testid,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // TTL 90 days
      }
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error(`logEvent error: ${err.message}`);
    return res.status(500).json({ success: false });
  }
};

// Bug#10 Fix: saveSnapshot was a silent stub — now actually persists exam state
export const saveSnapshot = async (req, res) => {
  try {
    const { userid, testid, currentQuestionIdx, remainingTime } = req.body;

    if (!userid || !testid) {
      return res.status(400).json({ success: false, message: 'Missing userid or testid' });
    }
    if (typeof currentQuestionIdx !== 'number' || currentQuestionIdx < 0) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }
    if (typeof remainingTime !== 'number' || remainingTime < 0 || remainingTime > 86400) {
      return res.status(400).json({ success: false, message: 'Invalid remaining time' });
    }

    await saveExamState(userid, testid, {
      currentQuestionIdx,
      remainingTime,
      savedAt: Date.now()
    });

    return res.json({ success: true, message: 'Snapshot saved' });
  } catch (err) {
    logger.error(`saveSnapshot error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Snapshot save failed' });
  }
};

// --- Plan 8.1: Data Export Endpoint (Data Portability) ---
export const exportMyData = async (req, res) => {
  try {
    const traineeId = req.user?.id;
    if (!traineeId || req.user?.type !== 'TRAINEE') {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const trainee = await prisma.trainee.findUnique({
      where: { id: traineeId },
      include: {
        test: {
          select: { title: true, type: true }
        },
        answerSheet: {
          include: {
            answers: {
              select: { questionId: true, options: true, isBookmarked: true }
            }
          }
        },
        results: {
          select: { score: true, testId: true, createdAt: true }
        },
        examEvents: {
          select: { eventType: true, timestamp: true, testId: true } // Excludes IP addresses if any were here
        }
      }
    });

    if (!trainee) {
      return res.status(404).json({ success: false, message: "Trainee not found" });
    }

    // Prepare JSON bundle compliant with right to data portability
    const exportBundle = {
      profile: {
        name: trainee.name,
        emailid: trainee.emailid,
        contact: trainee.contact,
        organisation: trainee.organisation,
        location: trainee.location,
        consentGivenAt: trainee.consentGivenAt
      },
      examHistory: [
        {
          testId: trainee.testId,
          testTitle: trainee.test?.title,
          answers: trainee.answerSheet?.answers || [],
          score: trainee.results[0]?.score,
          submittedAt: trainee.results[0]?.createdAt
        }
      ],
      examEvents: trainee.examEvents
    };

    return res.json({
      success: true,
      message: "Data export successful",
      data: exportBundle
    });

  } catch (err) {
    logger.error(`Export data error: ${err.stack}`);
    return res.status(500).json({ success: false, message: "Internal server error during data export", error: err.message });
  }
};