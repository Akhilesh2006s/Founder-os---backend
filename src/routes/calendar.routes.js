import { Router } from "express";
import { getCalendarFeed } from "../controllers/calendar.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const calendarRouter = Router();
calendarRouter.use(requireAuth);
calendarRouter.get("/feed", getCalendarFeed);
