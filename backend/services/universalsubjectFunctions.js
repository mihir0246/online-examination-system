import prisma from "./prisma.js";
import { z } from "zod";
import logger from "./logger.js";

const subjectSchema = z.object({
  topic: z.string().min(2, "Topic must be at least 2 characters"),
  _id: z.string().optional().nullable()
});

export const createEditsubject = async (req, res, next) => {
  const validation = subjectSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error.errors.map(e => e.message).join(", ")
    });
  }

  if (req.user.type !== 'ADMIN') {
    return res.status(401).json({
      success: false,
      message: "Permissions not granted! Admin access required."
    });
  }

  try {
    const { topic, _id } = validation.data;

    if (_id) {
      await prisma.subject.update({
        where: { id: _id },
        data: { topic }
      });
      return res.json({
        success: true,
        message: "Subject updated successfully"
      });
    } else {
      const existing = await prisma.subject.findUnique({
        where: { topic }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "This subject already exists!"
        });
      }

      await prisma.subject.create({
        data: {
          topic,
          testIds: [] // Initialize with empty array for MongoDB relations
        }
      });

      return res.json({
        success: true,
        message: "New subject created successfully!"
      });
    }
  } catch (err) {
    logger.error(`Subject operation error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred"
    });
  }
};

export const getAllSubjects = async (req, res, next) => {
  try {
    // RBAC: Trainers only see assigned subjects
    if (req.user.type === 'TRAINER') {
      const user = await prisma.user.findUnique({ 
        where: { id: req.user.id }, 
        include: { 
          subjects: { 
            where: { status: true } 
          } 
        }
      });
      
      return res.json({
        success: true,
        message: "Success",
        data: user?.subjects || []
      });
    }

    // Admins see all active subjects
    const subjects = await prisma.subject.findMany({
      where: { status: true }
    });

    return res.json({
      success: true,
      message: "Success",
      data: subjects
    });
  } catch (err) {
    logger.error(`Fetch subjects error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch subject data"
    });
  }
};

export const getSingleSubject = async (req, res, next) => {
  try {
    const { _id } = req.params;
    const subject = await prisma.subject.findUnique({
      where: { id: _id, status: true }
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found"
      });
    }

    return res.json({
      success: true,
      message: "Success",
      data: [subject] // Maintaining legacy array format for compatibility
    });
  } catch (err) {
    logger.error(`Fetch single subject error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch subject details"
    });
  }
};
