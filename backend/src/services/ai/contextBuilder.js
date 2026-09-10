const MenuItem = require("../../models/MenuItem");
const Canteen = require("../../models/Canteen");
const queueService = require("../queueService");
const orderService = require("../orderService");
const analyticsService = require("../analyticsService");
const validateObjectId = require("../../utils/validateObjectId");

const buildCustomerContext = async (canteenId = null) => {
  let canteen = null;

  if (canteenId) {
    validateObjectId(canteenId, "canteen id");
    canteen = await Canteen.findOne({ _id: canteenId, isActive: true }).lean();
  }

  if (!canteen) {
    canteen = await Canteen.findOne({ isActive: true }).lean();
  }

  const query = { isAvailable: true };
  if (canteen) {
    query.canteen = canteen._id;
  }

  const menuItems = await MenuItem.find(query)
    .select("_id name price category preparationTime description")
    .sort({ category: 1, price: 1 })
    .lean();

  return {
    canteen: canteen
      ? {
          id: canteen._id.toString(),
          name: canteen.name,
          location: canteen.location || "",
        }
      : { id: null, name: "Smart Canteen", location: "" },
    menu: menuItems.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      price: item.price,
      category: item.category,
      prepMinutes: item.preparationTime,
      description: item.description || "",
    })),
  };
};

const buildStaffContext = async (user = null, requestedCanteenId = null) => {
  let effectiveCanteenId = null;

  if (user && user.role === "STAFF" && user.canteen) {
    effectiveCanteenId = user.canteen._id
      ? user.canteen._id.toString()
      : user.canteen.toString();
  } else if (requestedCanteenId) {
    validateObjectId(requestedCanteenId, "canteen id");
    effectiveCanteenId = requestedCanteenId;
  }

  const [queue, operationalData] = await Promise.all([
    queueService.getCurrentQueue(effectiveCanteenId).catch(() => []),
    orderService
      .getOperationalOrders({
        canteenId: effectiveCanteenId,
        limit: 30,
      })
      .catch(() => ({ orders: [] })),
  ]);

  const orders = operationalData.orders || [];
  const statusCounts = {
    CONFIRMED: 0,
    ACCEPTED: 0,
    PREPARING: 0,
    READY: 0,
  };

  const itemCounts = {};
  for (const o of orders) {
    if (statusCounts[o.status] !== undefined) {
      statusCounts[o.status] += 1;
    }
    if (["CONFIRMED", "ACCEPTED", "PREPARING"].includes(o.status)) {
      for (const it of o.items || []) {
        itemCounts[it.name] = (itemCounts[it.name] || 0) + (it.quantity || 1);
      }
    }
  }

  // Identify top items in kitchen workload
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Oldest active order waiting
  const pendingOrders = orders.filter((o) =>
    ["CONFIRMED", "ACCEPTED"].includes(o.status)
  );
  const oldestWaiting = pendingOrders.length > 0 ? pendingOrders[pendingOrders.length - 1] : null;

  return {
    canteenId: effectiveCanteenId,
    activeQueueCount: queue.length,
    statusCounts,
    topItemsInKitchen: topItems,
    oldestPendingOrderId: oldestWaiting ? oldestWaiting._id.toString().slice(-6) : null,
    queueSchedulePreview: queue.slice(0, 5).map((q) => ({
      orderId: q.order?._id ? q.order._id.toString().slice(-6) : "—",
      status: q.order?.status || "WAITING",
      queuePosition: q.queuePosition,
      estStartMinutes: q.startAt,
      estFinishMinutes: q.finishAt,
    })),
  };
};

const buildAdminContext = async (canteenId = null, from = null, to = null) => {
  let effectiveCanteenId = canteenId;
  if (!effectiveCanteenId) {
    const active = await Canteen.findOne({ isActive: true }).lean();
    effectiveCanteenId = active ? active._id.toString() : null;
  }
  if (effectiveCanteenId) {
    validateObjectId(effectiveCanteenId, "canteen id");
  }

  const queryParams = {};
  if (effectiveCanteenId) {
    queryParams.canteenId = effectiveCanteenId;
  }
  if (from) queryParams.from = from;
  if (to) queryParams.to = to;

  const [revenueData, peakData, popularData, overviewData] = await Promise.all([
    analyticsService.revenue(queryParams).catch(() => ({ revenue: [] })),
    queryParams.canteenId
      ? analyticsService.peakHours(queryParams).catch(() => ({ peakHours: [] }))
      : Promise.resolve({ peakHours: [] }),
    analyticsService.popularItems(queryParams).catch(() => ({ items: [] })),
    analyticsService.getOverview(queryParams).catch(() => ({})),
  ]);

  return {
    canteenId: effectiveCanteenId,
    overview: overviewData || {},
    revenueTrend: (revenueData.revenue || []).slice(-7),
    peakHours: (peakData.peakHours || []).slice(0, 3),
    topSellingItems: (popularData.items || []).slice(0, 5),
  };
};

module.exports = {
  buildAdminContext,
  buildCustomerContext,
  buildStaffContext,
};
