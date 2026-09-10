const Canteen = require("../models/Canteen");
const AppError = require("../utils/AppError");
const validateObjectId = require("../utils/validateObjectId");

const fields = ["name", "location", "description", "isActive"];

const validateData = (data, partial = false) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new AppError("Request body must be an object", 400);
  }
  if (Object.keys(data).some((field) => !fields.includes(field))) {
    throw new AppError("Request contains invalid fields", 400);
  }
  if (!partial && (typeof data.name !== "string" || !data.name.trim())) {
    throw new AppError("name is required", 400);
  }
  for (const field of ["name", "location", "description"]) {
    if (data[field] !== undefined && typeof data[field] !== "string") {
      throw new AppError(`${field} must be a string`, 400);
    }
  }
  if (data.isActive !== undefined && typeof data.isActive !== "boolean") {
    throw new AppError("isActive must be a boolean", 400);
  }
};

const publicCanteen = (canteen) => ({
  id: canteen._id.toString(),
  name: canteen.name,
  location: canteen.location,
  description: canteen.description,
  isActive: canteen.isActive,
});

const getCanteen = async (id) => {
  validateObjectId(id, "canteen id");
  const canteen = await Canteen.findById(id).lean();
  if (!canteen) throw new AppError("Canteen not found", 404);
  return publicCanteen(canteen);
};

const listCanteens = async (user) => {
  const filter = user?.role === "ADMIN" ? {} : { isActive: true };
  const canteens = await Canteen.find(filter).sort({ name: 1 }).lean();
  return canteens.map(publicCanteen);
};

const createCanteen = async (data) => {
  validateData(data);
  const canteen = await Canteen.create({ ...data, name: data.name.trim() });
  return canteen;
};

const updateCanteen = async (id, data) => {
  validateObjectId(id, "canteen id");
  validateData(data, true);
  if (!Object.keys(data).length) throw new AppError("At least one field is required", 400);
  const canteen = await Canteen.findByIdAndUpdate(
    id,
    { ...data, ...(data.name ? { name: data.name.trim() } : {}) },
    { new: true, runValidators: true }
  ).lean();
  if (!canteen) throw new AppError("Canteen not found", 404);
  return canteen;
};

const setStatus = async (id, isActive) => updateCanteen(id, { isActive });

const archiveCanteen = async (id) => setStatus(id, false);

const assertActiveCanteen = async (id) => {
  validateObjectId(id, "canteen id");
  const canteen = await Canteen.findOne({ _id: id, isActive: true }).lean();
  if (!canteen) throw new AppError("Canteen not found or inactive", 404);
  return canteen;
};

module.exports = {
  archiveCanteen,
  assertActiveCanteen,
  createCanteen,
  getCanteen,
  listCanteens,
  publicCanteen,
  setStatus,
  updateCanteen,
};
