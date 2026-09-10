const paymentService = require("../services/paymentService");

const createOrder = async (req, res, next) => {
  try {
    const data = await paymentService.createRazorpayOrder(
      req.user._id,
      req.body && req.body.orderId
    );
    res.status(201).json({
      success: true,
      message: "Payment order created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const verify = async (req, res, next) => {
  try {
    const result = await paymentService.verifyPayment(req.user._id, req.body);
    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const status = async (req, res, next) => {
  try {
    const result = await paymentService.getPaymentStatus(
      req.user._id,
      req.params.orderId
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const webhook = async (req, res, next) => {
  try {
    const result = await paymentService.processWebhook(
      req.rawBody,
      req.headers["x-razorpay-signature"]
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { createOrder, status, verify, webhook };
