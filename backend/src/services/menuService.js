const MenuItem = require("../models/MenuItem");
const Canteen = require("../models/Canteen");
const AppError = require("../utils/AppError");
const validateObjectId = require("../utils/validateObjectId");

const CREATE_FIELDS = [
  "name",
  "description",
  "price",
  "category",
  "imageUrl",
  "preparationTime",
  "canteen",
  "tasteTags",
];
const UPDATE_FIELDS = CREATE_FIELDS;
const MENU_ROLES = ["STAFF", "ADMIN"];

const hasOnlyAllowedFields = (data, allowedFields) =>
  Object.keys(data).every((field) => allowedFields.includes(field));

const validateText = (value, fieldName, required = false) => {
  if (required && (typeof value !== "string" || !value.trim())) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new AppError(`${fieldName} must be a string`, 400);
  }
};

const validateMenuFields = (data, { requireCreateFields = false } = {}) => {
  validateText(data.name, "name", requireCreateFields);
  validateText(data.category, "category", requireCreateFields);
  validateText(data.description, "description");
  validateText(data.imageUrl, "imageUrl");

  ["name", "category"].forEach((field) => {
    if (data[field] !== undefined && !data[field].trim()) {
      throw new AppError(`${field} must not be blank`, 400);
    }
  });

  if (
    requireCreateFields &&
    (data.price === undefined || data.price === null)
  ) {
    throw new AppError("price is required", 400);
  }
  if (
    requireCreateFields &&
    (data.preparationTime === undefined || data.preparationTime === null)
  ) {
    throw new AppError("preparationTime is required", 400);
  }
  if (data.price !== undefined && (!Number.isFinite(data.price) || data.price <= 0)) {
    throw new AppError("price must be greater than 0", 400);
  }
  if (
    data.preparationTime !== undefined &&
    (!Number.isFinite(data.preparationTime) || data.preparationTime < 0)
  ) {
    throw new AppError("preparationTime must be greater than or equal to 0", 400);
  }
  if (data.tasteTags !== undefined) {
    if (!Array.isArray(data.tasteTags) || !data.tasteTags.every((t) => typeof t === "string")) {
      throw new AppError("tasteTags must be an array of strings", 400);
    }
  }
};

const sanitizeMenuData = (data) => {
  const sanitized = { ...data };
  ["name", "description", "category", "imageUrl"].forEach((field) => {
    if (typeof sanitized[field] === "string") {
      sanitized[field] = sanitized[field].trim();
    }
  });
  if (Array.isArray(sanitized.tasteTags)) {
    sanitized.tasteTags = sanitized.tasteTags.map((t) => t.trim()).filter(Boolean);
  }
  return sanitized;
};

const assertAllowedFields = (data, fields) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new AppError("Request body must be an object", 400);
  }
  if (!hasOnlyAllowedFields(data, fields)) {
    throw new AppError("Request contains invalid fields", 400);
  }
};

const isStaffOrAdmin = (user) => user && MENU_ROLES.includes(user.role);

const validateCanteen = async (canteenId) => {
  if (canteenId === undefined) return;
  validateObjectId(canteenId, "canteen id");
  const canteen = await Canteen.findOne({ _id: canteenId, isActive: true }).lean();
  if (!canteen) throw new AppError("Canteen not found or inactive", 400);
};

const createMenuItem = async (data) => {
  assertAllowedFields(data, CREATE_FIELDS);
  validateMenuFields(data, { requireCreateFields: true });
  await validateCanteen(data.canteen);
  const item = await MenuItem.create({
    ...sanitizeMenuData(data),
    isAvailable: true,
  });
  return item;
};

const getMenuItemById = async (id, user) => {
  validateObjectId(id, "menu item id");
  const item = await MenuItem.findById(id).lean();

  if (!item || (!item.isAvailable && !isStaffOrAdmin(user))) {
    throw new AppError("Menu item not found", 404);
  }

  return item;
};

const getMenu = async ({ query, user, canteenId }) => {
  const {
    category,
    available,
    search,
    taste,
    page = "1",
    limit = "20",
  } = query;
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    throw new AppError("page must be a positive integer", 400);
  }
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    throw new AppError("limit must be an integer between 1 and 100", 400);
  }

  const privileged = isStaffOrAdmin(user);
  const filter = {};
  if (canteenId) {
    validateObjectId(canteenId, "canteen id");
    filter.canteen = canteenId;
  }

  if (category !== undefined) {
    if (typeof category !== "string" || !category.trim()) {
      throw new AppError("category must be a non-empty string", 400);
    }
    filter.category = category.trim();
  }
  if (search !== undefined) {
    if (typeof search !== "string" || !search.trim()) {
      throw new AppError("search must be a non-empty string", 400);
    }
    filter.name = { $regex: search.trim(), $options: "i" };
  }
  if (taste !== undefined && taste !== "All" && taste !== "") {
    if (typeof taste !== "string" || !taste.trim()) {
      throw new AppError("taste must be a non-empty string", 400);
    }
    filter.tasteTags = taste.trim();
  }

  if (!privileged) {
    filter.isAvailable = true;
  } else if (available === undefined) {
    // Staff and admins can see all menu items when no availability filter is set.
  } else if (available === "true") {
    filter.isAvailable = true;
  } else if (available === "false") {
    filter.isAvailable = false;
  } else {
    throw new AppError("available must be true or false", 400);
  }

  const skip = (parsedPage - 1) * parsedLimit;
  const [items, totalItems] = await Promise.all([
    MenuItem.find(filter)
      .sort({ category: 1, name: 1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    MenuItem.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      totalItems,
      totalPages: Math.ceil(totalItems / parsedLimit),
    },
  };
};

const updateMenuItem = async (id, data) => {
  validateObjectId(id, "menu item id");
  assertAllowedFields(data, UPDATE_FIELDS);
  if (Object.keys(data).length === 0) {
    throw new AppError("At least one menu field is required", 400);
  }
  validateMenuFields(data);
  await validateCanteen(data.canteen);

  const item = await MenuItem.findByIdAndUpdate(
    id,
    sanitizeMenuData(data),
    { new: true, runValidators: true }
  ).lean();

  if (!item) {
    throw new AppError("Menu item not found", 404);
  }
  return item;
};

const updateAvailability = async (id, isAvailable) => {
  validateObjectId(id, "menu item id");
  if (typeof isAvailable !== "boolean") {
    throw new AppError("isAvailable must be a boolean", 400);
  }

  const item = await MenuItem.findByIdAndUpdate(
    id,
    { isAvailable },
    { new: true, runValidators: true }
  ).lean();

  if (!item) {
    throw new AppError("Menu item not found", 404);
  }
  return item;
};

const archiveMenuItem = async (id) => {
  validateObjectId(id, "menu item id");
  const item = await MenuItem.findByIdAndUpdate(
    id,
    { isAvailable: false },
    { new: true, runValidators: true }
  ).lean();

  if (!item) {
    throw new AppError("Menu item not found", 404);
  }
  return item;
};

module.exports = {
  archiveMenuItem,
  createMenuItem,
  getMenu,
  getMenuItemById,
  updateAvailability,
  updateMenuItem,
};
