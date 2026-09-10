const express = require("express");
const {
  getCurrentUser,
  firebase,
  login,
  logout,
  register,
} = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/firebase", firebase);
router.get("/me", authenticate, getCurrentUser);
router.post("/logout", authenticate, logout);

module.exports = router;
