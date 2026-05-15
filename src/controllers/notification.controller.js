import { NotificationModel } from "../models/Notification.js";
import { composeNotificationSchema } from "../validators/notifications.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { paginateQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/ApiError.js";

export async function listMyNotifications(req, res) {
  const filter = { userId: req.user.id };
  const result = await paginateQuery(NotificationModel, req.query, filter, ["title", "message"]);
  return res.json(apiSuccess(result));
}

export async function markNotificationRead(req, res) {
  const n = await NotificationModel.findOne({ _id: req.params.id, userId: req.user.id });
  if (!n) throw new ApiError(404, "Notification not found");
  n.readAt = new Date();
  await n.save();
  return res.json(apiSuccess(n, "Marked read"));
}

export async function markAllNotificationsRead(req, res) {
  const uid = req.user?.id;
  if (!uid) throw new ApiError(401, "Authentication required");

  await NotificationModel.updateMany({ userId: uid, readAt: null }, { $set: { readAt: new Date() } });
  return res.json(apiSuccess({ ok: true }, "All notifications marked read"));
}

/** Compose for current user (tests / integrations) */
export async function createNotification(req, res) {
  const parsed = composeNotificationSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const type = parsed.data.type ?? "System";

  const n = await NotificationModel.create({
    userId: req.user.id,
    type,
    title: parsed.data.title,
    message: parsed.data.message,
    payload: parsed.data.payload ?? {}
  });

  return res.status(201).json(apiSuccess(n, "Created"));
}
