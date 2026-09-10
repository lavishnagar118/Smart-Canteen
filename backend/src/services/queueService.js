const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const QueueEntry = require("../models/QueueEntry");
const Canteen = require("../models/Canteen");
const AppError = require("../utils/AppError");
const validateObjectId = require("../utils/validateObjectId");
const { getKitchenStaffCount } = require("../utils/queueConfig");

const ACTIVE_ORDER_STATUSES = ["CONFIRMED", "ACCEPTED", "PREPARING"];
const ACTIVE_QUEUE_STATUSES = ["WAITING", "PREPARING"];
const TRANSITIONS = {
  accept: ["CONFIRMED"],
  start: ["ACCEPTED", "PREPARING"],
  ready: ["PREPARING", "READY"],
  complete: ["READY", "COMPLETED"],
};

const roundMinutes = (minutes) => Math.max(0, Math.round(minutes));

const getOrderPreparationTime = async (order) => {
  const ids = order.items.map((item) => item.menuItem).filter(Boolean);
  const menuItems = await MenuItem.find({ _id: { $in: ids } })
    .select({ _id: 1, preparationTime: 1 })
    .lean();
  const preparationTimes = new Map(
    menuItems.map((item) => [item._id.toString(), Number(item.preparationTime)])
  );

  const durations = order.items.map((item) => {
    const preparationTime = preparationTimes.get(item.menuItem.toString());
    const fallback = Number.isFinite(preparationTime) ? preparationTime : 0;
    const quantity = Number.isInteger(item.quantity) && item.quantity > 0
      ? item.quantity
      : 1;
    return Math.max(0, fallback * quantity);
  });

  return durations.length ? Math.max(...durations) : 0;
};

