const assert = require("node:assert/strict");
const test = require("node:test");
const { AIProvider, getActiveProviderName } = require("../src/services/ai/aiProvider");
const { GeminiClient } = require("../src/services/ai/geminiClient");
const { customerAssistant } = require("../src/services/ai/customerAssistant");
const { staffAssistant } = require("../src/services/ai/staffAssistant");
const { adminAssistant } = require("../src/services/ai/adminAssistant");
const contextBuilder = require("../src/services/ai/contextBuilder");
const MenuItem = require("../src/models/MenuItem");

const withEnv = async (overrides, callback) => {
  const original = {};
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  try {
    await callback();
  } finally {
    for (const key of Object.keys(original)) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
};

const withStubs = async (target, stubs, callback) => {
  const original = {};
  for (const key of Object.keys(stubs)) {
    original[key] = target[key];
    target[key] = stubs[key];
  }
  try {
    await callback();
  } finally {
    for (const key of Object.keys(original)) {
      target[key] = original[key];
    }
  }
};

test("AI Provider selection: defaults to Ollama in local development", async () => {
  await withEnv(
    {
      NODE_ENV: "development",
      RENDER: undefined,
      RENDER_SERVICE_ID: undefined,
      AI_PROVIDER: undefined,
      GEMINI_API_KEY: undefined,
    },
    async () => {
      const provider = new AIProvider();
      assert.equal(provider.getActiveProviderName(), "ollama");
      assert.equal(provider.getActiveClient(), provider.ollamaClient);
    }
  );
});

test("AI Provider selection: selects Gemini in production environment", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      RENDER: undefined,
      AI_PROVIDER: undefined,
    },
    async () => {
      const provider = new AIProvider();
      assert.equal(provider.getActiveProviderName(), "gemini");
      assert.equal(provider.getActiveClient(), provider.geminiClient);
    }
  );
});

test("AI Provider selection: selects Gemini when RENDER=true", async () => {
  await withEnv(
    {
      NODE_ENV: undefined,
      RENDER: "true",
      AI_PROVIDER: undefined,
    },
    async () => {
      const provider = new AIProvider();
      assert.equal(provider.getActiveProviderName(), "gemini");
      assert.equal(provider.getActiveClient(), provider.geminiClient);
    }
  );
});

test("AI Provider selection: respects explicit AI_PROVIDER overrides", async () => {
  // Explicit Ollama in production
  await withEnv(
    {
      NODE_ENV: "production",
      RENDER: "true",
      AI_PROVIDER: "ollama",
    },
    async () => {
      const provider = new AIProvider();
      assert.equal(provider.getActiveProviderName(), "ollama");
    }
  );

  // Explicit Gemini in development
  await withEnv(
    {
      NODE_ENV: "development",
      AI_PROVIDER: "gemini",
    },
    async () => {
      const provider = new AIProvider();
      assert.equal(provider.getActiveProviderName(), "gemini");
    }
  );
});

test("GeminiClient: returns graceful fallback when GEMINI_API_KEY is missing", async () => {
  const client = new GeminiClient({ apiKey: "" });
  const result = await client.generateChat({
    messages: [{ role: "user", content: "test" }],
  });

  assert.equal(result.success, false);
  assert.equal(result.isFallback, true);
  assert.match(result.error, /Gemini API key is not configured/i);
});

