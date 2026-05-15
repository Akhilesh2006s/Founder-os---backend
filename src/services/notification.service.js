import mongoose from "mongoose";
import { NotificationModel } from "../models/Notification.js";

const TYPES = new Set(["Task", "Payment", "Meeting", "Approval", "FollowUp", "System"]);

/** @returns {string[]} mongoose-safe user id strings */
function normalizeUserIds(raw) {
  const out = [...new Set((raw ?? []).map((x) => (x?.toString ? x.toString() : String(x))))].filter(Boolean);
  return out.filter((id) => mongoose.isValidObjectId(id));
}

/** Send the same notification to multiple users (one row per recipient). Skips silently if empty. */
export async function notifyUsers(rawUserIds, { title, message, type, payload }) {
  const safeType = TYPES.has(type) ? type : "System";
  const ids = normalizeUserIds(Array.isArray(rawUserIds) ? rawUserIds : [rawUserIds]);
  if (!ids.length) return;

  const t = String(title ?? "").slice(0, 200);
  const m = String(message ?? "").slice(0, 1200);
  if (!t || !m) return;

  await NotificationModel.insertMany(
    ids.map((userId) => ({
      userId: new mongoose.Types.ObjectId(userId),
      type: safeType,
      title: t,
      message: m,
      payload: payload && typeof payload === "object" ? payload : {}
    }))
  );
}

export function stakeholderIds(task, excludeUserId) {
  const set = new Set();
  for (const a of task.assignees ?? []) set.add(String(a));
  if (task.createdBy) set.add(String(task.createdBy));
  if (excludeUserId) set.delete(String(excludeUserId));
  return [...set].filter((id) => mongoose.isValidObjectId(id));
}
