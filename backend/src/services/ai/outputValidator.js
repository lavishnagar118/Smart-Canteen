const mongoose = require("mongoose");
const MenuItem = require("../../models/MenuItem");

const validateCustomerOutput = async (aiResponse, canteenId = null) => {
  if (!aiResponse || typeof aiResponse !== "object") {
    return {
      intent: "GENERAL_ASSISTANCE",
      reply: "Here are some recommendations from our menu.",
      recommendations: [],
    };
  }

  const intent = ["FOOD_RECOMMENDATION", "GENERAL_ASSISTANCE", "FALLBACK"].includes(
    aiResponse.intent
  )
    ? aiResponse.intent
    : "GENERAL_ASSISTANCE";

  const rawRecommendations = Array.isArray(aiResponse.recommendations)
    ? aiResponse.recommendations
    : [];

  const validatedRecs = [];

  for (const rec of rawRecommendations) {
    const rawId = rec.menuItemId || rec.id || rec._id;
    if (!rawId || !mongoose.isValidObjectId(rawId)) {
      continue; // Drop invalid ObjectId
    }

    const dbItem = await MenuItem.findById(rawId).lean();
    if (!dbItem) {
      continue; // Drop nonexistent item
    }

    if (dbItem.isAvailable !== true) {
      continue; // Drop unavailable item
    }

    if (
      canteenId &&
      dbItem.canteen &&
      dbItem.canteen.toString() !== canteenId.toString()
    ) {
      continue; // Drop item from different canteen
    }

    // STRICT OVERWRITE: Always enforce actual database values
    validatedRecs.push({
      menuItemId: dbItem._id.toString(),
      name: dbItem.name,
      price: dbItem.price, // Guaranteed authoritative DB price
      category: dbItem.category,
      preparationTime: dbItem.preparationTime,
      imageUrl: dbItem.imageUrl || "",
      canteen: dbItem.canteen ? dbItem.canteen.toString() : "",
      reason: String(rec.reason || "Recommended meal option").slice(0, 200),
      quantity:
        Number.isInteger(rec.quantity) && rec.quantity > 0 ? rec.quantity : 1,
    });
  }

  let finalIntent = intent;
  if (validatedRecs.length > 0) {
    finalIntent = "FOOD_RECOMMENDATION";
  } else if (rawRecommendations.length > 0 && validatedRecs.length === 0) {
    finalIntent = "GENERAL_ASSISTANCE";
  }

  return {
    intent: finalIntent,
    reply:
      typeof aiResponse.reply === "string" && aiResponse.reply.trim()
        ? aiResponse.reply.trim()
        : "Here are your meal options from today's menu.",
    recommendations: validatedRecs,
  };
};

const validateStaffOutput = (aiResponse, trustedContext) => {
  if (!aiResponse || typeof aiResponse !== "object") {
    return {
      intent: "KITCHEN_INSIGHT",
      reply: "Current kitchen queue status is steady.",
      highlights: [],
      trustedContextSummary: {
        activeQueueCount: trustedContext?.activeQueueCount || 0,
        statusCounts: trustedContext?.statusCounts || {},
      },
    };
  }

  const highlights = Array.isArray(aiResponse.highlights)
    ? aiResponse.highlights.map(String).slice(0, 5)
    : [];

  return {
    intent: "KITCHEN_INSIGHT",
    reply:
      typeof aiResponse.reply === "string" && aiResponse.reply.trim()
        ? aiResponse.reply.trim()
        : "Operational queue overview generated.",
    highlights,
    trustedContextSummary: {
      activeQueueCount: trustedContext?.activeQueueCount || 0,
      statusCounts: trustedContext?.statusCounts || {},
      topItemsInKitchen: trustedContext?.topItemsInKitchen || [],
      oldestPendingOrderId: trustedContext?.oldestPendingOrderId || null,
      queueSchedulePreview: trustedContext?.queueSchedulePreview || [],
    },
  };
};

const validateAdminOutput = (aiResponse, trustedContext) => {
  const verifiedMetrics = {
    ...(trustedContext?.overview || {}),
    peakHours:
      trustedContext?.overview?.peakHours?.length > 0
        ? trustedContext.overview.peakHours
        : trustedContext?.peakHours || [],
    topItems:
      trustedContext?.overview?.topItems?.length > 0
        ? trustedContext.overview.topItems
        : trustedContext?.topSellingItems || [],
  };

  if (!aiResponse || typeof aiResponse !== "object") {
    return {
      intent: "ANALYTICS_SUMMARY",
      reply: "Canteen analytics overview generated.",
      highlights: [],
      verifiedMetrics,
    };
  }

  const highlights = Array.isArray(aiResponse.highlights)
    ? aiResponse.highlights.map(String).slice(0, 5)
    : [];

  return {
    intent: "ANALYTICS_SUMMARY",
    reply:
      typeof aiResponse.reply === "string" && aiResponse.reply.trim()
        ? aiResponse.reply.trim()
        : "Analytics overview generated.",
    highlights,
    verifiedMetrics,
  };
};

module.exports = {
  validateAdminOutput,
  validateCustomerOutput,
  validateStaffOutput,
};
