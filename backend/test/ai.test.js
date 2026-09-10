const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const AppError = require("../src/utils/AppError");
const MenuItem = require("../src/models/MenuItem");
const Canteen = require("../src/models/Canteen");
const User = require("../src/models/User");
const ollamaClient = require("../src/services/ai/ollamaClient");
const { customerAssistant } = require("../src/services/ai/customerAssistant");
const { staffAssistant } = require("../src/services/ai/staffAssistant");
const { adminAssistant } = require("../src/services/ai/adminAssistant");
const outputValidator = require("../src/services/ai/outputValidator");
const contextBuilder = require("../src/services/ai/contextBuilder");
const { authenticate, requireRole } = require("../src/middleware/authMiddleware");

const canteenIdA = "507f1f77bcf86cd799439011";
const canteenIdB = "507f1f77bcf86cd799439022";
const itemIdA = "507f1f77bcf86cd799439033";
const itemIdUnavailable = "507f1f77bcf86cd799439044";
const itemIdCanteenB = "507f1f77bcf86cd799439055";

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

test("Role authorization strictly isolates Customer, Staff, and Admin AI endpoints", () => {
  const customerGuard = requireRole("CUSTOMER");
  const staffGuard = requireRole("STAFF", "ADMIN");
  const adminGuard = requireRole("ADMIN");

  // Customer endpoint checks
  let custErrForStaff = null;
  customerGuard({ user: { role: "STAFF" } }, {}, (err) => { custErrForStaff = err; });
  assert.equal(custErrForStaff?.statusCode, 403, "STAFF must not access customer AI endpoint");

  let custErrForAdmin = null;
  customerGuard({ user: { role: "ADMIN" } }, {}, (err) => { custErrForAdmin = err; });
  assert.equal(custErrForAdmin?.statusCode, 403, "ADMIN must not access customer AI endpoint");

  let custAllowed = false;
  customerGuard({ user: { role: "CUSTOMER" } }, {}, (err) => { if (!err) custAllowed = true; });
  assert.equal(custAllowed, true, "CUSTOMER must be allowed on customer AI endpoint");

  // Staff endpoint checks
  let staffErrForCust = null;
  staffGuard({ user: { role: "CUSTOMER" } }, {}, (err) => { staffErrForCust = err; });
  assert.equal(staffErrForCust?.statusCode, 403, "CUSTOMER must not access staff AI endpoint");

  let staffAllowed = false;
  staffGuard({ user: { role: "STAFF" } }, {}, (err) => { if (!err) staffAllowed = true; });
  assert.equal(staffAllowed, true, "STAFF must access staff AI endpoint");

  let staffAdminAllowed = false;
  staffGuard({ user: { role: "ADMIN" } }, {}, (err) => { if (!err) staffAdminAllowed = true; });
  assert.equal(staffAdminAllowed, true, "ADMIN must access staff AI endpoint");

  // Admin endpoint checks
  let adminErrForCust = null;
  adminGuard({ user: { role: "CUSTOMER" } }, {}, (err) => { adminErrForCust = err; });
  assert.equal(adminErrForCust?.statusCode, 403, "CUSTOMER must not access admin AI endpoint");

  let adminErrForStaff = null;
  adminGuard({ user: { role: "STAFF" } }, {}, (err) => { adminErrForStaff = err; });
  assert.equal(adminErrForStaff?.statusCode, 403, "STAFF must not access admin AI endpoint");

  let adminAllowed = false;
  adminGuard({ user: { role: "ADMIN" } }, {}, (err) => { if (!err) adminAllowed = true; });
  assert.equal(adminAllowed, true, "ADMIN must access admin AI endpoint");
});

test("Customer AI rejects empty or excessively long queries (>500 chars)", async () => {
  // Empty query
  await assert.rejects(
    customerAssistant({ query: "" }),
    (err) => err instanceof AppError && err.statusCode === 400
  );

  // Whitespace only
  await assert.rejects(
    customerAssistant({ query: "    " }),
    (err) => err instanceof AppError && err.statusCode === 400
  );

  // > 500 characters
  const longQuery = "a".repeat(501);
  await assert.rejects(
    customerAssistant({ query: longQuery }),
    (err) => err instanceof AppError && err.statusCode === 400
  );
});

