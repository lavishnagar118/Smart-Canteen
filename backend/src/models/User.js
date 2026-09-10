const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    googleId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      select: false,
    },
    firebaseUid: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      select: false,
    },
    authProvider: {
      type: String,
      enum: ["LOCAL", "GOOGLE", "LOCAL_GOOGLE", "FIREBASE", "LOCAL_FIREBASE"],
      default: "LOCAL",
    },
    sessionVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
    role: {
      type: String,
      enum: ["CUSTOMER", "STAFF", "ADMIN"],
      default: "CUSTOMER",
    },
    staffId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    canteen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canteen",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1 });

module.exports = mongoose.model("User", userSchema);
