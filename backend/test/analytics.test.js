const assert = require("node:assert/strict");
const test = require("node:test");
const Order = require("../src/models/Order");
const Canteen = require("../src/models/Canteen");
const AppError = require("../src/utils/AppError");
const analytics = require("../src/services/analyticsService");

const id = "507f1f77bcf86cd799439011";
const chain = (value) => ({ lean: async () => value });

test("validates strict analytics date ranges", () => {
  assert.deepEqual(analytics.getPeriod({ from: "2026-09-01", to: "2026-09-08" }).fromLabel, "2026-09-01");
  assert.throws(() => analytics.getPeriod({ from: "09/01/2026" }), (error) => error instanceof AppError);
  assert.throws(() => analytics.getPeriod({ from: "2026-09-09", to: "2026-09-08" }), (error) => error instanceof AppError);
});

test("ranks peak hours and chooses the lowest-demand hour", () => {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour: `${String(hour).padStart(2, "0")}:00`, orders: hour === 13 ? 31 : hour === 12 ? 27 : hour === 14 ? 22 : hour === 11 ? 2 : 0 }));
  const peaks = analytics.getPeakHours(hours);
  assert.deepEqual(peaks.map((item) => item.hour), ["13:00-14:00", "12:00-13:00", "14:00-15:00"]);
});

test("popular items and revenue pipelines use paid valid orders and canteen filters", async () => {
  const originalAggregate = Order.aggregate;
  const originalFindOne = Canteen.findOne;
  const pipelines = [];
  Order.aggregate = async (pipeline) => {
    pipelines.push(pipeline);
    const text = JSON.stringify(pipeline);
    if (text.includes("date")) return [{ _id: "2026-09-08", revenue: 160 }];
    if (text.includes("quantitySold")) return [{ _id: "Paneer Thali", quantitySold: 8 }];
    if (text.includes("totalAmount")) return [{ _id: null, totalOrders: 2, revenue: 160 }];
    return [];
  };
  Canteen.findOne = () => chain({ _id: id, isActive: true });
  try {
    const items = await analytics.popularItems({ from: "2026-09-08", to: "2026-09-08", canteenId: id });
    const revenue = await analytics.revenue({ from: "2026-09-08", to: "2026-09-08", canteenId: id });
    assert.deepEqual(items.items[0], { name: "Paneer Thali", quantitySold: 8 });
    assert.equal(revenue.revenue[0].revenue, 160);
    assert.match(JSON.stringify(pipelines), /paymentStatus/);
    assert.match(JSON.stringify(pipelines), /canteen/);
  } finally {
    Order.aggregate = originalAggregate;
    Canteen.findOne = originalFindOne;
  }
});

test("public peak hours require an active canteen", async () => {
  const originalFindOne = Canteen.findOne;
  Canteen.findOne = () => chain(null);
  try {
    await assert.rejects(
      analytics.peakHours({ canteenId: id, from: "2026-09-08", to: "2026-09-08" }),
      (error) => error instanceof AppError && error.statusCode === 404
    );
  } finally {
    Canteen.findOne = originalFindOne;
  }
});
