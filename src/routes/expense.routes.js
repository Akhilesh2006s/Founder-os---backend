import { Router } from "express";
import {
  createExpense,
  deleteExpense,
  getExpenseAnalytics,
  getExpenseById,
  listExpenses,
  patchExpenseApproval,
  patchExpensePayment,
  updateExpense
} from "../controllers/expense.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const financeRoles = ["Founder", "CEO", "Finance", "Operations", "HR"];

export const expenseRouter = Router();

expenseRouter.use(requireAuth);

expenseRouter.get("/analytics/summary", requireRoles(...financeRoles), getExpenseAnalytics);
expenseRouter.get("/", listExpenses);
expenseRouter.post("/", requireRoles(...financeRoles), createExpense);

expenseRouter.get("/:expenseId", getExpenseById);
expenseRouter.patch("/:expenseId", requireRoles(...financeRoles), updateExpense);
expenseRouter.delete("/:expenseId", requireRoles(...financeRoles), deleteExpense);
expenseRouter.patch("/:expenseId/approval", requireRoles(...financeRoles), patchExpenseApproval);
expenseRouter.patch("/:expenseId/payment", requireRoles(...financeRoles), patchExpensePayment);
