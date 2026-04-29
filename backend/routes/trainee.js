import express from "express";
const router = express.Router();

import {
  traineeenter,
  feedback,
  resendmail,
  correctAnswers,
  Answersheet,
  flags,
  TraineeDetails,
  Testquestions,
  chosenOptions,
  UpdateAnswers,
  EndTest,
  getQuestion,
  checkFeedback,
  getTestInfo,
  fetchOwnResult,
  logEvent,
  saveSnapshot,
  syncState,
  heartbeat
} from "../services/trainee.js";

router.post('/enter', traineeenter);
router.post('/feedback', feedback);
router.post('/resend/testlink', resendmail);
router.post('/correct/answers', correctAnswers);
router.post('/answersheet', Answersheet);
router.post('/flags', flags);
router.post('/details', TraineeDetails);
router.post('/paper/questions', Testquestions);
router.post('/chosen/options', chosenOptions);
router.post('/update/answer', UpdateAnswers);
router.post('/end/test', EndTest);
router.post('/get/question', getQuestion);
router.post('/feedback/status', checkFeedback);
router.post('/fetch-own-result', fetchOwnResult);
router.post('/test-info', getTestInfo);
router.post('/log-event', logEvent);
router.post('/save-snapshot', saveSnapshot);
router.post('/sync-state', syncState);
router.post('/heartbeat', heartbeat);

export default router;