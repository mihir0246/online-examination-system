import express from "express";
import { getAuditLogs, getExamEvents } from "../services/audit.js";

const router = express.Router();

router.post("/logs", getAuditLogs);
router.post("/events", getExamEvents);

export default router;