test("Output validator strictly overwrites model price with DB price and filters invalid/unavailable items", async () => {
  const dbItems = {
    [itemIdA]: {
      _id: new mongoose.Types.ObjectId(itemIdA),
      name: "Paneer Thali",
      price: 80, // Real DB price is 80
      category: "Main Course",
      preparationTime: 12,
      isAvailable: true,
      canteen: new mongoose.Types.ObjectId(canteenIdA),
    },
    [itemIdUnavailable]: {
      _id: new mongoose.Types.ObjectId(itemIdUnavailable),
      name: "Out of Stock Burger",
      price: 60,
      isAvailable: false, // Unavailable!
      canteen: new mongoose.Types.ObjectId(canteenIdA),
    },
    [itemIdCanteenB]: {
      _id: new mongoose.Types.ObjectId(itemIdCanteenB),
      name: "Other Canteen Dosa",
      price: 70,
      isAvailable: true,
      canteen: new mongoose.Types.ObjectId(canteenIdB), // Belongs to Canteen B!
    },
  };

  await withStubs(
    MenuItem,
    {
      findById: (id) => ({
        lean: async () => dbItems[id.toString()] || null,
      }),
    },
    async () => {
      const untrustedAiResponse = {
        intent: "FOOD_RECOMMENDATION",
        reply: "Here is your budget meal!",
        recommendations: [
          {
            menuItemId: itemIdA,
            name: "Model Invented Name",
            price: 25, // Model hallucinated a discount of 25 instead of 80!
            reason: "Cheap meal",
          },
          {
            menuItemId: itemIdUnavailable, // Should be filtered out
            name: "Out of Stock Burger",
            price: 60,
          },
          {
            menuItemId: itemIdCanteenB, // Different canteen, should be filtered out
            name: "Other Canteen Dosa",
            price: 70,
          },
          {
            menuItemId: "invalid-mongo-id-123", // Malformed ID, should be filtered out
            name: "Ghost Item",
            price: 10,
          },
          {
            menuItemId: "507f1f77bcf86cd799439099", // Nonexistent ID, should be filtered out
            name: "Missing Item",
            price: 50,
          },
        ],
      };

      const result = await outputValidator.validateCustomerOutput(
        untrustedAiResponse,
        canteenIdA
      );

      assert.equal(result.intent, "FOOD_RECOMMENDATION");
      assert.equal(result.recommendations.length, 1, "Only the valid, available item from canteen A must remain");

      const validRec = result.recommendations[0];
      assert.equal(validRec.menuItemId, itemIdA);
      assert.equal(validRec.name, "Paneer Thali", "Name must be overwritten with DB name");
      assert.equal(validRec.price, 80, "Price MUST be overwritten with authoritative DB price of 80");
    }
  );
});

test("Customer AI handles Hinglish query and returns validated recommendations", async () => {
  const fakeMenu = [
    {
      _id: itemIdA,
      name: "Veg Burger",
      price: 60,
      category: "Fast Food",
      preparationTime: 8,
      isAvailable: true,
      canteen: canteenIdA,
    },
  ];

  await withStubs(
    contextBuilder,
    {
      buildCustomerContext: async () => ({
        canteen: { id: canteenIdA, name: "Campus Central Canteen" },
        menu: [
          {
            id: itemIdA,
            name: "Veg Burger",
            price: 60,
            category: "Fast Food",
            prepMinutes: 8,
          },
        ],
      }),
    },
    async () => {
      await withStubs(
        ollamaClient,
        {
          generateChat: async () => ({
            success: true,
            data: {
              intent: "FOOD_RECOMMENDATION",
              reply: "₹100 ke budget mein aapke liye Veg Burger ekdum badhiya option hai!",
              recommendations: [
                {
                  menuItemId: itemIdA,
                  name: "Veg Burger",
                  price: 60,
                  reason: "Under ₹100 budget and ready in 8 mins",
                },
              ],
            },
          }),
        },
        async () => {
          await withStubs(
            MenuItem,
            {
              findById: () => ({
                lean: async () => fakeMenu[0],
              }),
            },
            async () => {
              const res = await customerAssistant({
                query: "₹100 ke andar vegetarian meal suggest karo",
                canteenId: canteenIdA,
              });

              assert.equal(res.intent, "FOOD_RECOMMENDATION");
              assert.ok(res.reply.includes("Veg Burger"));
              assert.equal(res.recommendations.length, 1);
              assert.equal(res.recommendations[0].price, 60);
            }
          );
        }
      );
    }
  );
});

