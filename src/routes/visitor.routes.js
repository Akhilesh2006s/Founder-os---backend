import { Router } from "express";
import { createVisitor, deleteVisitor, listVisitors, patchVisitor } from "../controllers/visitor.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

export const visitorRouter = Router();
visitorRouter.use(requireAuth);

visitorRouter.get("/", listVisitors);
visitorRouter.post("/", createVisitor);
visitorRouter.patch("/:id", requireRoles("Founder", "CEO", "HR", "Operations", "Sales"), patchVisitor);
visitorRouter.put("/:id", requireRoles("Founder", "CEO", "HR", "Operations", "Sales"), patchVisitor);
visitorRouter.delete("/:id", requireRoles("Founder", "CEO", "HR", "Operations"), deleteVisitor);
