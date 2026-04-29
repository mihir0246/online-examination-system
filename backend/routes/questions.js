import express from "express";
const router = express.Router();

import { 
  createQuestion, 
  getAllQuestions, 
  getSingleQuestion, 
  deleteQuestion, 
  deleteAllQuestions,
  bulkCreateQuestions 
} from "../services/trainerFunctions.js";
import { extractQuestionsFromFile } from "../services/questionParser.js";
import multer from "multer";

const upload = multer();

router.post('/create', createQuestion);
router.post('/details/all', getAllQuestions);
router.get('/details/:_id', getSingleQuestion);
router.post('/delete', deleteQuestion);
router.post('/delete-all', deleteAllQuestions);
router.post('/bulk-create', bulkCreateQuestions);

router.post('/upload-parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const parsedData = await extractQuestionsFromFile(req.file.buffer, req.file.mimetype);
    res.json({ success: true, data: parsedData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
