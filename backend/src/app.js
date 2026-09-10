const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const queueRoutes = require("./routes/queueRoutes");
const canteenRoutes = require("./routes/canteenRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const staffRoutes = require("./routes/staffRoutes");
const aiRoutes = require("./routes/aiRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(
  express.json({
    verify: (req, res, buffer) => {
      if (req.originalUrl === "/api/payments/webhook") {
        req.rawBody = Buffer.from(buffer);
      }
    },
  })
);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/canteens", canteenRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/ai", aiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
