import prisma from "./prisma.js";
import { z } from "zod";
import logger from "./logger.js";

const questionSchema = z.object({
  body: z.string().min(1, "Question body is required"),
  subjectId: z.string().min(1, "Subject ID is required"),
  weightage: z.coerce.number().default(1),
  explanation: z.string().nullish().default(""),
  difficulty: z.coerce.number().default(0),
  type: z.string().default("MCQ"),
  options: z.array(z.object({
    optbody: z.string().nullish().default(""),
    isAnswer: z.boolean().default(false)
  })).optional().default([])
});

export const createQuestion = async (req, res, next) => {
  const validation = questionSchema.safeParse(req.body);
  
  if (!validation.success) {
    console.log("Validation Error:", validation.error.format());
    return res.status(400).json({
      success: false,
      message: validation.error?.issues?.map(e => e.message).join(", ") || "Validation failed"
    });
  }

  if (req.user.type !== 'TRAINER' && req.user.type !== 'ADMIN') {
    return res.status(401).json({
      success: false,
      message: "Permissions not granted!"
    });
  }

  try {
    const { body, subjectId, weightage, explanation, difficulty, options: optionList, type: manualType } = validation.data;

    // RBAC: Trainers can only create questions for their assigned subjects
    if (req.user.type === 'TRAINER') {
      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { subjectIds: true }});
      if (!u.subjectIds || !u.subjectIds.includes(subjectId)) {
        return res.status(403).json({ success: false, message: "Unauthorized: You are not assigned to this subject." });
      }
    }

    // Detect type: if no options or all options empty, it's a TEXT question
    const hasOptions = optionList && optionList.some(o => o.optbody && o.optbody.trim() !== "");
    const type = manualType || (hasOptions ? "MCQ" : "TEXT");

    // Check for existing question
    const existing = await prisma.question.findFirst({
      where: { body, status: true }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This question already exists!"
      });
    }

    // Transaction to create question and options
    const result = await prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: {
          body,
          type,
          weightage: weightage || 1,
          anscount: type === "MCQ" ? optionList.filter(o => o.isAnswer).length : 0,
          explanation: explanation || "No explanation",
          difficulty: difficulty || 0,
          subjectId,
          createdById: req.user.id,
          testIds: []
        }
      });

      if (type === "MCQ" && hasOptions) {
        await tx.option.createMany({
          data: optionList.filter(o => o.optbody).map(o => ({
            optbody: o.optbody,
            isAnswer: o.isAnswer || false,
            questionId: question.id
          }))
        });
      }

      return question;
    });

    return res.json({
      success: true,
      message: "New question created successfully!",
      data: result
    });

  } catch (err) {
    logger.error(`Create question error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Unable to create new question!"
    });
  }
};

export const deleteQuestion = async (req, res, next) => {
  if (req.user.type !== 'TRAINER' && req.user.type !== 'ADMIN') {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { _id } = req.body;
    
    // RBAC: Trainers can only delete questions in their assigned subjects
    if (req.user.type === 'TRAINER') {
      const q = await prisma.question.findUnique({ where: { id: _id }, select: { subjectId: true }});
      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { subjectIds: true }});
      if (!q || !u.subjectIds || !u.subjectIds.includes(q.subjectId)) {
        return res.status(403).json({ success: false, message: "Unauthorized: You are not assigned to this subject." });
      }
    }

    await prisma.question.update({
      where: { id: _id },
      data: { status: false }
    });
    return res.json({
      success: true,
      message: "Question has been deleted"
    });
  } catch (err) {
    logger.error(`Delete question error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Unable to delete question"
    });
  }
};

