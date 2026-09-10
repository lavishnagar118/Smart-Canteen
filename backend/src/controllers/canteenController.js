const canteenService = require("../services/canteenService");
const menuService = require("../services/menuService");

const get = async (req, res, next) => {
  try {
    const canteen = await canteenService.getCanteen(req.params.id);
    res.json({ success: true, message: "Canteen retrieved successfully", data: { canteen } });
  } catch (error) { next(error); }
};

const list = async (req, res, next) => {
  try {
    const canteens = await canteenService.listCanteens(req.user);
    res.json({ success: true, message: "Canteens retrieved successfully", data: { canteens } });
  } catch (error) { next(error); }
};

const listMenu = async (req, res, next) => {
  try {
    await canteenService.assertActiveCanteen(req.params.canteenId);
    const data = await menuService.getMenu({ query: req.query, user: req.user, canteenId: req.params.canteenId });
    res.json({ success: true, message: "Canteen menu retrieved successfully", data });
  } catch (error) { next(error); }
};

const create = async (req, res, next) => {
  try {
    const canteen = await canteenService.createCanteen(req.body);
    res.status(201).json({ success: true, message: "Canteen created successfully", data: { canteen } });
  } catch (error) { next(error); }
};

const update = async (req, res, next) => {
  try {
    const canteen = await canteenService.updateCanteen(req.params.id, req.body);
    res.json({ success: true, message: "Canteen updated successfully", data: { canteen } });
  } catch (error) { next(error); }
};

const status = async (req, res, next) => {
  try {
    const canteen = await canteenService.setStatus(req.params.id, req.body?.isActive);
    res.json({ success: true, message: "Canteen status updated successfully", data: { canteen } });
  } catch (error) { next(error); }
};

const remove = async (req, res, next) => {
  try {
    const canteen = await canteenService.archiveCanteen(req.params.id);
    res.json({ success: true, message: "Canteen archived successfully", data: { canteen } });
  } catch (error) { next(error); }
};

module.exports = { create, get, list, listMenu, remove, status, update };
