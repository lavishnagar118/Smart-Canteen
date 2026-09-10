const express = require("express");
const queueController = require("../controllers/queueController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/public/:canteenId", queueController.getPublicQueueSummary);
router.get(
  "/my-status/:orderId",
  authenticate,
  requireRole("CUSTOMER"),
  queueController.getMyStatus
);
router.get(
  "/",
  authenticate,
  requireRole("STAFF", "ADMIN"),
  queueController.getQueue
);
router.patch(
  "/:orderId/accept",
  authenticate,
  requireRole("STAFF", "ADMIN"),
  queueController.accept
);
router.patch(
  "/:orderId/start",
  authenticate,
  requireRole("STAFF", "ADMIN"),
  queueController.start
);
router.patch(
  "/:orderId/ready",
  authenticate,
  requireRole("STAFF", "ADMIN"),
  queueController.ready
);
router.patch(
  "/:orderId/complete",
  authenticate,
  requireRole("STAFF", "ADMIN"),
  queueController.complete
);

module.exports = router;
