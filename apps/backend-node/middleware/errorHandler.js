import { config } from "../config/env.js";

export const errorHandler = (err, req, res, next) => {
  console.error("Unhandled Error:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    detail: message,
    stack: config.NODE_ENV === "development" ? err.stack : undefined
  });
};
