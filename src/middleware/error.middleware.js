import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

export function notFoundHandler(_req, _res, next) {
  next(new ApiError(404, "Route not found"));
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File too large (max 25 MB)" : err.message ?? "Upload error";
    return res.status(400).json({
      success: false,
      message,
      details: null
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details ?? null
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: "Internal server error"
  });
}
