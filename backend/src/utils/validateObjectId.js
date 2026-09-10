const mongoose = require("mongoose");
const AppError = require("./AppError");

const validateObjectId = (value, fieldName = "id") => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }

  return value;
};

module.exports = validateObjectId;