export const deleteAllQuestions = async (req, res, next) => {
  if (req.user.type !== 'TRAINER' && req.user.type !== 'ADMIN') {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { subjectId } = req.body;
    
    // RBAC: Trainers can only delete-all for their assigned subjects
    if (req.user.type === 'TRAINER') {
      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { subjectIds: true }});
      if (!subjectId || !u.subjectIds || !u.subjectIds.includes(subjectId)) {
        return res.status(403).json({ success: false, message: "Unauthorized: You can only delete all questions for a specific assigned subject." });
      }
    }

    const where = { status: true };
    if (subjectId) where.subjectId = subjectId;

    const result = await prisma.question.updateMany({
      where,
      data: { status: false }
    });

    return res.json({
      success: true,
      message: `${result.count} question(s) deleted successfully`
    });
  } catch (err) {
    logger.error(`Delete all questions error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Unable to delete questions"
    });
  }
};

export const getAllQuestions = async (req, res, next) => {
  try {
    const { subject, subjects } = req.body;
    
    const whereClause = { status: true };
    
    if (req.user.type === 'TRAINER') {
      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { subjectIds: true }});
      const assigned = u.subjectIds || [];
      
      if (subjects && Array.isArray(subjects) && subjects.length > 0) {
        whereClause.subjectId = { in: subjects.filter(s => assigned.includes(s)) };
      } else if (subject) {
        whereClause.subjectId = assigned.includes(subject) ? subject : { in: [] };
      } else {
        whereClause.subjectId = { in: assigned };
      }
    } else {
      if (subjects && Array.isArray(subjects) && subjects.length > 0) {
        whereClause.subjectId = { in: subjects };
      } else if (subject) {
        whereClause.subjectId = subject;
      }
    }

    const questions = await prisma.question.findMany({
      where: whereClause,
      include: {
        createdBy: { select: { name: true } },
        subject: { select: { topic: true } },
        options: true
      }
    });

    return res.json({
      success: true,
      message: "Success",
      data: questions
    });
  } catch (err) {
    logger.error(`Fetch all questions error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch data"
    });
  }
};

export const getSingleQuestion = async (req, res, next) => {
  try {
    const { _id } = req.params;
    const question = await prisma.question.findUnique({
      where: { id: _id, status: true },
      include: {
        subject: { select: { topic: true } },
        options: true
      }
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found"
      });
    }

    // RBAC: Trainer check
    if (req.user.type === 'TRAINER') {
      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { subjectIds: true }});
      if (!u.subjectIds || !u.subjectIds.includes(question.subjectId)) {
        return res.status(403).json({ success: false, message: "Unauthorized: You are not assigned to this subject." });
      }
    }

    return res.json({
      success: true,
      message: "Success",
      data: [question]
    });
  } catch (err) {
    logger.error(`Fetch single question error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch data"
    });
  }
};

export const bulkCreateQuestions = async (req, res, next) => {
  if (req.user.type !== 'TRAINER' && req.user.type !== 'ADMIN') {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { questions, subjectId } = req.body;
  
  if (!questions || !Array.isArray(questions) || !subjectId) {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }

  // RBAC: Trainer bulk create check
  if (req.user.type === 'TRAINER') {
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { subjectIds: true }});
    if (!u.subjectIds || !u.subjectIds.includes(subjectId)) {
      return res.status(403).json({ success: false, message: "Unauthorized: You are not assigned to this subject." });
    }
  }

  try {
    const results = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const q of questions) {
        const hasOptions = q.options && q.options.some(o => o.optbody && o.optbody.trim() !== "");
        const type = q.type || (hasOptions ? "MCQ" : "TEXT");

        const question = await tx.question.create({
          data: {
            body: q.body,
            type,
            weightage: q.weightage || 1,
            anscount: type === "MCQ" ? (q.options ? q.options.filter(o => o.isAnswer).length : 0) : 0,
            explanation: q.explanation || "No explanation",
            difficulty: q.difficulty || 0,
            subjectId,
            createdById: req.user.id,
          }
        });

        if (type === "MCQ" && hasOptions) {
          await tx.option.createMany({
            data: q.options.filter(o => o.optbody).map(o => ({
              optbody: o.optbody,
              isAnswer: o.isAnswer || false,
              questionId: question.id
            }))
          });
        }
        created.push(question);
      }
      return created;
    }, {
      maxWait: 5000,
      timeout: 30000 // Increase timeout to 30 seconds for large bulk imports
    });

    return res.json({
      success: true,
      message: `${results.length} questions imported successfully!`,
      data: results
    });
  } catch (err) {
    logger.error(`Bulk create error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Bulk import failed" });
  }
};
