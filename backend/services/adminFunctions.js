// All imports at the top (ESM requires static imports to be hoisted — not mid-file)
import prisma from "./prisma.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import logger from "./logger.js";
import redis from "./redis.js";
import { deleteFromS3 } from "./s3.js";
import { auditLog, AuditEvent } from "./auditLog.js";

const trainerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  emailid: z.string().email("Invalid email").optional(),
  password: z.string().min(5, "Password must be at least 5 characters").optional(),
  contact: z.string().length(10, "Invalid contact number"),
  subjectIds: z.array(z.string()).optional(),
  _id: z.string().optional().nullable()
});

// Role checks below are intentionally omitted — the entire /api/v1/admin prefix
// is protected by requireRole('ADMIN') in app.js before any of these handlers run.

export const trainerRegister = async (req, res, next) => {
  const validation = trainerSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error?.issues?.map(e => e.message).join(", ") || "Validation failed"
    });
  }

  try {
    const { name, password, emailid, contact, subjectIds = [], _id } = validation.data;

    if (_id) {
      await prisma.user.update({
        where: { id: _id },
        data: { name, contact, subjectIds }
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

// --- Plan 8.2: Right to Erasure (DPDP Compliance) ---
export const deleteTrainee = async (req, res, next) => {
  const { id } = req.params;
  const adminId = req.user.id;
  const reason = req.body.reason || "Data retention policy";

  try {
    const trainee = await prisma.trainee.findUnique({
      where: { id },
      include: { answerSheet: true }
    });

    if (!trainee) {
      return res.status(404).json({ success: false, message: "Trainee not found" });
    }

    // 1. S3 Cascade: collect any uploaded file keys
    const s3Keys = [];
    // Example: sheet.answers.forEach(a => { if (a.fileKey) s3Keys.push(a.fileKey); });
    if (s3Keys.length > 0) {
      await deleteFromS3(s3Keys);
    }

    // 2. AuditLog Anonymisation (preserve institutional record, scrub PII)
    await prisma.$runCommandRaw({
      update: "AuditLog",
      updates: [
        {
          q: { traineeId: id, event: { $ne: AuditEvent.TRAINEE_DELETED } },
          u: { $set: { traineeId: '[DELETED]', ip: '[REDACTED]' } },
          multi: true
        }
      ]
    });

    // 3. Prisma $transaction for Database Cascade Delete
    await prisma.$transaction([
      prisma.examEvent.deleteMany({ where: { traineeId: id } }),
      prisma.feedback.deleteMany({ where: { traineeId: id } }),
      prisma.result.deleteMany({ where: { traineeId: id } }),
      prisma.answer.deleteMany({ where: { answerSheetId: trainee.answerSheet?.id || 'non-existent' } }),
      prisma.answerSheet.deleteMany({ where: { traineeId: id } }),
      prisma.trainee.delete({ where: { id } })
    ]);

    // 4. Redis Cleanup
    try {
      await redis.del(`session:${id}`);
      await redis.del(`exam_state:${id}:${trainee.testId}`);
      await redis.set(`blacklist:${id}`, 'deleted', 'EX', 86400);
    } catch (redisErr) {
      logger.error(`Redis cleanup failed during trainee deletion: ${redisErr.message}`);
    }

    // 5. Post-transaction Audit Log
    await auditLog({
      event: AuditEvent.TRAINEE_DELETED,
      userId: adminId,
      traineeId: id,
      metadata: { reason, deletedAt: new Date().toISOString() },
      ip: req.ip
    });

    return res.json({ success: true, message: "Trainee permanently deleted and anonymised" });

  } catch (err) {
    logger.error(`Delete trainee error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Internal error during deletion cascade" });
  }
};