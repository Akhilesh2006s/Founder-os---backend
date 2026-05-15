import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

function signToken(secret, payload, expiresIn) {
  return jwt.sign(payload, secret, { expiresIn });
}

export function generateAccessToken(payload) {
  return signToken(env.JWT_ACCESS_SECRET, payload, env.ACCESS_TOKEN_TTL);
}

export function generateRefreshToken(payload) {
  return signToken(env.JWT_REFRESH_SECRET, payload, env.REFRESH_TOKEN_TTL);
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new ApiError(401, "Invalid access token");
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid refresh token");
  }
}
