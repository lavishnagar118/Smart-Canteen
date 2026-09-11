const { GoogleGenAI } = require("@google/genai");

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const DEFAULT_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;
const MAX_RETRIES = 2;

class GeminiClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : process.env.GEMINI_API_KEY;
    this.defaultModel = options.defaultModel || DEFAULT_MODEL;
    this.defaultTimeoutMs = options.defaultTimeoutMs || DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : MAX_RETRIES;
    this._customClient = options.client || null;
    this._sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.inFlightRequests = new Map();
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

  extractErrorDetails(error, apiKey) {
    let httpStatus = null;
    let status = null;
    let reason = null;
    let retryDelayMs = null;
    const rawMessage = String(error?.message || "");

    // 1. Direct status code properties
    if (typeof error?.status === "number") {
      httpStatus = error.status;
    } else if (typeof error?.statusCode === "number") {
      httpStatus = error.statusCode;
    } else if (typeof error?.code === "number") {
      httpStatus = error.code;
    } else if (typeof error?.response?.status === "number") {
      httpStatus = error.response.status;
    }

    // 2. Direct string status
    if (typeof error?.status === "string" && isNaN(Number(error.status))) {
      status = error.status;
    }

    // 3. Inspect JSON error payload from error.error or message
    const errorObj = error?.error || null;
    if (errorObj) {
      if (!httpStatus && typeof errorObj.code === "number") httpStatus = errorObj.code;
      if (!status && typeof errorObj.status === "string") status = errorObj.status;
      if (Array.isArray(errorObj.details)) {
        for (const d of errorObj.details) {
          if (d.reason && !reason) reason = d.reason;
          if (d.retryDelay) {
            const sec = parseFloat(d.retryDelay);
            if (!isNaN(sec)) retryDelayMs = Math.round(sec * 1000);
          }
        }
      }
    }

    try {
      const jsonMatch = rawMessage.match(/\{[\s\S]*"error"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.error) {
          if (!httpStatus && typeof parsed.error.code === "number") {
            httpStatus = parsed.error.code;
          }
          if (!status && typeof parsed.error.status === "string") {
            status = parsed.error.status;
          }
          if (Array.isArray(parsed.error.details)) {
            for (const d of parsed.error.details) {
              if (d.reason && !reason) reason = d.reason;
              if (d.retryDelay) {
                const sec = parseFloat(d.retryDelay);
                if (!isNaN(sec)) retryDelayMs = Math.round(sec * 1000);
              }
            }
          }
        }
      }
    } catch (_) {}

    if (Array.isArray(error?.details)) {
      for (const d of error.details) {
        if (d.reason && !reason) reason = d.reason;
        if (d.retryDelay) {
          const sec = parseFloat(d.retryDelay);
          if (!isNaN(sec)) retryDelayMs = Math.round(sec * 1000);
        }
      }
    }

    // 4. Retry-After header
    const retryAfter =
      error?.response?.headers?.get?.("retry-after") ||
      error?.response?.headers?.["retry-after"];
    if (retryAfter) {
      const sec = parseFloat(retryAfter);
      if (!isNaN(sec)) {
        retryDelayMs = Math.round(sec * 1000);
      }
    }

    // 5. Fallback text detection
    if (!status) {
      if (/RESOURCE_EXHAUSTED/i.test(rawMessage)) status = "RESOURCE_EXHAUSTED";
      else if (/UNAVAILABLE/i.test(rawMessage)) status = "UNAVAILABLE";
      else if (/INVALID_ARGUMENT/i.test(rawMessage)) status = "INVALID_ARGUMENT";
      else if (/NOT_FOUND/i.test(rawMessage)) status = "NOT_FOUND";
      else if (/PERMISSION_DENIED/i.test(rawMessage)) status = "PERMISSION_DENIED";
      else if (/UNAUTHENTICATED/i.test(rawMessage)) status = "UNAUTHENTICATED";
    }

    if (!httpStatus) {
      if (status === "RESOURCE_EXHAUSTED" || /429/.test(rawMessage)) httpStatus = 429;
      else if (status === "UNAVAILABLE" || /503/.test(rawMessage)) httpStatus = 503;
      else if (status === "INVALID_ARGUMENT" || /400/.test(rawMessage)) httpStatus = 400;
      else if (status === "NOT_FOUND" || /404/.test(rawMessage)) httpStatus = 404;
      else if (status === "PERMISSION_DENIED" || /403/.test(rawMessage)) httpStatus = 403;
      else if (status === "UNAUTHENTICATED" || /401/.test(rawMessage)) httpStatus = 401;
    }

    const isTimeout =
      error?.name === "TimeoutError" ||
      error?.name === "AbortError" ||
      /timeout/i.test(rawMessage);

    const isNetwork =
      /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|network error/i.test(rawMessage);

    // Redact secrets
    let sanitizedMessage = rawMessage;
    if (apiKey) {
      sanitizedMessage = sanitizedMessage.split(apiKey).join("[REDACTED]");
    }
    sanitizedMessage = sanitizedMessage.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED]");
    sanitizedMessage = sanitizedMessage.replace(/Bearer\s+[A-Za-z0-9-_=.]+/gi, "Bearer [REDACTED]");

    return {
      httpStatus,
      status: status || (httpStatus ? `HTTP_${httpStatus}` : "UNKNOWN"),
      reason,
      retryDelayMs,
      isTimeout,
      isNetwork,
      sanitizedMessage,
    };
  }

  isRetryable(errInfo) {
    const { httpStatus, status, isTimeout, isNetwork } = errInfo;

    // Strict non-retryable errors
    if (
      httpStatus === 400 ||
      httpStatus === 401 ||
      httpStatus === 403 ||
      httpStatus === 404 ||
      status === "INVALID_ARGUMENT" ||
      status === "UNAUTHENTICATED" ||
      status === "PERMISSION_DENIED" ||
      status === "NOT_FOUND"
    ) {
      return false;
    }

    // Retryable transient errors
    if (
      httpStatus === 429 ||
      httpStatus === 503 ||
      httpStatus === 500 ||
      httpStatus === 502 ||
      httpStatus === 504 ||
      status === "RESOURCE_EXHAUSTED" ||
      status === "UNAVAILABLE" ||
      isTimeout ||
      isNetwork
    ) {
      return true;
    }

    return false;
  }

  calculateBackoffDelay(attempt, retryDelayMs) {
    if (typeof retryDelayMs === "number" && retryDelayMs > 0) {
      return Math.min(Math.max(retryDelayMs, 200), 3000);
    }
    const baseDelay = attempt === 0 ? 500 : 1200;
    const jitter = Math.floor(Math.random() * 200);
    return Math.min(baseDelay + jitter, 2500);
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

  async generateChat(options) {
    const {
      messages,
      format = "json",
      model = null,
      temperature = 0.2,
      timeoutMs = null,
    } = options;

    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return {
        success: false,
        error: "Gemini API key is not configured",
        isFallback: true,
      };
    }

    const targetModel = model || this.defaultModel;
    const cacheKey = `${targetModel}:${format}:${JSON.stringify(messages)}`;

    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey);
    }

    const requestPromise = this._executeGenerateChatWithRetry({
      messages,
      format,
      targetModel,
      temperature,
      timeoutMs,
      key,
    }).finally(() => {
      this.inFlightRequests.delete(cacheKey);
    });

    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  async _executeGenerateChatWithRetry({
    messages,
    format,
    targetModel,
    temperature,
    timeoutMs,
    key,
  }) {
    const effectiveTimeout = timeoutMs || this.defaultTimeoutMs;
    const maxAttempts = 1 + this.maxRetries;

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

    let lastErrorInfo = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const ai = this.getClient(effectiveTimeout);
        if (!ai) {
          return {
            success: false,
            error: "Gemini client initialization failed",
            isFallback: true,
          };
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
        const errInfo = this.extractErrorDetails(error, key);
        lastErrorInfo = errInfo;

        const isRetryable = this.isRetryable(errInfo);
        const hasRemainingRetries = attempt < maxAttempts - 1;

        if (isRetryable && hasRemainingRetries) {
          const delayMs = this.calculateBackoffDelay(attempt, errInfo.retryDelayMs);
          console.warn(
            `[AI Provider: Gemini] Transient error on attempt ${attempt + 1}/${maxAttempts} (HTTP ${errInfo.httpStatus || "N/A"}, status=${errInfo.status}, reason=${errInfo.reason || "N/A"}). Retrying in ${delayMs}ms...`
          );
          await this._sleep(delayMs);
          continue;
        }

        const safeErrorMessage = errInfo.isTimeout
          ? "Gemini request timed out"
          : "Gemini request failed";

        console.error(
          `[AI Provider: Gemini] ${safeErrorMessage}: HTTP ${errInfo.httpStatus || "N/A"}, status=${errInfo.status}, reason=${errInfo.reason || "N/A"}${errInfo.retryDelayMs ? `, retryDelay=${errInfo.retryDelayMs}ms` : ""} - ${errInfo.sanitizedMessage}`
        );

        return {
          success: false,
          error: safeErrorMessage,
          isFallback: true,
        };
      }
    }

    const safeErrorMessage = lastErrorInfo?.isTimeout
      ? "Gemini request timed out"
      : "Gemini request failed";

    return {
      success: false,
      error: safeErrorMessage,
      isFallback: true,
    };
  }
}

module.exports = new GeminiClient();
module.exports.GeminiClient = GeminiClient;

