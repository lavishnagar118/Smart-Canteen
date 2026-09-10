const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const Canteen = require("../models/Canteen");
const AppError = require("../utils/AppError");
const validateObjectId = require("../utils/validateObjectId");

const MAX_ITEM_QUANTITY = 100;
const MAX_ORDER_ITEMS = 50;
const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

const parsePositiveInteger = (value, fieldName, maximum) => {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new AppError(
      `${fieldName} must be a positive integer no greater than ${maximum}`,
      400
    );
  }
  return value;
};

const normalizeRequestedItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("items must contain at least one item", 400);
  }
  if (items.length > MAX_ORDER_ITEMS) {
    throw new AppError(`An order cannot contain more than ${MAX_ORDER_ITEMS} items`, 400);
  }

  const quantities = new Map();

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AppError("Each order item must be an object", 400);
    }
    const fields = Object.keys(item);
    if (fields.some((field) => !["menuItem", "quantity"].includes(field))) {
      throw new AppError("Order items may only contain menuItem and quantity", 400);
    }
    if (!item.menuItem) {
      throw new AppError("menuItem is required", 400);
    }

    const menuItemId = validateObjectId(item.menuItem, "menu item id");
    const quantity = parsePositiveInteger(
      item.quantity,
      "quantity",
      MAX_ITEM_QUANTITY
    );
    const combinedQuantity = (quantities.get(menuItemId) || 0) + quantity;
    if (combinedQuantity > MAX_ITEM_QUANTITY) {
      throw new AppError(
        `Combined quantity for a menu item cannot exceed ${MAX_ITEM_QUANTITY}`,
        400
      );
    }
    quantities.set(menuItemId, combinedQuantity);
  }

  return quantities;
};

const createOrder = async (userId, data) => {
  validateObjectId(userId, "user id");
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new AppError("Request body must be an object", 400);
  }
  if (Object.keys(data).some((field) => !["items", "canteenId"].includes(field))) {
    throw new AppError("Request may only contain canteenId and items", 400);
  }

  let canteen;
  if (data.canteenId !== undefined) {
    validateObjectId(data.canteenId, "canteen id");
    canteen = await Canteen.findOne({ _id: data.canteenId, isActive: true }).lean();
    if (!canteen) throw new AppError("Canteen not found or inactive", 400);
  }

  const quantities = normalizeRequestedItems(data.items);
  const menuItemIds = [...quantities.keys()];
  const menuFilter = {
    _id: { $in: menuItemIds },
    isAvailable: true,
  };
  if (data.canteenId) menuFilter.canteen = data.canteenId;
  const menuItems = await MenuItem.find(menuFilter).lean();

  if (menuItems.length !== menuItemIds.length) {
    throw new AppError("One or more menu items are unavailable, invalid, or belong to another canteen", 400);
  }

  const canteenIds = new Set(
    menuItems.map((item) => item.canteen && item.canteen.toString()).filter(Boolean)
  );
  if (canteenIds.size > 1 || (data.canteenId && [...canteenIds].some((id) => id !== data.canteenId))) {
    throw new AppError("Order items must belong to one canteen", 400);
  }
  if (!canteen && canteenIds.size === 1) {
    canteen = { _id: [...canteenIds][0] };
  }

  const menuItemsById = new Map(
    menuItems.map((menuItem) => [menuItem._id.toString(), menuItem])
  );
  const items = menuItemIds.map((menuItemId) => {
    const menuItem = menuItemsById.get(menuItemId);
    const quantity = quantities.get(menuItemId);
    const subtotal = menuItem.price * quantity;

    return {
      menuItem: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      quantity,
      subtotal,
    };
  });
  const totalAmount = items.reduce((total, item) => total + item.subtotal, 0);

  const order = await Order.create({
    user: userId,
    ...(canteen ? { canteen: canteen._id } : {}),
    items,
    totalAmount,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
  });

  return order;
};

const parsePagination = (query) => {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    throw new AppError("page must be a positive integer", 400);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError("limit must be an integer between 1 and 100", 400);
  }

  return { page, limit };
};

const getUserOrders = async (userId, query = {}) => {
  validateObjectId(userId, "user id");
  const { page, limit } = parsePagination(query);
  const filter = { user: userId };

  if (query.status !== undefined) {
    if (!ORDER_STATUSES.includes(query.status)) {
      throw new AppError("Invalid order status", 400);
    }
    filter.status = query.status;
  }

  const skip = (page - 1) * limit;
  const [orders, totalItems] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const getOperationalOrders = async (query = {}) => {
  const { page, limit } = parsePagination(query);
  const filter = {};

  if (query.canteenId) {
    validateObjectId(query.canteenId, "canteen id");
    filter.canteen = query.canteenId;
  }

  if (query.status !== undefined) {
    if (!ORDER_STATUSES.includes(query.status)) {
      throw new AppError("Invalid order status", 400);
    }
    filter.status = query.status;
  }

  const skip = (page - 1) * limit;
  const [orders, totalItems] = await Promise.all([
    Order.find(filter)
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const getOperationalOrderById = async (orderId) => {
  validateObjectId(orderId, "order id");
  const order = await Order.findById(orderId)
    .populate("user", "name email phone")
    .lean();
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  return order;
};

const getOrderById = async (userId, orderId) => {
  validateObjectId(userId, "user id");
  validateObjectId(orderId, "order id");
  const order = await Order.findOne({ _id: orderId, user: userId }).lean();

  if (!order) {
    throw new AppError("Order not found", 404);
  }
  return order;
};

const cancelOrder = async (userId, orderId) => {
  validateObjectId(userId, "user id");
  validateObjectId(orderId, "order id");

  const order = await Order.findOneAndUpdate(
    { _id: orderId, user: userId, status: "PENDING_PAYMENT" },
    { $set: { status: "CANCELLED" } },
    { new: true, runValidators: true }
  ).lean();

  if (order) {
    return order;
  }

  const existingOrder = await Order.findOne({ _id: orderId, user: userId })
    .select({ status: 1 })
    .lean();
  if (!existingOrder) {
    throw new AppError("Order not found", 404);
  }
  throw new AppError("Only pending payment orders can be cancelled", 409);
};

module.exports = {
  cancelOrder,
  createOrder,
  getOperationalOrderById,
  getOperationalOrders,
  getOrderById,
  getUserOrders,
};
