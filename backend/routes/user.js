import express from "express";
const router = express.Router();
import { userdetails } from "../services/user.js";

router.get('/details', userdetails);

export default router;