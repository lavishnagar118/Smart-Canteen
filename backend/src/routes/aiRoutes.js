const express = require("express");
const controller = require("../controllers/aiController");
const {
  authenticate,
  optionalAuthenticate,
  requireRole,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/health", optionalAuthenticate, controller.health);

router.post(
  "/customer",
  authenticate,
  requireRole("CUSTOMER"),
  controller.customerChat
);

router.post(
  "/staff",
  authenticate,
  requireRole("STAFF", "ADMIN"),
  controller.staffChat
);

router.post(
  "/admin",
  authenticate,
  requireRole("ADMIN"),
  controller.adminChat
);

module.exports = router;
