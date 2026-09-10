const express = require("express");
const orderController = require("../controllers/orderController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);
router.post("/", requireRole("CUSTOMER"), orderController.create);
router.get("/", orderController.list);
router.get("/:id", orderController.getById);
router.patch("/:id/cancel", requireRole("CUSTOMER"), orderController.cancel);

module.exports = router;
