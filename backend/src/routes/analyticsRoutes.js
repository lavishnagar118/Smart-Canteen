const express = require("express");
const controller = require("../controllers/analyticsController");
const { authenticate, optionalAuthenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();
const operations = requireRole("ADMIN");

router.get("/peak-hours", optionalAuthenticate, controller.peakHours);
router.get("/overview", authenticate, operations, controller.overview);
router.get("/orders-by-hour", authenticate, operations, controller.ordersByHour);
router.get("/popular-items", authenticate, operations, controller.popularItems);
router.get("/revenue", authenticate, operations, controller.revenue);

module.exports = router;
