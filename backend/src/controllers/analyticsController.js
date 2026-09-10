const analyticsService = require("../services/analyticsService");
const AppError = require("../utils/AppError");

const respond = (message, operation) => async (req, res, next) => {
  try {
    if (req.user?.role === "STAFF" && !req.query.canteenId) {
      throw new AppError("STAFF analytics requires canteenId", 400);
    }
    const data = await operation(req.query);
    res.json({ success: true, message, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  overview: respond("Analytics retrieved successfully", analyticsService.getOverview),
  ordersByHour: respond("Hourly order analytics retrieved successfully", analyticsService.ordersByHour),
  popularItems: respond("Popular items retrieved successfully", analyticsService.popularItems),
  revenue: respond("Revenue analytics retrieved successfully", analyticsService.revenue),
  peakHours: respond("Peak hours retrieved successfully", analyticsService.peakHours),
};
