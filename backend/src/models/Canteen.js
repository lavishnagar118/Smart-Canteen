const mongoose = require("mongoose");

const canteenSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    location: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

canteenSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model("Canteen", canteenSchema);
