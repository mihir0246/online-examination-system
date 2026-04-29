import express from "express";
const router = express.Router();

import { 
  createEditsubject, 
  getAllSubjects, 
  getSingleSubject 
} from "../services/universalsubjectFunctions.js";

router.post('/create', createEditsubject);
router.get('/details/all', getAllSubjects);
router.get('/details/:_id', getSingleSubject);


export default router;
