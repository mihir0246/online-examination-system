import express from "express";
import { requireRole } from "../middleware/rbac.js";
import { requireTestAccess } from "../middleware/trainerSubjectGuard.js";

const router = express.Router();

import {
  checkTestName,
  createEditTest,
  getSingletest,
  getAlltests,
  deleteTest,
  basicTestdetails,
  getTestquestions,
  getCandidates,
  beginTest,
  endTest,
  getCandidateDetails,
  MM,
  getTestStats,
  TestDetails,
  getTestResultsList,
  evaluateAnswer,
  sendResultEmail,
  sendAllResultsEmail
} from "../services/testpaper.js";

// ── Read / query endpoints (TRAINER access gated by subject) ─────────────────
router.get('/details/:_id',        requireTestAccess, getSingletest);
router.post('/details/all',        getAlltests);            // subject filter is done inside
router.post('/basic/details',      requireTestAccess, basicTestdetails);
router.post('/questions',          requireTestAccess, getTestquestions);
router.post('/candidates',         requireTestAccess, getCandidates);
router.post('/candidates/details', requireTestAccess, getCandidateDetails);
router.post('/max/marks',          requireTestAccess, MM);
router.post('/stats',              requireTestAccess, getTestStats);
router.post('/results-list',       requireTestAccess, getTestResultsList);
router.post('/trainer/details',    requireTestAccess, TestDetails);

// ── Mutation endpoints (ADMIN-only guarded at app.js level for beginTest/endTest/delete) ──
router.post('/new/name/check',     checkTestName);
router.post('/create',             createEditTest);
router.post('/delete',             requireRole('ADMIN'), deleteTest);
router.post('/begin',              requireRole('ADMIN', 'TRAINER'), requireTestAccess, beginTest);
router.post('/end',                requireRole('ADMIN', 'TRAINER'), requireTestAccess, endTest);

// ── Evaluation & notifications ────────────────────────────────────────────────
router.post('/evaluate-answer',    requireTestAccess, evaluateAnswer);
router.post('/send-result-email',  requireTestAccess, sendResultEmail);
router.post('/send-all-results-email', requireRole('ADMIN', 'TRAINER'), requireTestAccess, sendAllResultsEmail);

export default router;
