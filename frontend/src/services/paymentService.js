import api from "./api";

export const createPaymentOrder = (orderId) =>
  api.post("/payments/create-order", { orderId });

export const verifyPayment = (paymentData) =>
  api.post("/payments/verify", {
    orderId: paymentData.orderId,
    razorpay_order_id: paymentData.razorpay_order_id,
    razorpay_payment_id: paymentData.razorpay_payment_id,
    razorpay_signature: paymentData.razorpay_signature,
  });

export const getPaymentStatus = (orderId) =>
  api.get(`/payments/${orderId}/status`);
