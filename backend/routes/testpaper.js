import express from "express";
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

router.post('/new/name/check', checkTestName);
router.post('/create', createEditTest);
router.get('/details/:_id', getSingletest);
router.post('/details/all', getAlltests);
router.post('/delete', deleteTest);
router.post('/basic/details', basicTestdetails);
router.post('/questions', getTestquestions);
router.post('/candidates', getCandidates);
router.post('/begin', beginTest);
router.post('/end', endTest);
router.post('/trainer/details', TestDetails);
router.post('/candidates/details', getCandidateDetails);
router.post('/max/marks', MM);
router.post('/stats', getTestStats);
router.post('/results-list', getTestResultsList);
router.post('/evaluate-answer', evaluateAnswer);
router.post('/send-result-email', sendResultEmail);
router.post('/send-all-results-email', sendAllResultsEmail);

export default router;
