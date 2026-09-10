const express = require("express");
const {
  availability,
  create,
  getById,
  list,
  remove,
  update,
} = require("../controllers/menuController");
const {
  authenticate,
  optionalAuthenticate,
  requireRole,
} = require("../middleware/authMiddleware");

const router = express.Router();
const staffOrAdmin = requireRole("STAFF", "ADMIN");

router.use(optionalAuthenticate);
router.get("/", list);
router.get("/:id", getById);

router.post("/", authenticate, staffOrAdmin, create);
router.put("/:id", authenticate, staffOrAdmin, update);
router.patch("/:id/availability", authenticate, staffOrAdmin, availability);
router.delete("/:id", authenticate, staffOrAdmin, remove);

module.exports = router;
