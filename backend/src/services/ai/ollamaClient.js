const AppError = require("../../utils/AppError");

const DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";
const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 10000;

class OllamaClient {
  constructor(baseUrl = DEFAULT_BASE_URL, defaultModel = DEFAULT_MODEL) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.defaultModel = defaultModel;
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return {
          available: false,
          modelPresent: false,
          models: [],
          statusText: response.statusText,
        };
      }

      const data = await response.json();
      const models = (data.models || []).map((m) => m.name || m.model);
      const modelPresent = models.some(
        (name) => name === this.defaultModel || name.startsWith(`${this.defaultModel}:`)
      );

      return {
        available: true,
        modelPresent,
        models,
        defaultModel: this.defaultModel,
      };
    } catch (error) {
      return {
        available: false,
        modelPresent: false,
        models: [],
        error: error.message,
      };
    }
  }

  cleanJsonString(text) {
    if (!text || typeof text !== "string") return "";
    let cleaned = text.trim();
    // Strip markdown code fences if model enclosed JSON in ```json ... ```
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
      cleaned = cleaned.replace(/\s*```$/, "");
      cleaned = cleaned.trim();
    }
    return cleaned;
  }

  async generateChat({
    messages,
    format = "json",
    model = null,
    temperature = 0.2,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }) {
    const targetModel = model || this.defaultModel;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model: targetModel,
          messages,
          format,
          stream: false,
          options: {
            temperature,
          },
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Ollama HTTP ${response.status}: ${response.statusText}`,
          isFallback: true,
        };
      }

      const data = await response.json();
      const rawContent = data.message?.content || "";
      const cleaned = this.cleanJsonString(rawContent);

      try {
        const parsed = JSON.parse(cleaned);
        return {
          success: true,
          data: parsed,
          raw: rawContent,
        };
      } catch (parseError) {
        return {
          success: false,
          error: `Malformed JSON from model: ${parseError.message}`,
          raw: rawContent,
          isFallback: true,
        };
      }
    } catch (error) {
      const isTimeout =
        error.name === "TimeoutError" || error.name === "AbortError";
      return {
        success: false,
        error: isTimeout ? "Ollama request timed out" : error.message,
        isFallback: true,
      };
    }
  }
}

module.exports = new OllamaClient();
