import { Router } from "express";
import { listActivityLogs } from "../controllers/activity.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

export const activityRouter = Router();

activityRouter.use(requireAuth);
activityRouter.use(requireRoles("Founder", "CEO", "HR", "Finance", "Operations"));
activityRouter.get("/", listActivityLogs);
