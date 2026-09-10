const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Canteen = require("../models/Canteen");
const AppError = require("../utils/AppError");
const validateObjectId = require("../utils/validateObjectId");

const SALT_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const toSafeStaff = (user) => {
  const doc = user.toObject ? user.toObject() : { ...user };
  delete doc.password;
  delete doc.googleId;
  delete doc.firebaseUid;
  delete doc.sessionVersion;
  return doc;
};

const generateStaffId = async () => {
  const staffMembers = await User.find({
    role: "STAFF",
    staffId: { $exists: true, $ne: null },
  })
    .select("staffId")
    .lean();

  let maxNum = 0;
  for (const s of staffMembers) {
    if (s.staffId) {
      const match = s.staffId.match(/^STF-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  let nextNum = maxNum + 1;
  let candidate = `STF-${String(nextNum).padStart(4, "0")}`;
  while (await User.exists({ staffId: candidate })) {
    nextNum += 1;
    candidate = `STF-${String(nextNum).padStart(4, "0")}`;
  }
  return candidate;
};

const listStaff = async (query = {}) => {
  const filter = { role: "STAFF" };

  if (query.status && ["ACTIVE", "INACTIVE"].includes(query.status)) {
    filter.status = query.status;
  }

  if (query.canteenId) {
    validateObjectId(query.canteenId, "canteen id");
    filter.canteen = query.canteenId;
  }

  if (query.search) {
    const searchRegex = new RegExp(String(query.search).trim(), "i");
    filter.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { staffId: searchRegex },
      { phone: searchRegex },
    ];
  }

  const [staffList, totalStaff, activeStaff, inactiveStaff] = await Promise.all([
    User.find(filter)
      .populate("canteen", "name location")
      .select("-password -googleId -firebaseUid -sessionVersion")
      .sort({ createdAt: -1 })
      .lean(),
    User.countDocuments({ role: "STAFF" }),
    User.countDocuments({ role: "STAFF", status: "ACTIVE" }),
    User.countDocuments({ role: "STAFF", status: "INACTIVE" }),
  ]);

  // Ensure any existing staff without a staffId gets populated
  for (const member of staffList) {
    if (!member.staffId) {
      const generated = await generateStaffId();
      await User.updateOne({ _id: member._id }, { staffId: generated });
      member.staffId = generated;
    }
  }

  return {
    staff: staffList.map(toSafeStaff),
    metrics: {
      totalStaff,
      activeStaff,
      inactiveStaff,
    },
  };
};

const createStaff = async ({ name, email, phone, canteenId, password, confirmPassword }) => {
  if (!String(name || "").trim() || !email || !password) {
    throw new AppError("Name, email, and password are required", 400);
  }

  const normalizedEmail = normalizeEmail(email);
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new AppError("Please provide a valid email address", 400);
  }

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      400
    );
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new AppError("Passwords do not match", 400);
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  let assignedCanteen = null;
  if (canteenId) {
    validateObjectId(canteenId, "canteen id");
    const canteen = await Canteen.findById(canteenId);
    if (!canteen) {
      throw new AppError("Selected canteen does not exist", 404);
    }
    assignedCanteen = canteen._id;
  }

  const staffId = await generateStaffId();
  const hashedPassword = await bcrypt.hash(String(password), SALT_ROUNDS);

  const staff = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    phone: phone ? String(phone).trim() : undefined,
    staffId,
    canteen: assignedCanteen,
    password: hashedPassword,
    role: "STAFF", // STRICTLY ENFORCED: Backend never trusts client role
    status: "ACTIVE",
    authProvider: "LOCAL",
  });

  const populated = await User.findById(staff._id)
    .populate("canteen", "name location")
    .select("-password -googleId -firebaseUid -sessionVersion");

  return toSafeStaff(populated);
};

const getStaffById = async (id) => {
  validateObjectId(id, "staff id");
  const staff = await User.findOne({ _id: id, role: "STAFF" })
    .populate("canteen", "name location")
    .select("-password -googleId -firebaseUid -sessionVersion");

  if (!staff) {
    throw new AppError("Staff member not found", 404);
  }

  return toSafeStaff(staff);
};

const updateStaff = async (id, data = {}) => {
  validateObjectId(id, "staff id");
  const staff = await User.findOne({ _id: id, role: "STAFF" });

  if (!staff) {
    throw new AppError("Staff member not found", 404);
  }

  if (data.name !== undefined) {
    if (!String(data.name).trim()) {
      throw new AppError("Name cannot be empty", 400);
    }
    staff.name = String(data.name).trim();
  }

  if (data.phone !== undefined) {
    staff.phone = data.phone ? String(data.phone).trim() : undefined;
  }

  if (data.canteenId !== undefined) {
    if (data.canteenId) {
      validateObjectId(data.canteenId, "canteen id");
      const canteen = await Canteen.findById(data.canteenId);
      if (!canteen) {
        throw new AppError("Selected canteen does not exist", 404);
      }
      staff.canteen = canteen._id;
    } else {
      staff.canteen = null;
    }
  }

  if (data.status !== undefined) {
    if (!["ACTIVE", "INACTIVE"].includes(data.status)) {
      throw new AppError("Invalid status. Must be ACTIVE or INACTIVE", 400);
    }
    if (staff.status !== data.status && data.status === "INACTIVE") {
      staff.sessionVersion = (staff.sessionVersion || 0) + 1;
    }
    staff.status = data.status;
  }

  // Ensure role is never changed
  staff.role = "STAFF";

  await staff.save();

  const populated = await User.findById(staff._id)
    .populate("canteen", "name location")
    .select("-password -googleId -firebaseUid -sessionVersion");

  return toSafeStaff(populated);
};

const updateStaffStatus = async (id, status) => {
  validateObjectId(id, "staff id");

  if (!["ACTIVE", "INACTIVE"].includes(status)) {
    throw new AppError("Status must be ACTIVE or INACTIVE", 400);
  }

  const staff = await User.findOne({ _id: id, role: "STAFF" });
  if (!staff) {
    throw new AppError("Staff member not found", 404);
  }

  staff.status = status;
  if (status === "INACTIVE") {
    staff.sessionVersion = (staff.sessionVersion || 0) + 1;
  }

  await staff.save();

  const populated = await User.findById(staff._id)
    .populate("canteen", "name location")
    .select("-password -googleId -firebaseUid -sessionVersion");

  return toSafeStaff(populated);
};

const resetStaffPassword = async (id, password, confirmPassword) => {
  validateObjectId(id, "staff id");

  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      400
    );
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new AppError("Passwords do not match", 400);
  }

  const staff = await User.findOne({ _id: id, role: "STAFF" });
  if (!staff) {
    throw new AppError("Staff member not found", 404);
  }

  const hashedPassword = await bcrypt.hash(String(password), SALT_ROUNDS);
  staff.password = hashedPassword;
  staff.sessionVersion = (staff.sessionVersion || 0) + 1;

  await staff.save();

  const populated = await User.findById(staff._id)
    .populate("canteen", "name location")
    .select("-password -googleId -firebaseUid -sessionVersion");

  return toSafeStaff(populated);
};

module.exports = {
  createStaff,
  generateStaffId,
  getStaffById,
  listStaff,
  resetStaffPassword,
  toSafeStaff,
  updateStaff,
  updateStaffStatus,
};
