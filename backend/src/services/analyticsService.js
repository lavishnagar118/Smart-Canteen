const mongoose = require("mongoose");
const Order = require("../models/Order");
const Canteen = require("../models/Canteen");
const AppError = require("../utils/AppError");
const validateObjectId = require("../utils/validateObjectId");

const VALID_STATUSES = ["CONFIRMED", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];
const timezone = () => process.env.ANALYTICS_TIMEZONE || "Asia/Kolkata";

const formatDateInTimezone = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const localBoundary = (dateLabel, endOfDay = false) => {
  const [year, month, day] = dateLabel.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  let candidate = target;
  for (let index = 0; index < 2; index += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(candidate));
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const actual = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second, endOfDay ? 999 : 0);
    candidate += target - actual;
  }
  return new Date(candidate);
};

const dateOnly = (value, field) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    throw new AppError(`${field} must use YYYY-MM-DD format`, 400);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError(`${field} is invalid`, 400);
  }
  return value;
};

const getPeriod = (query = {}) => {
  const now = new Date();
  const to = query.to ? dateOnly(query.to, "to") : formatDateInTimezone(now);
  const fromDate = new Date(`${to}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 6);
  const from = query.from ? dateOnly(query.from, "from") : fromDate.toISOString().slice(0, 10);
  if (from > to) throw new AppError("from must not be after to", 400);
  return {
    from: localBoundary(from),
    to: localBoundary(to, true),
    fromLabel: from,
    toLabel: to,
  };
};

const canteenMatch = (canteenId) => {
  if (!canteenId) return {};
  validateObjectId(canteenId, "canteen id");
  return { canteen: new mongoose.Types.ObjectId(canteenId) };
};

const validMatch = (period, canteenId) => ({
  createdAt: { $gte: period.from, $lte: period.to },
  paymentStatus: "PAID",
  status: { $in: VALID_STATUSES },
  ...canteenMatch(canteenId),
});

const assertCanteen = async (canteenId, requireActive = false) => {
  if (!canteenId) return;
  validateObjectId(canteenId, "canteen id");
  const filter = { _id: canteenId, ...(requireActive ? { isActive: true } : {}) };
  const canteen = await Canteen.findOne(filter).lean();
  if (!canteen) throw new AppError(requireActive ? "Canteen not found or inactive" : "Canteen not found", 404);
};

const hourPipeline = (period, canteenId) => [
  { $match: validMatch(period, canteenId) },
  { $project: { hour: { $hour: { date: "$createdAt", timezone: timezone() } } } },
  { $group: { _id: "$hour", orders: { $sum: 1 } } },
  { $sort: { _id: 1 } },
];

const getHourly = async (period, canteenId) => {
  const rows = await Order.aggregate(hourPipeline(period, canteenId));
  const byHour = new Map(rows.map((row) => [Number(row._id), Number(row.orders)]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    orders: byHour.get(hour) || 0,
  }));
};

const getPeakHours = (hours, limit = 3) =>
  [...hours]
    .filter((row) => row.orders > 0)
    .sort((a, b) => b.orders - a.orders || a.hour.localeCompare(b.hour))
    .slice(0, limit)
    .map((row) => {
      const start = row.hour;
      const end = `${String((Number(start.slice(0, 2)) + 1) % 24).padStart(2, "0")}:00`;
      return { hour: `${start}-${end}`, orders: row.orders, start, end };
    });

const getOverview = async (query) => {
  const period = getPeriod(query);
  await assertCanteen(query.canteenId);
  const match = validMatch(period, query.canteenId);
  const [summary, items, hours, preparation] = await Promise.all([
    Order.aggregate([
      { $match: match },
      { $group: { _id: null, totalOrders: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      { $group: { _id: "$items.name", quantitySold: { $sum: "$items.quantity" } } },
      { $sort: { quantitySold: -1, _id: 1 } },
      { $limit: 5 },
    ]),
    getHourly(period, query.canteenId),
    Order.aggregate([
      { $match: { ...match, preparingAt: { $exists: true }, readyAt: { $exists: true }, $expr: { $gte: ["$readyAt", "$preparingAt"] } } },
      { $project: { duration: { $divide: [{ $subtract: ["$readyAt", "$preparingAt"] }, 60000] } } },
      { $group: { _id: null, average: { $avg: "$duration" } } },
    ]),
  ]);
  const totalOrders = summary[0]?.totalOrders || 0;
  const periodHours = Math.max(1, Math.ceil((period.to.getTime() - period.from.getTime()) / 3600000));
  const averageOrdersPerHour = Number((totalOrders / periodHours).toFixed(1));
  return {
    totalOrders,
    averageOrdersPerHour,
    averagePreparationTime: Number((preparation[0]?.average || 0).toFixed(1)),
    peakHours: getPeakHours(hours),
    topItems: items.map((item) => ({ name: item._id, quantitySold: item.quantitySold })),
    revenue: summary[0]?.revenue || 0,
  };
};

const ordersByHour = async (query) => {
  const period = getPeriod(query);
  await assertCanteen(query.canteenId);
  return { hours: await getHourly(period, query.canteenId) };
};

const popularItems = async (query) => {
  const period = getPeriod(query);
  await assertCanteen(query.canteenId);
  const rows = await Order.aggregate([
    { $match: validMatch(period, query.canteenId) },
    { $unwind: "$items" },
    { $group: { _id: "$items.name", quantitySold: { $sum: "$items.quantity" } } },
    { $sort: { quantitySold: -1, _id: 1 } },
    { $limit: 5 },
  ]);
  return { items: rows.map((row) => ({ name: row._id, quantitySold: row.quantitySold })) };
};

const revenue = async (query) => {
  const period = getPeriod(query);
  await assertCanteen(query.canteenId);
  const rows = await Order.aggregate([
    { $match: validMatch(period, query.canteenId) },
    { $project: { date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: timezone() } }, totalAmount: 1 } },
    { $group: { _id: "$date", revenue: { $sum: "$totalAmount" } } },
    { $sort: { _id: 1 } },
  ]);
  const values = new Map(rows.map((row) => [row._id, row.revenue]));
  const result = [];
  for (let cursor = new Date(`${period.fromLabel}T00:00:00.000Z`); cursor <= new Date(`${period.toLabel}T00:00:00.000Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    result.push({ date, revenue: values.get(date) || 0 });
  }
  return { revenue: result };
};

const peakHours = async (query) => {
  const period = getPeriod(query);
  if (!query.canteenId) throw new AppError("canteenId is required", 400);
  await assertCanteen(query.canteenId, true);
  const hours = await getHourly(period, query.canteenId);
  const ranked = getPeakHours(hours, 3);
  if (!ranked.length) {
    return { peakHours: [], bestTimeToOrder: null };
  }
  const quiet = [...hours].sort((a, b) => a.orders - b.orders || a.hour.localeCompare(b.hour))[0] || { hour: "00:00" };
  const start = quiet.hour;
  return {
    peakHours: ranked.map(({ start: peakStart, end, orders }) => ({ start: peakStart, end, orders })),
    bestTimeToOrder: { start, end: `${String((Number(start.slice(0, 2)) + 1) % 24).padStart(2, "0")}:00` },
  };
};

module.exports = { getOverview, ordersByHour, peakHours, popularItems, revenue, getPeriod, getPeakHours };
