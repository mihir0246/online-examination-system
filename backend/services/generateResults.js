import prisma from "./prisma.js";
import logger from "./logger.js";

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

export const gresult = async (uid, tid) => {
  const ansMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  logger.info(`Recalculating result for trainee ${uid} on test ${tid}`);

  const answersheet = await prisma.answerSheet.findUnique({
    where: { traineeId: uid },
    include: {
      test: {
        include: {
          questions: {
            include: { options: true }
          }
        }
      },
      answers: true
    }
  });

  if (!answersheet || !answersheet.completed) {
    throw new Error("Exam not completed or invalid session");
  }

  let totalScore = 0;
  const detailedResults = answersheet.test.questions.map(q => {
    const userAns = answersheet.answers.find(a => a.questionId === q.id);
    const chosenOptions = userAns ? userAns.options : [];
    
    let isCorrect = false;
    let givenAnsLabels = [];
    let correctAnsLabels = [];
    let scoreAwarded = 0;

    if (q.type === 'TEXT') {
      // Descriptive question: manually evaluated
      givenAnsLabels = chosenOptions;
      if (userAns && userAns.isEvaluated) {
        scoreAwarded = userAns.score || 0;
        isCorrect = scoreAwarded > 0;
      } else {
        // Pending evaluation
        scoreAwarded = 0;
        isCorrect = false;
      }
    } else {
      // MCQ Question: auto evaluated
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
    logger.info(`Question ${q.id} type ${q.type}: awarded ${scoreAwarded} (total: ${totalScore})`);

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

  // Store summary result
  const finalResult = await prisma.result.create({
    data: {
      score: totalScore,
      traineeId: uid
    }
  });

  return { ...finalResult, details: detailedResults };
};