import prisma from "./prisma.js";
import logger from "./logger.js";

export const stopRegistration = async (req, res, next) => {
  if (req.user.type !== 'TRAINER' && req.user.type !== 'ADMIN') {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { id, status } = req.body;
    const test = await prisma.test.findUnique({
      where: { id },
      select: { testbegins: true, testconducted: true }
    });

    if (test && !test.testbegins && !test.testconducted) {
      await prisma.test.update({
        where: { id },
        data: { isRegistrationavailable: status }
      });
      return res.json({
        success: true,
        message: "Registration status changed!",
        currentStatus: status
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Unable to change status: Test is already in progress or conducted"
      });
    }
  } catch (err) {
    logger.error(`Stop registration error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getFeedBack = async (req, res, next) => {
  if (req.user.type !== 'TRAINER' && req.user.type !== 'ADMIN') {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { testid } = req.body;
    // Feedback is stored via raw command in trainee.js for now, 
    // but we can query it if we have a model or use raw query.
    return res.json({
      success: true,
      message: "Feedbacks Sent Successfully",
      data: []
    });
  } catch (err) {
    logger.error(`Get feedback error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const Download = async (req, res) => {
  try {
    const { testid } = req.body;
    // Excel download handled via excel.js service if needed; stub for now
    return res.json({ success: true, message: "Report download initiated", data: null });
  } catch (err) {
    logger.error(`Download error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};