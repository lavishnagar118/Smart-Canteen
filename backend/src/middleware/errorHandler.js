const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    status: "ERROR",
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
  });
};

const errorHandler = (err, req, res, next) => {
  const statusCode =
    err.statusCode ||
    (err.code === 11000 ? 409 : 0) ||
    (err.name === "ValidationError" ? 400 : 0) ||
    (res.statusCode >= 400 ? res.statusCode : 500);

  console.error(err.stack || err.message);

  let message = err.message;
  if (err.code === 11000) {
    message = "An account with this email already exists";
  } else if (err.name === "ValidationError") {
    message = "Validation failed";
  } else if (statusCode >= 500) {
    message = "Internal server error";
  }

  res.status(statusCode).json({
    success: false,
    status: "ERROR",
    message,
    data: null,
  });
};

module.exports = { notFound, errorHandler };