const getActiveOrders = async (canteenId) =>
  Order.find({
    status: { $in: ACTIVE_ORDER_STATUSES },
    paymentStatus: "PAID",
    ...(canteenId ? { canteen: canteenId } : {}),
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

const buildSchedule = async (orders) => {
  const staffCount = getKitchenStaffCount();
  const availability = Array(staffCount).fill(0);
  const schedule = [];

  for (const order of orders) {
    const duration = await getOrderPreparationTime(order);
    let workerIndex = 0;
    for (let index = 1; index < availability.length; index += 1) {
      if (availability[index] < availability[workerIndex]) {
        workerIndex = index;
      }
    }

    const startAt = availability[workerIndex];
    availability[workerIndex] = startAt + duration;
    schedule.push({
      order,
      duration,
      startAt,
      finishAt: availability[workerIndex],
      queuePosition: schedule.length + 1,
    });
  }

  return schedule;
};

const updateQueueRecords = async (schedule) => {
  await Promise.all(
    schedule.map((entry, index) =>
      QueueEntry.findOneAndUpdate(
        { order: entry.order._id },
        {
          order: entry.order._id,
          position: index + 1,
          estimatedWaitTime: roundMinutes(entry.startAt),
          status: entry.order.status === "PREPARING" ? "PREPARING" : "WAITING",
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      )
    )
  );

  await Promise.all(
    schedule.map((entry, index) =>
      Order.findByIdAndUpdate(entry.order._id, {
        queuePosition: index + 1,
        estimatedWaitTime: roundMinutes(entry.startAt),
      })
    )
  );
};

const publishQueueSchedule = (schedule) => {
  const {
    emitOrderStatusUpdated,
    emitQueueUpdated,
    emitWaitTimeUpdated,
  } = require("../realtime/socket");

  schedule.forEach((entry, index) => {
    const queue = {
      queuePosition: index + 1,
      ordersAhead: index,
      estimatedWaitTime: roundMinutes(entry.startAt),
    };
    emitQueueUpdated(entry.order._id, queue);
    emitWaitTimeUpdated(entry.order._id, queue);
    emitOrderStatusUpdated(entry.order, queue);
  });
};

const recalculateQueue = async (canteenId, publish = false) => {
  const orders = await getActiveOrders(canteenId);
  const schedule = await buildSchedule(orders);
  await updateQueueRecords(schedule);
  if (publish) {
    publishQueueSchedule(schedule);
  }
  return schedule;
};

const addOrderToQueue = async (orderId) => {
  validateObjectId(orderId, "order id");
  const order = await Order.findById(orderId).lean();
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  if (order.status !== "CONFIRMED" || order.paymentStatus !== "PAID") {
    throw new AppError("Only paid confirmed orders can enter the queue", 409);
  }

  await QueueEntry.findOneAndUpdate(
    { order: order._id },
    { order: order._id, status: "WAITING" },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
  await recalculateQueue(order.canteen, true);
  return QueueEntry.findOne({ order: order._id }).lean();
};

const getScheduleEntry = async (orderId) => {
  validateObjectId(orderId, "order id");
  const order = await Order.findById(orderId).lean();
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  const schedule = await recalculateQueue(order.canteen);
  const entry = schedule.find(
    (scheduled) => scheduled.order._id.toString() === orderId
  );
  if (!entry) {
    throw new AppError("Order is not in the active queue", 404);
  }
  return entry;
};

const calculateQueuePosition = async (orderId) => {
  const entry = await getScheduleEntry(orderId);
  return entry.queuePosition;
};

const calculateEstimatedWaitTime = async (orderId) => {
  const entry = await getScheduleEntry(orderId);
  return roundMinutes(entry.startAt);
};

const transitionOrder = async (orderId, action) => {
  validateObjectId(orderId, "order id");
  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  const allowedStatuses = TRANSITIONS[action];
  if (!allowedStatuses.includes(order.status)) {
    throw new AppError(`Invalid order status transition to ${action}`, 409);
  }
  if (order.paymentStatus !== "PAID") {
    throw new AppError("Only paid orders can enter the queue", 409);
  }

  const nextStatus = {
    accept: "ACCEPTED",
    start: "PREPARING",
    ready: "READY",
    complete: "COMPLETED",
  }[action];
  order.status = nextStatus;
  const timestampField = {
    ACCEPTED: "acceptedAt",
    PREPARING: "preparingAt",
    READY: "readyAt",
    COMPLETED: "completedAt",
  }[nextStatus];
  if (timestampField && !order[timestampField]) {
    order[timestampField] = new Date();
  }
  if (nextStatus === "READY" || nextStatus === "COMPLETED") {
    order.queuePosition = undefined;
    order.estimatedWaitTime = undefined;
  }
  await order.save();

  if (nextStatus === "COMPLETED") {
    await QueueEntry.findOneAndUpdate(
      { order: order._id },
      { status: "COMPLETED", $unset: { position: 1, estimatedWaitTime: 1 } }
    );
  } else {
    await QueueEntry.findOneAndUpdate(
      { order: order._id },
      { status: nextStatus === "PREPARING" ? "PREPARING" : nextStatus === "READY" ? "READY" : "WAITING" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  await recalculateQueue(order.canteen, true);
  const refreshedOrder = await Order.findById(order._id);
  const { emitOrderStatusUpdated } = require("../realtime/socket");
  emitOrderStatusUpdated(refreshedOrder, {
    queuePosition: refreshedOrder.queuePosition,
    estimatedWaitTime: refreshedOrder.estimatedWaitTime,
    ordersAhead:
      typeof refreshedOrder.queuePosition === "number"
        ? Math.max(0, refreshedOrder.queuePosition - 1)
        : undefined,
  });
  return refreshedOrder && refreshedOrder.toObject
    ? refreshedOrder.toObject()
    : refreshedOrder;
};

const acceptOrder = (orderId) => transitionOrder(orderId, "accept");
const startPreparing = (orderId) => transitionOrder(orderId, "start");
const markReady = (orderId) => transitionOrder(orderId, "ready");
const completeOrder = (orderId) => transitionOrder(orderId, "complete");

const getQueueStatus = async (user, orderId) => {
  validateObjectId(orderId, "order id");
  const order = await Order.findOne({ _id: orderId, user: user._id }).lean();
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  const queueEntry = await QueueEntry.findOne({ order: order._id }).lean();
  if (!queueEntry || !ACTIVE_QUEUE_STATUSES.includes(queueEntry.status)) {
    throw new AppError("Order is not in the active queue", 404);
  }

  const schedule = await recalculateQueue(order.canteen);
  const current = schedule.find(
    (entry) => entry.order._id.toString() === orderId
  );
  if (!current) {
    throw new AppError("Order is not in the active queue", 404);
  }

  return {
    orderId: order._id.toString(),
    status: queueEntry.status,
    queuePosition: current.queuePosition,
    ordersAhead: Math.max(0, current.queuePosition - 1),
    estimatedWaitTime: roundMinutes(current.startAt),
  };
};

const getCurrentQueue = async (canteenId) => {
  if (canteenId) {
    validateObjectId(canteenId, "canteen id");
    const canteen = await Canteen.findOne({ _id: canteenId, isActive: true }).lean();
    if (!canteen) {
      throw new AppError("Canteen not found or inactive", 404);
    }
  }
  const schedule = await recalculateQueue(canteenId);
  return schedule.map((entry, index) => ({
    orderId: entry.order._id.toString(),
    order: {
      _id: entry.order._id,
      user: entry.order.user,
      items: entry.order.items,
      totalAmount: entry.order.totalAmount,
      createdAt: entry.order.createdAt,
    },
    status: entry.order.status,
    queuePosition: index + 1,
    estimatedWaitTime: roundMinutes(entry.startAt),
    createdAt: entry.order.createdAt,
  }));
};

const getPublicQueueSummary = async (canteenId) => {
  validateObjectId(canteenId, "canteen id");
  const canteen = await Canteen.findOne({ _id: canteenId, isActive: true }).lean();
  if (!canteen) {
    throw new AppError("Canteen not found or inactive", 404);
  }
  const schedule = await recalculateQueue(canteenId);
  return {
    queueLength: schedule.length,
    estimatedWaitTime: schedule.length
      ? roundMinutes(schedule[0].startAt)
      : 0,
  };
};

module.exports = {
  acceptOrder,
  addOrderToQueue,
  calculateEstimatedWaitTime,
  calculateQueuePosition,
  completeOrder,
  getCurrentQueue,
  getPublicQueueSummary,
  getQueueStatus,
  markReady,
  recalculateQueue,
  startPreparing,
};
