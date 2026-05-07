import express from "express";
const router = express.Router();

import { 
  trainerRegister, 
  getAllTrainers, 
  getSingleTrainer, 
  removeTrainer,
  deleteTrainee
} from "../services/adminFunctions.js";
import passport from "../services/passportconf.js";

// Require Admin Auth middleware (assuming admin routes are protected at the app.js level, but explicit here is better. App.js already protects /api/v1/admin with requireAuth and requireRole)
router.post('/trainer/create', trainerRegister);
router.get('/trainer/details/all', getAllTrainers);
router.get('/trainer/details/:_id', getSingleTrainer);
router.post('/trainer/remove', removeTrainer);

// --- Plan 8.2: Right to Erasure Endpoint ---
router.delete('/trainee/:id', deleteTrainee);

export default router;