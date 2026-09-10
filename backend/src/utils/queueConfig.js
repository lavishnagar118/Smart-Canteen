const AppError = require("./AppError");

const getKitchenStaffCount = () => {
  const count = Number(process.env.KITCHEN_STAFF_COUNT || 2);
  if (!Number.isInteger(count) || count < 1) {
    throw new AppError("KITCHEN_STAFF_COUNT must be a positive integer", 500);
  }
  return count;
};

module.exports = { getKitchenStaffCount };
