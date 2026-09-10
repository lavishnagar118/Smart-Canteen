const express = require("express");
const controller = require("../controllers/staffController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();
const admin = requireRole("ADMIN");

router.use(authenticate, admin);

router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id", controller.getById);
router.put("/:id", controller.update);
router.patch("/:id/status", controller.updateStatus);
router.patch("/:id/password", controller.resetPassword);

module.exports = router;
