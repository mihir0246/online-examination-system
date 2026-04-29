import express from "express";
const router = express.Router();
import {
  stopRegistration,
  Download,
  getFeedBack
} from "../services/registrationlink.js";
import { getActiveTrainees } from "../services/redis.js";

router.post("/registration/stop", stopRegistration);
router.post('/result/download', Download);
router.post('/get/feedbacks', getFeedBack);

// Plan 3.3: Real-time active trainee monitoring
router.get('/active-trainees/:testId', async (req, res) => {
  try {
    const { testId } = req.params;
    const activeIds = await getActiveTrainees(testId);
    return res.json({ success: true, data: activeIds, count: activeIds.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch active trainees' });
  }
});

export default router;
