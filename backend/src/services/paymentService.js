const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const AppError = require("../utils/AppError");
const validateObjectId = require("../utils/validateObjectId");
const queueService = require("./queueService");

const CURRENCY = "INR";

const getRazorpayClient = (client) => {
  if (client) {
    return client;
  }
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new AppError("Razorpay credentials are not configured", 500);
  }
  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
};

const getWebhookSecret = () => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw new AppError("RAZORPAY_WEBHOOK_SECRET is not configured", 500);
  }
  return process.env.RAZORPAY_WEBHOOK_SECRET;
};

const amountInPaise = (amount) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Order amount must be greater than zero", 400);
  }
  return Math.round(amount * 100);
};

const safePaymentData = (order, payment) => ({
  razorpayOrderId: payment.razorpayOrderId,
  keyId: process.env.RAZORPAY_KEY_ID,
  amount: payment.amount,
  currency: CURRENCY,
  internalOrderId: order._id.toString(),
});

const createPaymentRecord = async ({ order, razorpayOrderId, amount }) =>
  Payment.create({
    order: order._id,
    user: order.user,
    razorpayOrderId,
    amount,
    status: "CREATED",
  });

const createRazorpayOrder = async (userId, orderId, razorpayClient) => {
  validateObjectId(userId, "user id");
  validateObjectId(orderId, "order id");

  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  if (
    order.status !== "PENDING_PAYMENT" ||
    !["PENDING", "FAILED"].includes(order.paymentStatus)
  ) {
    throw new AppError("Order is not pending payment", 409);
  }

  if (order.paymentStatus === "PENDING" && order.razorpayOrderId) {
    const existingPayment = await Payment.findOne({
      order: order._id,
      razorpayOrderId: order.razorpayOrderId,
      status: "CREATED",
    });
    if (existingPayment) {
      return safePaymentData(order, existingPayment);
    }
  }

  const amount = amountInPaise(order.totalAmount);
  let razorpayOrder;
  try {
    razorpayOrder = await getRazorpayClient(razorpayClient).orders.create({
      amount,
      currency: CURRENCY,
      receipt: `order_${order._id.toString()}`,
    });
  } catch (error) {
    console.error(`Razorpay order creation failed for internal order ${orderId}`);
    throw new AppError("Unable to create payment order", 502);
  }

  try {
    order.razorpayOrderId = razorpayOrder.id;
    order.paymentStatus = "PENDING";
    await order.save();
    const payment = await createPaymentRecord({
      order,
      razorpayOrderId: razorpayOrder.id,
      amount,
    });
    console.log(
      `Payment order created: internal=${orderId}, razorpay=${razorpayOrder.id}`
    );
    return safePaymentData(order, payment);
  } catch (error) {
    if (error.code === 11000) {
      const existingPayment = await Payment.findOne({
        order: order._id,
        razorpayOrderId: razorpayOrder.id,
        status: "CREATED",
      });
      if (existingPayment) {
        return safePaymentData(order, existingPayment);
      }
    }
    throw error;
  }
};

const getPaymentStatus = async (userId, orderId) => {
  validateObjectId(userId, "user id");
  validateObjectId(orderId, "order id");

  const orderQuery = Order.findOne({ _id: orderId, user: userId });
  const order =
    typeof orderQuery.select === "function"
      ? await orderQuery.select("_id status paymentStatus")
      : await orderQuery;
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  return {
    orderId: order._id.toString(),
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
  };
};

const verifySignature = (razorpayOrderId, razorpayPaymentId, signature) => {
  if (!razorpayOrderId || !razorpayPaymentId || !signature) {
    throw new AppError("Payment verification details are required", 400);
  }
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new AppError("Razorpay credentials are not configured", 500);
  }
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new AppError("Invalid payment signature", 400);
  }
};

const markPaymentCaptured = async ({
  payment,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const capturedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "CAPTURED" } },
    {
      status: "CAPTURED",
      razorpayPaymentId,
      razorpaySignature,
    },
    { new: true, runValidators: true }
  );

  const finalPayment = capturedPayment || (await Payment.findById(payment._id));
  await Order.findByIdAndUpdate(payment.order, {
    paymentStatus: "PAID",
    status: "CONFIRMED",
    confirmedAt: new Date(),
  });
  await queueService.addOrderToQueue(payment.order);
  return finalPayment;
};

const verifyPayment = async (userId, data) => {
  validateObjectId(userId, "user id");
  validateObjectId(data && data.orderId, "order id");

  const order = await Order.findOne({ _id: data.orderId, user: userId });
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  if (!order.razorpayOrderId || order.razorpayOrderId !== data.razorpay_order_id) {
    throw new AppError("Razorpay order ID does not match", 400);
  }

  const payment = await Payment.findOne({
    order: order._id,
    razorpayOrderId: data.razorpay_order_id,
  });
  if (!payment) {
    throw new AppError("Payment record not found", 404);
  }
  if (payment.status === "CAPTURED") {
    if (payment.razorpayPaymentId === data.razorpay_payment_id) {
      await queueService.addOrderToQueue(payment.order);
      return { order, payment };
    }
    throw new AppError("Order payment has already been processed", 409);
  }

  verifySignature(
    data.razorpay_order_id,
    data.razorpay_payment_id,
    data.razorpay_signature
  );
  const capturedPayment = await markPaymentCaptured({
    payment,
    razorpayPaymentId: data.razorpay_payment_id,
    razorpaySignature: data.razorpay_signature,
  });
  order.paymentStatus = "PAID";
  order.status = "CONFIRMED";
  order.confirmedAt = order.confirmedAt || new Date();
  return { order, payment: capturedPayment };
};

const verifyWebhookSignature = (rawBody, signature) => {
  if (!rawBody || !signature) {
    throw new AppError("Invalid webhook signature", 400);
  }
  const expectedSignature = crypto
    .createHmac("sha256", getWebhookSecret())
    .update(rawBody)
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new AppError("Invalid webhook signature", 400);
  }
};

const processWebhook = async (rawBody, signature) => {
  verifyWebhookSignature(rawBody, signature);
  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new AppError("Invalid webhook payload", 400);
  }

  const paymentEntity = event.payload?.payment?.entity;
  const orderEntity = event.payload?.order?.entity;
  const razorpayOrderId =
    paymentEntity?.order_id || orderEntity?.id;
  if (!razorpayOrderId) {
    return { processed: false };
  }

  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) {
    return { processed: false };
  }
  const eventName = event.event;

  if (eventName === "payment.captured" || eventName === "order.paid") {
    if (payment.status !== "CAPTURED") {
      await markPaymentCaptured({
        payment,
        razorpayPaymentId: paymentEntity?.id || payment.razorpayPaymentId,
        razorpaySignature: payment.razorpaySignature,
      });
    } else {
      await queueService.addOrderToQueue(payment.order);
    }
    console.log(
      `Payment captured by webhook: internal=${payment.order}, razorpay=${razorpayOrderId}`
    );
  } else if (eventName === "payment.failed" && payment.status === "CREATED") {
    await Payment.findOneAndUpdate(
      { _id: payment._id, status: "CREATED" },
      {
        status: "FAILED",
        razorpayPaymentId: paymentEntity?.id,
      },
      { new: true, runValidators: true }
    );
    await Order.findByIdAndUpdate(payment.order, {
      paymentStatus: "FAILED",
    });
  }

  return { processed: true };
};

module.exports = {
  createRazorpayOrder,
  getPaymentStatus,
  processWebhook,
  verifyPayment,
  verifySignature,
  verifyWebhookSignature,
};
