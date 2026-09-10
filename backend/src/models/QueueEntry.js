const mongoose = require("mongoose");

const queueEntrySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    position: {
      type: Number,
      min: 1,
    },
    estimatedWaitTime: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ["WAITING", "PREPARING", "READY", "COMPLETED", "CANCELLED"],
      default: "WAITING",
    },
  },
  {
    timestamps: true,
  }
);

queueEntrySchema.index({ status: 1, position: 1 });
queueEntrySchema.index({ createdAt: 1 });

module.exports = mongoose.model("QueueEntry", queueEntrySchema);