test("Customer AI returns graceful fallback when Ollama is unavailable without throwing error", async () => {
  await withStubs(
    contextBuilder,
    {
      buildCustomerContext: async () => ({
        canteen: { id: canteenIdA, name: "Campus Central Canteen" },
        menu: [],
      }),
    },
    async () => {
      await withStubs(
        ollamaClient,
        {
          generateChat: async () => ({
            success: false,
            error: "fetch failed: ECONNREFUSED",
            isFallback: true,
          }),
        },
        async () => {
          const res = await customerAssistant({
            query: "Pet bharna hai",
            canteenId: canteenIdA,
          });

          assert.equal(res.intent, "FALLBACK");
          assert.equal(res.fallback, true);
          assert.ok(res.reply.includes("temporarily unavailable"));
          assert.deepEqual(res.recommendations, []);
        }
      );
    }
  );
});

test("Staff AI assistant provides read-only queue insights and recommendations", async () => {
  const staffContext = {
    canteenId: canteenIdA,
    activeQueueCount: 3,
    statusCounts: { CONFIRMED: 1, ACCEPTED: 1, PREPARING: 1, READY: 0 },
    topItemsInKitchen: [{ name: "Paneer Thali", count: 2 }],
  };

  await withStubs(
    contextBuilder,
    {
      buildStaffContext: async () => staffContext,
    },
    async () => {
      await withStubs(
        ollamaClient,
        {
          generateChat: async () => ({
            success: true,
            data: {
              intent: "KITCHEN_INSIGHT",
              reply: "Currently 3 orders are queued. Prioritize Order #123 which is waiting longest.",
              highlights: [
                "3 active orders in pipeline",
                "Bottleneck: 2 Paneer Thalis at hot plate station",
              ],
            },
          }),
        },
        async () => {
          const res = await staffAssistant({
            query: "Current queue load kya hai?",
            user: { role: "STAFF" },
            canteenId: canteenIdA,
          });

          assert.equal(res.intent, "KITCHEN_INSIGHT");
          assert.ok(res.reply.includes("Order #123"));
          assert.equal(res.highlights.length, 2);
          assert.equal(res.trustedContextSummary.activeQueueCount, 3);
        }
      );
    }
  );
});

test("Staff AI returns graceful fallback when Ollama is offline with trusted context attached", async () => {
  await withStubs(
    contextBuilder,
    {
      buildStaffContext: async () => ({
        activeQueueCount: 4,
        statusCounts: { CONFIRMED: 2, PREPARING: 2 },
      }),
    },
    async () => {
      await withStubs(
        ollamaClient,
        {
          generateChat: async () => ({
            success: false,
            error: "timeout",
            isFallback: true,
          }),
        },
        async () => {
          const res = await staffAssistant({
            query: "Kitchen workload kaisa hai?",
            user: { role: "STAFF" },
          });

          assert.equal(res.intent, "FALLBACK");
          assert.equal(res.fallback, true);
          assert.ok(res.reply.includes("Queue controls are still available"));
          assert.equal(res.trustedContextSummary.activeQueueCount, 4);
        }
      );
    }
  );
});

test("Admin AI grounds analytics query in verified backend metrics", async () => {
  const adminContext = {
    overview: { totalRevenue: 15400, totalOrders: 142 },
    peakHours: [{ hour: "13:00-14:00", orders: 35 }],
    topSellingItems: [{ name: "Veg Burger", quantitySold: 48 }],
  };

  await withStubs(
    contextBuilder,
    {
      buildAdminContext: async () => adminContext,
    },
    async () => {
      await withStubs(
        ollamaClient,
        {
          generateChat: async () => ({
            success: true,
            data: {
              intent: "ANALYTICS_SUMMARY",
              reply: "Aaj total revenue Rs. 15,400 raha from 142 orders. Peak hour 13:00-14:00 baje raha.",
              highlights: [
                "Total Revenue: Rs. 15,400",
                "Peak traffic: 1:00 PM - 2:00 PM",
                "Top item: Veg Burger (48 sold)",
              ],
            },
          }),
        },
        async () => {
          const res = await adminAssistant({
            query: "Aaj revenue kaisa raha?",
            canteenId: canteenIdA,
          });

          assert.equal(res.intent, "ANALYTICS_SUMMARY");
          assert.ok(res.reply.includes("15,400"));
          assert.equal(res.verifiedMetrics.totalRevenue, 15400);
          assert.equal(res.verifiedMetrics.totalOrders, 142);
        }
      );
    }
  );
});
