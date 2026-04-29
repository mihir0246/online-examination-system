import express from "express";
const router = express.Router();

import { 
  trainerRegister, 
  getAllTrainers, 
  getSingleTrainer, 
  removeTrainer 
} from "../services/adminFunctions.js";

// Create new Trainer
router.post('/trainer/create', trainerRegister);
router.get('/trainer/details/all', getAllTrainers);
router.get('/trainer/details/:_id', getSingleTrainer);
router.post('/trainer/remove', removeTrainer);

export default router;