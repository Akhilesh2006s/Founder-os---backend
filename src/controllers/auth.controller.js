import bcrypt from "bcryptjs";
import { z } from "zod";
import { clientOrigins, env } from "../config/env.js";
import { UserModel } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { apiSuccess } from "../utils/apiResponse.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from "../services/token.service.js";

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z
    .enum(["Founder", "CEO", "HR", "Finance", "Sales", "Operations", "Employee"])
    .optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

/**
 * Fetch from Vercel → Railway must use SameSite=None; Secure. Lax strips cookies on XHR cross-site,
 * causing 401 on /auth/me after a 200 /auth/login — even if NODE_ENV was left as "development".
 */
function needsCrossSiteAuthCookies() {
  const forced =
    process.env.COOKIE_SAMESITE_NONE === "1" || /^true$/i.test(process.env.COOKIE_SAMESITE_NONE ?? "");
  if (forced) return true;
  if (env.NODE_ENV === "production") return true;
  const hasHttpsPublicOrigin = clientOrigins.some(
    (o) =>
      o.startsWith("https://") && !/^https:\/\/localhost\b/.test(o) && !o.includes("127.0.0.1")
  );
  return hasHttpsPublicOrigin;
}

function authCookieBase() {
  const crossSite = needsCrossSiteAuthCookies();
  return {
    httpOnly: true,
    path: "/",
    secure: crossSite,
    sameSite: crossSite ? "none" : "lax"
  };
}

function tokenPayload(user) {
  return { sub: user._id.toString(), email: user.email, role: user.role };
}

export async function signup(req, res) {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid signup payload", parsed.error.flatten());
  }

  const existing = await UserModel.findOne({ email: parsed.data.email.toLowerCase() });
  if (existing) throw new ApiError(409, "Email already in use");

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await UserModel.create({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    passwordHash,
    role: parsed.data.role ?? "Employee"
  });

  const payload = tokenPayload(user);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();

  res.cookie("accessToken", accessToken, { ...authCookieBase(), maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, { ...authCookieBase(), maxAge: 30 * 24 * 60 * 60 * 1000 });

  return res.status(201).json(
    apiSuccess(
      { user: { id: user._id, name: user.name, email: user.email, role: user.role } },
      "Signup successful"
    )
  );
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid login payload", parsed.error.flatten());

  const user = await UserModel.findOne({ email: parsed.data.email.toLowerCase() });
  if (!user) throw new ApiError(401, "Invalid credentials");

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid credentials");

  const payload = tokenPayload(user);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();

  res.cookie("accessToken", accessToken, { ...authCookieBase(), maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, { ...authCookieBase(), maxAge: 30 * 24 * 60 * 60 * 1000 });

  return res.json(
    apiSuccess(
      { user: { id: user._id, name: user.name, email: user.email, role: user.role } },
      "Login successful"
    )
  );
}

export async function logout(req, res) {
  const rt = req.cookies.refreshToken;
  if (rt) {
    const payload = verifyRefreshToken(rt);
    await UserModel.findByIdAndUpdate(payload.sub, { refreshTokenHash: null });
  }
  const ck = authCookieBase();
  res.clearCookie("accessToken", { path: ck.path, sameSite: ck.sameSite, secure: ck.secure });
  res.clearCookie("refreshToken", { path: ck.path, sameSite: ck.sameSite, secure: ck.secure });
  return res.json(apiSuccess(null, "Logout successful"));
}

export async function refresh(req, res) {
  const rt = req.cookies.refreshToken;
  if (!rt) throw new ApiError(401, "Refresh token missing");

  const payload = verifyRefreshToken(rt);
  const user = await UserModel.findById(payload.sub);
  if (!user || !user.refreshTokenHash) throw new ApiError(401, "Invalid refresh token");

  const ok = await bcrypt.compare(rt, user.refreshTokenHash);
  if (!ok) throw new ApiError(401, "Invalid refresh token");

  const nextPayload = tokenPayload(user);
  const nextAccess = generateAccessToken(nextPayload);
  const nextRefresh = generateRefreshToken(nextPayload);
  user.refreshTokenHash = await bcrypt.hash(nextRefresh, 10);
  await user.save();

  res.cookie("accessToken", nextAccess, { ...authCookieBase(), maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", nextRefresh, { ...authCookieBase(), maxAge: 30 * 24 * 60 * 60 * 1000 });
  return res.json(apiSuccess({ accessToken: nextAccess }, "Token refreshed"));
}

export async function me(req, res) {
  const user = await UserModel.findById(req.user?.id).select("-passwordHash -refreshTokenHash");
  if (!user) throw new ApiError(404, "User not found");
  return res.json(apiSuccess({ user }));
}
