const { customerAssistant } = require("../services/ai/customerAssistant");
const { staffAssistant } = require("../services/ai/staffAssistant");
const { adminAssistant } = require("../services/ai/adminAssistant");
const ollamaClient = require("../services/ai/ollamaClient");

const customerChat = async (req, res, next) => {
  try {
    const data = await customerAssistant({
      query: req.body.query,
      canteenId: req.body.canteenId,
    });
    res.status(200).json({
      success: true,
      message: "AI recommendation generated",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const staffChat = async (req, res, next) => {
  try {
    const data = await staffAssistant({
      query: req.body.query,
      user: req.user,
      canteenId: req.body.canteenId,
    });
    res.status(200).json({
      success: true,
      message: "Kitchen AI insight generated",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const adminChat = async (req, res, next) => {
  try {
    const data = await adminAssistant({
      query: req.body.query,
      canteenId: req.body.canteenId,
      from: req.body.from,
      to: req.body.to,
    });
    res.status(200).json({
      success: true,
      message: "Analytics AI summary generated",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const health = async (req, res, next) => {
  try {
    const status = await ollamaClient.checkHealth();
    res.status(200).json({
      success: true,
      message: "AI runtime health status",
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  adminChat,
  customerChat,
  health,
  staffChat,
};
