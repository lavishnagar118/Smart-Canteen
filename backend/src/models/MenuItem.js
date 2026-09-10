const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    canteen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canteen",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    preparationTime: {
      type: Number,
      required: true,
      min: 0,
    },
    tasteTags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

menuItemSchema.index({ category: 1, isAvailable: 1 });
menuItemSchema.index({ tasteTags: 1 });
menuItemSchema.index({ name: 1 });

module.exports = mongoose.model("MenuItem", menuItemSchema);
