import prisma from "./prisma.js";
import logger from "./logger.js";

// Retrieve core audit logs from MongoDB native collection
export const getAuditLogs = async (req, res) => {
  try {
    const { testId, page = 1, limit = 100, startDate, endDate, event } = req.body;
    
    if (!testId) {
      return res.status(400).json({ success: false, message: "testId is required" });
    }

    // --- Phase 6: Trainer Scope Guard ---
    if (req.user.type === 'TRAINER') {
      const test = await prisma.test.findUnique({ where: { id: testId } });
      console.log(`Checking auth: test.createdById=${test?.createdById}, req.user.id=${req.user.id}`);
      if (!test || test.createdById !== req.user.id) {
        return res.status(403).json({ success: false, message: "Unauthorized: You can only view audit logs for tests you created." });
      }
    }

    const pageSize = Math.min(parseInt(limit), 100);
    const skip = (parseInt(page) - 1) * pageSize;

    // We must query AuditLog via Prisma raw command since it's an append-only native collection
    const query = { testId };
    
    if (event) query.event = event;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const commandResult = await prisma.$runCommandRaw({
      find: "AuditLog",
      filter: query,
      sort: { timestamp: -1 },
      skip: skip,
      limit: pageSize
    });

    const logs = commandResult.cursor?.firstBatch || [];

    // Also get total count for pagination metadata
    const countResult = await prisma.$runCommandRaw({
      count: "AuditLog",
      query: query
    });
    
    const total = countResult.n || 0;

    return res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: pageSize,
        total
      }
    });

  } catch (err) {
    logger.error(`Get audit logs error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Error fetching audit logs" });
  }
};

// Retrieve ExamEvent tab-switch logs (persisted in Prisma model)
export const getExamEvents = async (req, res) => {
  try {
    const { testId, traineeId, page = 1, limit = 100, startDate, endDate } = req.body;
    
    if (!testId) {
      return res.status(400).json({ success: false, message: "testId is required" });
    }

    // --- Phase 6: Trainer Scope Guard ---
    if (req.user.type === 'TRAINER') {
      const test = await prisma.test.findUnique({ where: { id: testId } });
      if (!test || test.createdById !== req.user.id) {
        return res.status(403).json({ success: false, message: "Unauthorized: You can only view events for tests you created." });
      }
    }

    const pageSize = Math.min(parseInt(limit), 100);
    const skip = (parseInt(page) - 1) * pageSize;

    const where = { testId };
    if (traineeId) where.traineeId = traineeId;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [events, total] = await Promise.all([
      prisma.examEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.examEvent.count({ where })
    ]);

    return res.json({
      success: true,
      data: events,
      pagination: {
        page: parseInt(page),
        limit: pageSize,
        total
      }
    });

  } catch (err) {
    logger.error(`Get exam events error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Error fetching exam events" });
  }
};
