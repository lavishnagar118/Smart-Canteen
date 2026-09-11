const ollamaClient = require("./ollamaClient");
const geminiClient = require("./geminiClient");

const getActiveProviderName = () => {
  const explicitProvider = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (explicitProvider === "gemini") {
    return "gemini";
  }
  if (explicitProvider === "ollama") {
    return "ollama";
  }

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true" ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    Boolean(process.env.RENDER_INSTANCE_ID);

  if (isProduction) {
    return "gemini";
  }

  return "ollama";
};

class AIProvider {
  constructor({ ollama = ollamaClient, gemini = geminiClient } = {}) {
    this.ollamaClient = ollama;
    this.geminiClient = gemini;
  }

  getActiveProviderName() {
    return getActiveProviderName();
  }

  getActiveClient() {
    return this.getActiveProviderName() === "gemini"
      ? this.geminiClient
      : this.ollamaClient;
  }

  async generateChat(options) {
    return this.getActiveClient().generateChat(options);
  }

  async checkHealth() {
    return this.getActiveClient().checkHealth();
  }
}

const defaultProvider = new AIProvider();

module.exports = defaultProvider;
module.exports.AIProvider = AIProvider;
module.exports.getActiveProviderName = getActiveProviderName;
