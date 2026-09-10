const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const User = require("../models/User");
const Order = require("../models/Order");
const AppError = require("../utils/AppError");

let io;

const orderRoom = (orderId) => `order:${orderId}`;

const extractToken = (socket) =>
  socket.handshake.auth?.token ||
  socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      if (!process.env.JWT_SECRET) {
        return next(new Error("JWT_SECRET is not configured"));
      }
      const token = extractToken(socket);
      if (!token) return next(new Error("Authentication token is required"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("_id role");
      if (!user) return next(new Error("Invalid authentication token"));
      socket.user = { id: user._id.toString(), role: user.role };
      next();
    } catch (error) {
      next(new Error(error.name === "TokenExpiredError" ? "Authentication token has expired" : "Invalid authentication token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Realtime client connected: ${socket.user.id}`);
    socket.join(socket.user.role === "CUSTOMER" ? `customer:${socket.user.id}` : "operations");

    socket.on("JOIN_ORDER", async (orderId, acknowledge) => {
      try {
        if (!orderId || typeof orderId !== "string") {
          throw new AppError("Invalid order ID", 400);
        }
        const order = await Order.findOne({ _id: orderId, user: socket.user.id }).select("_id");
        if (!order && socket.user.role === "CUSTOMER") {
          throw new AppError("Order not found", 404);
        }
        socket.join(orderRoom(orderId));
        if (typeof acknowledge === "function") acknowledge({ ok: true });
      } catch (error) {
        if (typeof acknowledge === "function") {
          acknowledge({ ok: false, message: error.message });
        }
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`Realtime client disconnected: ${socket.user.id} (${reason})`);
    });
  });

  return io;
};

const getSocketServer = () => io;

const emitToOrder = (orderId, event, payload) => {
  if (io) {
    io.to(orderRoom(orderId.toString())).to("operations").emit(event, payload);
  }
};

const emitOrderStatusUpdated = (order, queue = {}) => {
  emitToOrder(order._id, "ORDER_STATUS_UPDATED", {
    orderId: order._id.toString(),
    status: order.status,
    ...queue,
  });
};

const emitQueueUpdated = (orderId, queue) => {
  emitToOrder(orderId, "QUEUE_UPDATED", {
    orderId: orderId.toString(),
    ...queue,
  });
};

const emitWaitTimeUpdated = (orderId, queue) => {
  emitToOrder(orderId, "WAIT_TIME_UPDATED", {
    orderId: orderId.toString(),
    estimatedWaitTime: queue.estimatedWaitTime,
    queuePosition: queue.queuePosition,
    ordersAhead: queue.ordersAhead,
  });
};

module.exports = {
  emitOrderStatusUpdated,
  emitQueueUpdated,
  emitWaitTimeUpdated,
  getSocketServer,
  initializeSocket,
};
