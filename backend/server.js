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

const reportAiConfiguration = () => {
  const aiProvider = require("./src/services/ai/aiProvider");
  const provider = aiProvider.getActiveProviderName();
  if (provider === "gemini") {
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
    console.log(
      `AI configuration: Provider=Gemini, Model=${model}, KeyConfigured=${hasKey ? "YES" : "NO"}`
    );
  } else {
    const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";
    const host = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || "http://localhost:11434";
    console.log(
      `AI configuration: Provider=Ollama, Model=${model}, Host=${host}`
    );
  }
};

const startServer = async () => {
  try {
    reportRazorpayConfiguration();
    reportAiConfiguration();
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
