import prisma from "./prisma.js";
import logger from "./logger.js";
import { getTestFixture } from "./cache.js";

export const generateResults = async (req, res, next) => {
  try {
    const { userid, testid } = req.body;
    const result = await gresult(userid, testid);
    return res.json({
      success: true,
      message: "Result generated successfully",
      result: result
    });
  } catch (error) {
    logger.error(`Result generation error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Unable to generate result" });
  }
};

/**
 * Compute and upsert a result for (traineeId, testId).
 *
 * Key changes vs. previous version:
 * 1. Accepts `tid` (testId) as a required argument — Result.upsert needs it.
 * 2. Uses `upsert` with the compound key @@unique([traineeId, testId]) instead of `create`.
 *    This means calling gresult() twice (e.g. EndTest + fetchOwnResult) does NOT produce
 *    duplicate rows — the second call re-scores and updates the existing record.
 * 3. Score is re-computed from the live AnswerSheet every time, so late evaluations
 *    of TEXT questions update the stored score on the next call.
 */
export const gresult = async (uid, tid) => {
  if (!tid) throw new Error("testId is required for gresult");

  const ansMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  logger.info(`Scoring result for trainee=${uid} test=${tid}`);

  // Fetch the answer sheet with the specific test (tid) — guards against cross-test mismatch
  const answersheet = await prisma.answerSheet.findFirst({
    where: { traineeId: uid, testId: tid },
    include: { answers: true }
  });

  if (!answersheet || !answersheet.completed) {
    throw new Error("Exam not completed or invalid session");
  }

  // Load test fixture from cache (4h TTL) — questions never change during/after exam
  const testFixture = await getTestFixture(tid, () =>
    prisma.test.findUnique({
      where: { id: tid },
      include: { questions: { include: { options: true } } }
    })
  );

  if (!testFixture) throw new Error("Test not found");

  let totalScore = 0;
  const detailedResults = testFixture.questions.map(q => {
    const userAns = answersheet.answers.find(a => a.questionId === q.id);
    const chosenOptions = userAns ? userAns.options : [];

    let isCorrect = false;
    let givenAnsLabels = [];
    let correctAnsLabels = [];
    let scoreAwarded = 0;

    if (q.type === 'TEXT') {
      givenAnsLabels = chosenOptions;
      if (userAns && userAns.isEvaluated) {
        scoreAwarded = userAns.score || 0;
        isCorrect = scoreAwarded > 0;
      } else {
        scoreAwarded = 0;
        isCorrect = false;
      }
    } else {
      const correctOptionIndices = q.options
        .map((opt, idx) => opt.isAnswer ? idx : -1)
        .filter(idx => idx !== -1);

      const chosenOptionIndices = q.options
        .map((opt, idx) => chosenOptions.includes(opt.optbody) ? idx : -1)
        .filter(idx => idx !== -1);

      correctAnsLabels = correctOptionIndices.map(idx => ansMap[idx] || `Opt${idx + 1}`);
      givenAnsLabels = chosenOptionIndices.map(idx => ansMap[idx] || `Opt${idx + 1}`);

      isCorrect = correctAnsLabels.length === givenAnsLabels.length &&
                  correctAnsLabels.length > 0 &&
                  correctAnsLabels.every(val => givenAnsLabels.includes(val));

      scoreAwarded = isCorrect ? q.weightage : 0;
    }

    totalScore += scoreAwarded;

    return {
      questionId: q.id,
      isCorrect,
      givenAnswer: givenAnsLabels,
      correctAnswer: correctAnsLabels,
      weightage: q.weightage,
      score: scoreAwarded,
      isEvaluated: q.type === 'TEXT' ? (userAns?.isEvaluated || false) : true
    };
  });

  // Upsert — compound key (traineeId, testId) prevents duplicate rows.
  // If called again after a TEXT question is manually evaluated, score is updated.
  const finalResult = await prisma.result.upsert({
    where: {
      traineeId_testId: { traineeId: uid, testId: tid }
    },
    update: {
      score: totalScore,
      updatedAt: new Date()
    },
    create: {
      score: totalScore,
      traineeId: uid,
      testId: tid
    }
  });

  logger.info(`Result upserted: trainee=${uid} test=${tid} score=${totalScore}`);
  return { ...finalResult, details: detailedResults };
};