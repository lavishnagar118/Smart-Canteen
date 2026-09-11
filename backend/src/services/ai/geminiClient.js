const { GoogleGenAI } = require("@google/genai");

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const DEFAULT_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;

class GeminiClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : process.env.GEMINI_API_KEY;
    this.defaultModel = options.defaultModel || DEFAULT_MODEL;
    this.defaultTimeoutMs = options.defaultTimeoutMs || DEFAULT_TIMEOUT_MS;
    this._customClient = options.client || null;
  }

  getClient(timeoutMs) {
    if (this._customClient) {
      return this._customClient;
    }
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return null;
    }
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: { timeout: timeoutMs || this.defaultTimeoutMs },
    });
  }

  cleanJsonString(text) {
    if (!text || typeof text !== "string") return "";
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
      cleaned = cleaned.replace(/\s*```$/, "");
      cleaned = cleaned.trim();
    }
    return cleaned;
  }

  async checkHealth() {
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return {
        available: false,
        modelPresent: false,
        provider: "gemini",
        defaultModel: this.defaultModel,
        error: "GEMINI_API_KEY is not configured",
      };
    }

    try {
      const ai = this.getClient(5000);
      await ai.models.get({ model: this.defaultModel });
      return {
        available: true,
        modelPresent: true,
        provider: "gemini",
        defaultModel: this.defaultModel,
      };
    } catch (error) {
      return {
        available: false,
        modelPresent: false,
        provider: "gemini",
        defaultModel: this.defaultModel,
        error: "Gemini health check failed",
      };
    }
  }

  async generateChat({
    messages,
    format = "json",
    model = null,
    temperature = 0.2,
    timeoutMs = null,
  }) {
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return {
        success: false,
        error: "Gemini API key is not configured",
        isFallback: true,
      };
    }

    const targetModel = model || this.defaultModel;
    const effectiveTimeout = timeoutMs || this.defaultTimeoutMs;

    try {
      const ai = this.getClient(effectiveTimeout);
      if (!ai) {
        return {
          success: false,
          error: "Gemini client initialization failed",
          isFallback: true,
        };
      }

      let systemInstruction = "";
      const contents = [];

      if (Array.isArray(messages)) {
        for (const msg of messages) {
          if (!msg || typeof msg !== "object") continue;
          if (msg.role === "system") {
            systemInstruction = systemInstruction
              ? `${systemInstruction}\n\n${msg.content}`
              : String(msg.content || "");
          } else {
            const role =
              msg.role === "assistant" || msg.role === "model"
                ? "model"
                : "user";
            contents.push({
              role,
              parts: [{ text: String(msg.content || "") }],
            });
          }
        }
      }

      if (contents.length === 0) {
        contents.push({
          role: "user",
          parts: [{ text: "" }],
        });
      }

      const config = {
        temperature,
      };

      if (systemInstruction) {
        config.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      if (format === "json") {
        config.responseMimeType = "application/json";
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents,
        config,
      });

      let rawContent = "";
      if (typeof response.text === "string") {
        rawContent = response.text;
      } else if (typeof response.text === "function") {
        rawContent = response.text();
      } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        rawContent = response.candidates[0].content.parts[0].text;
      }

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
        error.name === "TimeoutError" ||
        error.name === "AbortError" ||
        (error.message && error.message.toLowerCase().includes("timeout"));

      const safeErrorMessage = isTimeout
        ? "Gemini request timed out"
        : "Gemini request failed";

      let detailMsg = error.message || "";
      if (key) {
        detailMsg = detailMsg.split(key).join("[REDACTED]");
      }
      detailMsg = detailMsg.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED]");
      console.error(`[AI Provider: Gemini] ${safeErrorMessage}${detailMsg ? `: ${detailMsg}` : ""}`);

      return {
        success: false,
        error: safeErrorMessage,
        isFallback: true,
      };
    }
  }
}

module.exports = new GeminiClient();
module.exports.GeminiClient = GeminiClient;
