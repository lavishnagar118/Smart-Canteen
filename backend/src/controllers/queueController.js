const queueService = require("../services/queueService");

const getQueue = async (req, res, next) => {
  try {
    const staffCanteenId =
      req.user?.role === "STAFF" && req.user?.canteen
        ? req.user.canteen._id
          ? req.user.canteen._id.toString()
          : req.user.canteen.toString()
        : undefined;
    const canteenId = staffCanteenId || req.query.canteenId;
    const queue = await queueService.getCurrentQueue(canteenId);
    res.status(200).json({
      success: true,
      message: "Queue retrieved successfully",
      data: { queue },
    });
  } catch (error) {
    next(error);
  }
};

const getPublicQueueSummary = async (req, res, next) => {
  try {
    const summary = await queueService.getPublicQueueSummary(req.params.canteenId);
    res.status(200).json({
      success: true,
      message: "Queue summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

const getMyStatus = async (req, res, next) => {
  try {
    const data = await queueService.getQueueStatus(req.user, req.params.orderId);
    res.status(200).json({
      success: true,
      message: "Queue status retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const action = (serviceMethod, message) => async (req, res, next) => {
  try {
    const order = await serviceMethod(req.params.orderId);
    res.status(200).json({
      success: true,
      message,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  accept: action(queueService.acceptOrder, "Order accepted successfully"),
  complete: action(queueService.completeOrder, "Order completed successfully"),
  getMyStatus,
  getQueue,
  getPublicQueueSummary,
  ready: action(queueService.markReady, "Order marked ready successfully"),
  start: action(queueService.startPreparing, "Order preparation started successfully"),
};
