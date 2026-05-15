import { Router } from "express";
import {
  createEmployee,
  deleteEmployee,
  getEmployee,
  getEmployeeAssignedWork,
  listEmployees,
  listEmployeesTodoSummary,
  updateEmployee
} from "../controllers/employee.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const mutateRoles = ["Founder", "CEO", "HR", "Operations"];

export const employeeRouter = Router();
employeeRouter.use(requireAuth);

employeeRouter.get("/", listEmployees);
employeeRouter.get("/todo-summary", listEmployeesTodoSummary);
employeeRouter.get("/:id/assigned-work", getEmployeeAssignedWork);
employeeRouter.get("/:id", getEmployee);
employeeRouter.post("/", requireRoles(...mutateRoles), createEmployee);
employeeRouter.patch("/:id", requireRoles(...mutateRoles), updateEmployee);
employeeRouter.delete("/:id", requireRoles(...mutateRoles), deleteEmployee);
