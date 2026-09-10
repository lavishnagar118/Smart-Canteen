const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    canteen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canteen",
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "An order must contain at least one item",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "CONFIRMED",
        "ACCEPTED",
        "PREPARING",
        "READY",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "PENDING_PAYMENT",
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    queuePosition: {
      type: Number,
      min: 1,
    },
    estimatedWaitTime: {
      type: Number,
      min: 0,
    },
    confirmedAt: Date,
    acceptedAt: Date,
    preparingAt: Date,
    readyAt: Date,
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ canteen: 1, createdAt: 1, status: 1, paymentStatus: 1 });

module.exports = mongoose.model("Order", orderSchema);