test("GeminiClient: cleans markdown JSON fences and parses response successfully", async () => {
  const fakeResponse = {
    text: '```json\n{\n  "intent": "FOOD_RECOMMENDATION",\n  "reply": "Here are vegetarian options",\n  "recommendations": []\n}\n```',
  };

  const mockAiClient = {
    models: {
      generateContent: async () => fakeResponse,
    },
  };

  const client = new GeminiClient({
    apiKey: "test-fake-key",
    client: mockAiClient,
  });

  const result = await client.generateChat({
    messages: [
      { role: "system", content: "You are an assistant" },
      { role: "user", content: "Vegetarian food chahiye" },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(result.data.intent, "FOOD_RECOMMENDATION");
  assert.equal(result.data.reply, "Here are vegetarian options");
  assert.deepEqual(result.data.recommendations, []);
});

test("GeminiClient: handles malformed JSON safely without throwing", async () => {
  const fakeResponse = {
    text: "Not a valid JSON response from model",
  };

  const mockAiClient = {
    models: {
      generateContent: async () => fakeResponse,
    },
  };

  const client = new GeminiClient({
    apiKey: "test-fake-key",
    client: mockAiClient,
  });

  const result = await client.generateChat({
    messages: [{ role: "user", content: "test" }],
  });

  assert.equal(result.success, false);
  assert.equal(result.isFallback, true);
  assert.match(result.error, /Malformed JSON/i);
});

test("GeminiClient: handles API errors safely without leaking credentials", async () => {
  const fakeSecretKey = "AIzaSyTestSecretKeyNeverExposeInLogs123";
  const mockAiClient = {
    models: {
      generateContent: async () => {
        const error = new Error(`Request failed for key=${fakeSecretKey}`);
        error.status = 403;
        throw error;
      },
    },
  };

  const client = new GeminiClient({
    apiKey: fakeSecretKey,
    client: mockAiClient,
  });

  const result = await client.generateChat({
    messages: [{ role: "user", content: "test" }],
  });

  assert.equal(result.success, false);
  assert.equal(result.isFallback, true);
  assert.equal(result.error, "Gemini request failed");
  assert.equal(result.error.includes(fakeSecretKey), false, "API key must NEVER be in error message");
});

test("GeminiClient: 429 RESOURCE_EXHAUSTED retries and succeeds", async () => {
  let callCount = 0;
  const mockAiClient = {
    models: {
      generateContent: async () => {
        callCount++;
        if (callCount === 1) {
          const error = new Error("Resource has been exhausted (rate limit)");
          error.status = 429;
          throw error;
        }
        return { text: JSON.stringify({ reply: "success after 429" }) };
      },
    },
  };

  const client = new GeminiClient({
    apiKey: "test-key",
    client: mockAiClient,
    sleep: async () => {},
  });

  const result = await client.generateChat({
    messages: [{ role: "user", content: "test" }],
  });

  assert.equal(result.success, true);
  assert.equal(callCount, 2);
  assert.equal(result.data.reply, "success after 429");
});

test("GeminiClient: 503 UNAVAILABLE retries and succeeds", async () => {
  let callCount = 0;
  const mockAiClient = {
    models: {
      generateContent: async () => {
        callCount++;
        if (callCount === 1) {
          const error = new Error("The service is currently unavailable");
          error.status = 503;
          throw error;
        }
        return { text: JSON.stringify({ reply: "success after 503" }) };
      },
    },
  };

  const client = new GeminiClient({
    apiKey: "test-key",
    client: mockAiClient,
    sleep: async () => {},
  });

  const result = await client.generateChat({
    messages: [{ role: "user", content: "test" }],
  });

  assert.equal(result.success, true);
  assert.equal(callCount, 2);
  assert.equal(result.data.reply, "success after 503");
});

test("GeminiClient: 429 retries exhausted returns graceful fallback", async () => {
  let callCount = 0;
  const mockAiClient = {
    models: {
      generateContent: async () => {
        callCount++;
        const error = new Error("Resource has been exhausted");
        error.status = 429;
        throw error;
      },
    },
  };

  const client = new GeminiClient({
    apiKey: "test-key",
    client: mockAiClient,
    maxRetries: 2,
    sleep: async () => {},
  });

  const result = await client.generateChat({
    messages: [{ role: "user", content: "test" }],
  });

  assert.equal(result.success, false);
  assert.equal(result.isFallback, true);
  assert.equal(result.error, "Gemini request failed");
  assert.equal(callCount, 3); // 1 initial + 2 retries
});

test("GeminiClient: 400 INVALID_ARGUMENT triggers immediate fallback with NO retry", async () => {
  let callCount = 0;
  const mockAiClient = {
    models: {
      generateContent: async () => {
        callCount++;
        const error = new Error("Invalid value at systemInstruction.role");
        error.status = 400;
        throw error;
      },
    },
  };

  const client = new GeminiClient({
    apiKey: "test-key",
    client: mockAiClient,
    maxRetries: 2,
    sleep: async () => {},
  });

  const result = await client.generateChat({
    messages: [{ role: "user", content: "test" }],
  });

  assert.equal(result.success, false);
  assert.equal(result.isFallback, true);
  assert.equal(result.error, "Gemini request failed");
  assert.equal(callCount, 1, "Must NOT retry 400 INVALID_ARGUMENT");
});

test("GeminiClient: 404 NOT_FOUND triggers immediate fallback with NO retry", async () => {
  let callCount = 0;
  const mockAiClient = {
    models: {
      generateContent: async () => {
        callCount++;
        const error = new Error("models/gemini-2.5-flash-lite is no longer available");
        error.status = 404;
        throw error;
      },
    },
  };

  const client = new GeminiClient({
    apiKey: "test-key",
    client: mockAiClient,
    maxRetries: 2,
    sleep: async () => {},
  });

  const result = await client.generateChat({
    messages: [{ role: "user", content: "test" }],
  });

  assert.equal(result.success, false);
  assert.equal(result.isFallback, true);
  assert.equal(result.error, "Gemini request failed");
  assert.equal(callCount, 1, "Must NOT retry 404 NOT_FOUND");
});

test("GeminiClient: timeout error retries and succeeds", async () => {
  let callCount = 0;
  const mockAiClient = {
    models: {
      generateContent: async () => {
        callCount++;
        if (callCount === 1) {
          const timeoutErr = new Error("Request timed out");
          timeoutErr.name = "TimeoutError";
          throw timeoutErr;
        }
        return { text: JSON.stringify({ reply: "success after timeout" }) };
      },
    },
  };

  const client = new GeminiClient({
    apiKey: "test-key",
    client: mockAiClient,
    sleep: async () => {},
  });

  const result = await client.generateChat({
    messages: [{ role: "user", content: "test" }],
  });

  assert.equal(result.success, true);
  assert.equal(callCount, 2);
  assert.equal(result.data.reply, "success after timeout");
});

test("GeminiClient: in-flight duplicate requests are deduplicated into single call", async () => {
  let callCount = 0;
  const mockAiClient = {
    models: {
      generateContent: async () => {
        callCount++;
        // Simulate in-flight async latency
        await new Promise((r) => setTimeout(r, 20));
        return { text: JSON.stringify({ reply: "deduplicated result" }) };
      },
    },
  };

  const client = new GeminiClient({
    apiKey: "test-key",
    client: mockAiClient,
  });

  const [res1, res2] = await Promise.all([
    client.generateChat({ messages: [{ role: "user", content: "same query" }] }),
    client.generateChat({ messages: [{ role: "user", content: "same query" }] }),
  ]);

  assert.equal(res1.success, true);
  assert.equal(res2.success, true);
  assert.equal(res1.data.reply, "deduplicated result");
  assert.equal(res2.data.reply, "deduplicated result");
  assert.equal(callCount, 1, "Concurrent identical queries must only call Gemini API once");
});

test("GeminiClient: health check reports ready when model is accessible", async () => {
  const mockAiClient = {
    models: {
      get: async () => ({ name: "models/gemini-3.5-flash-lite" }),
    },
  };

  const client = new GeminiClient({
    apiKey: "test-key",
    client: mockAiClient,
  });

  const status = await client.checkHealth();
  assert.equal(status.available, true);
  assert.equal(status.modelPresent, true);
  assert.equal(status.provider, "gemini");
  assert.equal(status.defaultModel, "gemini-3.5-flash-lite");
});

test("Customer AI works through Gemini provider in production mode", async () => {
  const testCanteenId = "507f1f77bcf86cd799439011";
  const testItemId = "507f1f77bcf86cd799439033";

  const fakeMenuItem = {
    _id: testItemId,
    name: "Masala Dosa",
    price: 70,
    category: "Breakfast",
    preparationTime: 6,
    isAvailable: true,
    canteen: testCanteenId,
  };

  await withEnv(
    {
      NODE_ENV: "production",
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "fake-prod-key",
    },
    async () => {
      const aiProvider = require("../src/services/ai/aiProvider");

      // Stub geminiClient's generateChat
      await withStubs(
        aiProvider.geminiClient,
        {
          generateChat: async () => ({
            success: true,
            data: {
              intent: "FOOD_RECOMMENDATION",
              reply: "₹100 ke budget mein Masala Dosa best choice hai!",
              recommendations: [
                {
                  menuItemId: testItemId,
                  name: "Masala Dosa",
                  price: 70,
                  reason: "Under ₹100 budget",
                },
              ],
            },
          }),
        },
        async () => {
          await withStubs(
            contextBuilder,
            {
              buildCustomerContext: async () => ({
                canteen: { id: testCanteenId, name: "Campus Central Canteen" },
                menu: [fakeMenuItem],
              }),
            },
            async () => {
              await withStubs(
                MenuItem,
                {
                  findById: () => ({
                    lean: async () => fakeMenuItem,
                  }),
                },
                async () => {
                  const res = await customerAssistant({
                    query: "₹100 ke andar dosa chahiye",
                    canteenId: testCanteenId,
                  });

                  assert.equal(res.intent, "FOOD_RECOMMENDATION");
                  assert.ok(res.reply.includes("Masala Dosa"));
                  assert.equal(res.recommendations.length, 1);
                  assert.equal(res.recommendations[0].menuItemId, testItemId);
                  assert.equal(res.recommendations[0].price, 70);
                }
              );
            }
          );
        }
      );
    }
  );
});

test("Staff AI works through Gemini provider in production mode", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "fake-prod-key",
    },
    async () => {
      const aiProvider = require("../src/services/ai/aiProvider");
      const staffContext = {
        activeQueueCount: 5,
        statusCounts: { CONFIRMED: 2, PREPARING: 3 },
      };

      await withStubs(
        aiProvider.geminiClient,
        {
          generateChat: async () => ({
            success: true,
            data: {
              intent: "KITCHEN_INSIGHT",
              reply: "Current load is 5 orders. Focus on preparing orders.",
              highlights: ["5 orders in queue", "3 preparing right now"],
            },
          }),
        },
        async () => {
          await withStubs(
            contextBuilder,
            {
              buildStaffContext: async () => staffContext,
            },
            async () => {
              const res = await staffAssistant({
                query: "Current queue load kya hai?",
                user: { role: "STAFF" },
              });

              assert.equal(res.intent, "KITCHEN_INSIGHT");
              assert.ok(res.reply.includes("5 orders"));
              assert.equal(res.highlights.length, 2);
              assert.equal(res.trustedContextSummary.activeQueueCount, 5);
            }
          );
        }
      );
    }
  );
});

test("Admin AI works through Gemini provider in production mode", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "fake-prod-key",
    },
    async () => {
      const aiProvider = require("../src/services/ai/aiProvider");
      const adminContext = {
        overview: { totalRevenue: 25000, totalOrders: 200 },
      };

      await withStubs(
        aiProvider.geminiClient,
        {
          generateChat: async () => ({
            success: true,
            data: {
              intent: "ANALYTICS_SUMMARY",
              reply: "Total revenue for today is Rs. 25,000 from 200 orders.",
              highlights: ["Revenue: Rs. 25,000", "Orders: 200"],
            },
          }),
        },
        async () => {
          await withStubs(
            contextBuilder,
            {
              buildAdminContext: async () => adminContext,
            },
            async () => {
              const res = await adminAssistant({
                query: "Aaj ke operations ka summary do",
              });

              assert.equal(res.intent, "ANALYTICS_SUMMARY");
              assert.ok(res.reply.includes("25,000"));
              assert.equal(res.verifiedMetrics.totalRevenue, 25000);
            }
          );
        }
      );
    }
  );
});
