const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { toSafeUser } = require("../services/authService");

const authenticate = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new AppError("Authentication token is required", 401);
    }

    if (!process.env.JWT_SECRET) {
      throw new AppError("JWT_SECRET is not configured", 500);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new AppError("Invalid authentication token", 401);
    }
    if (
      decoded.sessionVersion !== undefined &&
      decoded.sessionVersion !== (user.sessionVersion || 0)
    ) {
      throw new AppError("Authentication session has been revoked", 401);
    }

    if (user.role === "STAFF" && user.status === "INACTIVE") {
      throw new AppError(
        "Staff account has been deactivated. Please contact your administrator.",
        403
      );
    }

    req.user = toSafeUser(user);
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new AppError("Authentication token has expired", 401));
    }

    if (error.name === "JsonWebTokenError") {
      return next(new AppError("Invalid authentication token", 401));
    }

    next(error);
  }
};

const optionalAuthenticate = (req, res, next) => {
  if (!req.headers.authorization) {
    return next();
  }

  return authenticate(req, res, next);
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return next(new AppError("You are not authorized for this resource", 403));
  }

  next();
};

module.exports = { authenticate, optionalAuthenticate, requireRole };
