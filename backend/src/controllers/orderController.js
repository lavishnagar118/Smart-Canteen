const orderService = require("../services/orderService");

const create = async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.user._id, req.body);
    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

const list = async (req, res, next) => {
  try {
    const query = { ...req.query };
    if (req.user.role === "STAFF" && req.user.canteen) {
      query.canteenId = req.user.canteen._id
        ? req.user.canteen._id.toString()
        : req.user.canteen.toString();
    }
    const data = ["STAFF", "ADMIN"].includes(req.user.role)
      ? await orderService.getOperationalOrders(query)
      : await orderService.getUserOrders(req.user._id, req.query);
    res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const order = ["STAFF", "ADMIN"].includes(req.user.role)
      ? await orderService.getOperationalOrderById(req.params.id)
      : await orderService.getOrderById(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: "Order retrieved successfully",
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

const cancel = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { cancel, create, getById, list };
