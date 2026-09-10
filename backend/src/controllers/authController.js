const {
  loginUser,
  loginWithFirebase,
  logoutUser,
  registerUser,
  toSafeUser,
} = require("../services/authService");

const register = async (req, res, next) => {
  try {
    const result = await registerUser(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await loginUser(req.body || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const firebase = async (req, res, next) => {
  try {
    const result = await loginWithFirebase(req.body || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await logoutUser(req.user._id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const getCurrentUser = (req, res) => {
  res.status(200).json({ user: toSafeUser(req.user) });
};

module.exports = { getCurrentUser, firebase, login, logout, register };
