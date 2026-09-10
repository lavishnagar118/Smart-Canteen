require("dotenv").config();

const http = require("http");
const app = require("./src/app");
const connectDatabase = require("./src/config/db");
const { initializeSocket } = require("./src/realtime/socket");

const PORT = process.env.PORT || 5000;

const reportRazorpayConfiguration = () => {
  const razorpayVariables = [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
  ];
  const configured = razorpayVariables.every(
    (variable) => typeof process.env[variable] === "string" && process.env[variable].trim()
  );

  console.log(
    `Razorpay configuration: ${configured ? "AVAILABLE" : "NOT CONFIGURED"}`
  );
};

const startServer = async () => {
  try {
    reportRazorpayConfiguration();
    await connectDatabase();

    const httpServer = http.createServer(app);
    initializeSocket(httpServer);
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
