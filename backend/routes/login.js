import express from "express";
const router = express.Router();
import { userlogin, userlogout } from "../services/login.js";


router.post('/', userlogin);
router.post('/logout', userlogout);



export default router;