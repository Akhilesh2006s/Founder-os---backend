import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../services/token.service.js";

export function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies.accessToken;

  if (!token) {
    return next(new ApiError(401, "Authentication required"));
  }

  const payload = verifyAccessToken(token);
  req.user = { id: payload.sub, role: payload.role, email: payload.email };
  next();
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "Insufficient permissions"));
    }
    next();
  };
}
