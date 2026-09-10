const mongoose = require("mongoose");

const connectDatabase = async () => {
  const { MONGODB_URI } = process.env;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected");
};

module.exports = connectDatabase;
