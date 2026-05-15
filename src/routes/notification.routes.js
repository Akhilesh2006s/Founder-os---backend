import { Router } from "express";
import {
  createNotification,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);
notificationRouter.get("/", listMyNotifications);
notificationRouter.patch("/read-all", markAllNotificationsRead);
notificationRouter.patch("/:id/read", markNotificationRead);
notificationRouter.post("/compose", createNotification);
