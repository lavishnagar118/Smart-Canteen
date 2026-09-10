const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { getFirebaseAuth } = require("../config/firebaseAdmin");

const SALT_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const toSafeUser = (user) => {
  const userObject = user.toObject ? user.toObject() : { ...user };
  delete userObject.password;
  delete userObject.googleId;
  delete userObject.firebaseUid;
  delete userObject.sessionVersion;
  return userObject;
};

const findUser = async (filter, projection = "") => {
  const query = User.findOne(filter);
  return typeof query.select === "function"
    ? query.select(projection)
    : query;
};

const validateRegistrationInput = ({ name, email, password }) => {
  if (!String(name || "").trim() || !email || !password) {
    throw new AppError("Name, email, and password are required", 400);
  }

  if (!EMAIL_PATTERN.test(normalizeEmail(email))) {
    throw new AppError("Please provide a valid email address", 400);
  }

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      400
    );
  }
};

const validateLoginInput = ({ email, password }) => {
  if (!email || !password || !EMAIL_PATTERN.test(normalizeEmail(email))) {
    throw new AppError("Invalid email or password", 401);
  }
};

const createToken = (userId, sessionVersion = 0) => {
  if (!process.env.JWT_SECRET) {
    throw new AppError("JWT_SECRET is not configured", 500);
  }

  return jwt.sign({ userId, sessionVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
};

const registerUser = async ({ name, email, phone, password }) => {
  validateRegistrationInput({ name, email, password });

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new AppError("An account with this email already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(String(password), SALT_ROUNDS);
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    phone: phone ? String(phone).trim() : undefined,
    password: hashedPassword,
    role: "CUSTOMER",
    authProvider: "LOCAL",
  });

  return {
    user: toSafeUser(user),
    token: createToken(user._id.toString(), user.sessionVersion || 0),
  };
};

const loginUser = async ({ email, password }) => {
  validateLoginInput({ email, password });

  const user = await findUser({ email: normalizeEmail(email) }, "+password");
  const passwordMatches = user
    ? Boolean(user.password) && await bcrypt.compare(String(password), user.password)
    : false;

  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  if (user.role === "STAFF" && user.status === "INACTIVE") {
    throw new AppError(
      "Staff account has been deactivated. Please contact your administrator.",
      403
    );
  }

  return {
    user: toSafeUser(user),
    token: createToken(user._id.toString(), user.sessionVersion || 0),
  };
};

const verifyFirebaseCredential = async (idToken, verifier = null) => {
  if (!idToken || typeof idToken !== "string") {
    throw new AppError("Firebase ID token is required", 400);
  }

  try {
    const auth = verifier ? null : getFirebaseAuth();
    const decoded = await (verifier || auth.verifyIdToken.bind(auth))(idToken);
    if (!decoded.uid || !decoded.email || decoded.email_verified !== true) {
      throw new AppError("Firebase account could not be verified", 401);
    }
    return {
      uid: decoded.uid,
      email: normalizeEmail(decoded.email),
      name: String(decoded.name || decoded.email.split("@")[0]).trim(),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Unable to verify Firebase credential", 401);
  }
};

const loginWithFirebase = async ({ idToken }, verifier) => {
  const identity = await verifyFirebaseCredential(idToken, verifier);
  let user = await findUser(
    { firebaseUid: identity.uid },
    "+firebaseUid +googleId +password"
  );

  if (user) {
    if (normalizeEmail(user.email) !== identity.email) {
      throw new AppError("Firebase account is linked to a conflicting user", 409);
    }
  } else {
    user = await findUser(
      { email: identity.email },
      "+firebaseUid +googleId +password"
    );
    if (user?.firebaseUid && user.firebaseUid !== identity.uid) {
      throw new AppError("This email is linked to another Firebase account", 409);
    }

    if (user) {
      user.firebaseUid = identity.uid;
      user.authProvider = user.password ? "LOCAL_FIREBASE" : "FIREBASE";
      await user.save();
    } else {
      try {
        user = await User.create({
          name: identity.name,
          email: identity.email,
          firebaseUid: identity.uid,
          authProvider: "FIREBASE",
          role: "CUSTOMER",
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        user = await findUser(
          { $or: [{ firebaseUid: identity.uid }, { email: identity.email }] },
          "+firebaseUid +googleId +password"
        );
        if (!user) throw error;
      }
    }
  }

  if (user && user.role === "STAFF" && user.status === "INACTIVE") {
    throw new AppError(
      "Staff account has been deactivated. Please contact your administrator.",
      403
    );
  }

  return {
    user: toSafeUser(user),
    token: createToken(user._id.toString(), user.sessionVersion || 0),
  };
};

const logoutUser = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { sessionVersion: 1 } },
    { new: true }
  );
  if (!user) {
    throw new AppError("User not found", 404);
  }
};

module.exports = {
  createToken,
  loginWithFirebase,
  loginUser,
  logoutUser,
  normalizeEmail,
  registerUser,
  toSafeUser,
  verifyFirebaseCredential,
};
