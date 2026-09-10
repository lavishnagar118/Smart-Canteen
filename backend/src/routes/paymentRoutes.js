const express = require("express");
const paymentController = require("../controllers/paymentController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/create-order",
  authenticate,
  requireRole("CUSTOMER"),
  paymentController.createOrder
);
router.post(
  "/verify",
  authenticate,
  requireRole("CUSTOMER"),
  paymentController.verify
);
router.get(
  "/:orderId/status",
  authenticate,
  requireRole("CUSTOMER"),
  paymentController.status
);
router.post("/webhook", paymentController.webhook);

module.exports = router;
