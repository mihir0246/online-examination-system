import prisma from "./prisma.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import logger from "./logger.js";

const trainerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  emailid: z.string().email("Invalid email").optional(),
  password: z.string().min(5, "Password must be at least 5 characters").optional(),
  contact: z.string().length(10, "Invalid contact number"),
  subjectIds: z.array(z.string()).optional(),
  _id: z.string().optional().nullable()
});

export const trainerRegister = async (req, res, next) => {
  const validation = trainerSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error?.issues?.map(e => e.message).join(", ") || "Validation failed"
    });
  }

  if (req.user.type !== 'ADMIN') {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { name, password, emailid, contact, subjectIds = [], _id } = validation.data;

    if (_id) {
      await prisma.user.update({
        where: { id: _id },
        data: { 
          name, 
          contact,
          subjectIds
        }
      });
      return res.json({ success: true, message: "Trainer's Profile updated successfully!" });
    } else {
      if (!emailid || !password) {
        return res.status(400).json({ success: false, message: "Email and password required for new registration" });
      }

      const existing = await prisma.user.findUnique({ where: { emailid } });
      if (existing) {
        return res.status(409).json({ success: false, message: "This email already exists!" });
      }

      const hash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          name,
          emailid,
          password: hash,
          contact,
          type: 'TRAINER',
          subjectIds,
          createdById: req.user.id
        }
      });

      return res.json({ success: true, message: "Trainer's Profile created successfully!" });
    }
  } catch (err) {
    logger.error(`Trainer registration error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const removeTrainer = async (req, res, next) => {
  if (req.user.type !== 'ADMIN') return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    const { _id } = req.body;
    await prisma.user.update({
      where: { id: _id },
      data: { status: false }
    });
    return res.json({ success: true, message: "Account has been removed" });
  } catch (err) {
    logger.error(`Remove trainer error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
};

export const getAllTrainers = async (req, res, next) => {
  if (req.user.type !== 'ADMIN') return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    const info = await prisma.user.findMany({
      where: { type: 'TRAINER', status: true },
      select: { id: true, name: true, emailid: true, contact: true, createdAt: true, subjectIds: true }
    });
    return res.json({ success: true, message: "Success", data: info });
  } catch (err) {
    logger.error(`Fetch trainers error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Unable to fetch data" });
  }
};

export const getSingleTrainer = async (req, res, next) => {
  if (req.user.type !== 'ADMIN') return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    const { _id } = req.params;
    const info = await prisma.user.findUnique({
      where: { id: _id, status: true },
      select: { id: true, name: true, emailid: true, contact: true, subjectIds: true }
    });

    if (!info) return res.status(404).json({ success: false, message: "Trainer not found" });

    return res.json({ success: true, message: "Success", data: [info] });
  } catch (err) {
    logger.error(`Fetch single trainer error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Unable to fetch data" });
  }
};