const express = require("express");
const controller = require("../controllers/canteenController");
const { authenticate, optionalAuthenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();
const admin = requireRole("ADMIN");

router.get("/", optionalAuthenticate, controller.list);
router.get("/:canteenId/menu", optionalAuthenticate, controller.listMenu);
router.get("/:id", optionalAuthenticate, controller.get);
router.post("/", authenticate, admin, controller.create);
router.put("/:id", authenticate, admin, controller.update);
router.patch("/:id/status", authenticate, admin, controller.status);
router.delete("/:id", authenticate, admin, controller.remove);

module.exports = router;
