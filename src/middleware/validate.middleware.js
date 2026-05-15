import { ApiError } from "../utils/ApiError.js";

export function validateBody(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ApiError(400, "Validation failed", parsed.error.flatten()));
    }
    req.body = parsed.data;
    next();
  };
}
