const staffService = require("../services/staffService");

const list = async (req, res, next) => {
  try {
    const data = await staffService.listStaff(req.query);
    res.status(200).json({
      success: true,
      message: "Staff retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const staff = await staffService.createStaff(req.body);
    res.status(201).json({
      success: true,
      message: "Staff member created successfully",
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const staff = await staffService.getStaffById(req.params.id);
    res.status(200).json({
      success: true,
      message: "Staff member retrieved successfully",
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const staff = await staffService.updateStaff(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: "Staff member updated successfully",
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const staff = await staffService.updateStaffStatus(
      req.params.id,
      req.body.status
    );
    res.status(200).json({
      success: true,
      message: `Staff member status updated to ${staff.status}`,
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const staff = await staffService.resetStaffPassword(
      req.params.id,
      req.body.password,
      req.body.confirmPassword
    );
    res.status(200).json({
      success: true,
      message: "Staff password reset successfully",
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getById,
  list,
  resetPassword,
  update,
  updateStatus,
};
