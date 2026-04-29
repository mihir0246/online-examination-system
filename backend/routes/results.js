import express from "express";
const router = express.Router();
import { generateResults } from "../services/generateResults.js";

router.post('/results', generateResults);

export default router;