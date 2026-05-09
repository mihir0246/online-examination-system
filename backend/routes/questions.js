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
import { fileTypeFromBuffer } from "file-type";

const ALLOWED_PARSE_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const ALLOWED_PARSE_EXT = ['.pdf', '.docx'];
const MAX_PARSE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PARSE_SIZE },
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype;
    if (!ALLOWED_PARSE_MIME.includes(mime)) {
      return cb(new Error('Invalid file type. Only PDF and DOCX are accepted.'), false);
    }
    cb(null, true);
  }
});

router.post('/create', createQuestion);
router.post('/details/all', getAllQuestions);
router.get('/details/:_id', getSingleQuestion);
router.post('/delete', deleteQuestion);
router.post('/delete-all', deleteAllQuestions);
router.post('/bulk-create', bulkCreateQuestions);

router.post('/upload-parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    // Verify magic bytes — client-supplied mimetype is not trusted
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_PARSE_MIME.includes(detected.mime)) {
      return res.status(400).json({ success: false, message: 'File content does not match an allowed type (PDF or DOCX).' });
    }

    const parsedData = await extractQuestionsFromFile(req.file.buffer, detected.mime);
    res.json({ success: true, data: parsedData });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

export default router;

