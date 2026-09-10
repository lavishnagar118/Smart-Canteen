const menuService = require("../services/menuService");

const create = async (req, res, next) => {
  try {
    const item = await menuService.createMenuItem(req.body);
    res.status(201).json({
      success: true,
      message: "Menu item created successfully",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

const list = async (req, res, next) => {
  try {
    const data = await menuService.getMenu({
      query: req.query,
      user: req.user,
      canteenId: req.query.canteenId,
    });
    res.status(200).json({
      success: true,
      message: "Menu items retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const item = await menuService.getMenuItemById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "Menu item retrieved successfully",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const item = await menuService.updateMenuItem(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

const availability = async (req, res, next) => {
  try {
    const item = await menuService.updateAvailability(
      req.params.id,
      req.body && req.body.isAvailable
    );
    res.status(200).json({
      success: true,
      message: "Menu item availability updated successfully",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const item = await menuService.archiveMenuItem(req.params.id);
    res.status(200).json({
      success: true,
      message: "Menu item archived successfully",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { availability, create, getById, list, remove, update };
