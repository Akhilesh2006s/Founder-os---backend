import { Router } from "express";
import { getDashboardCharts, getDashboardKpis } from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get("/kpis", getDashboardKpis);
dashboardRouter.get("/charts", getDashboardCharts);
