import { ExpenseModel } from "../models/Expense.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { paginateQuery } from "../utils/pagination.js";
import { logActivity } from "../services/activity-log.service.js";
import { ApiError } from "../utils/ApiError.js";
import {
  createExpenseSchema,
  updateExpenseSchema,
  EXPENSE_CATEGORIES
} from "../validators/expense.js";

export async function listExpenses(req, res) {
  const filter = {};
  if (req.query.category) filter.category = String(req.query.category);
  if (req.query.paymentStatus) filter.paymentStatus = String(req.query.paymentStatus);
  if (req.query.approvalStatus) filter.approvalStatus = String(req.query.approvalStatus);

  const result = await paginateQuery(ExpenseModel, req.query, filter, [
    "title",
    "category",
    "vendorName"
  ]);
  return res.json(apiSuccess(result));
}

export async function getExpenseAnalytics(_req, res) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [byCategoryRaw, monthlyBurn, lastMonthBurn, recurringLiability] = await Promise.all([
    ExpenseModel.aggregate([
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]),
    ExpenseModel.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    ExpenseModel.aggregate([
      { $match: { date: { $gte: startLastMonth, $lte: endLastMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    ExpenseModel.aggregate([
      { $match: { isRecurring: true, paymentStatus: "Pending" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
    ])
  ]);

  const categoryMap = Object.fromEntries(byCategoryRaw.map((c) => [c._id, c.total]));
  const byCategory = EXPENSE_CATEGORIES.map((cat) => ({
    category: cat,
    total: categoryMap[cat] ?? 0
  }));

  return res.json(
    apiSuccess({
      monthlyBurn: monthlyBurn[0]?.total ?? 0,
      lastMonthBurn: lastMonthBurn[0]?.total ?? 0,
      byCategory,
      recurringLiability: recurringLiability[0]?.total ?? 0,
      recurringCount: recurringLiability[0]?.count ?? 0
    })
  );
}

export async function getExpenseById(req, res) {
  const expense = await ExpenseModel.findById(req.params.expenseId).populate("createdBy", "name email role");
  if (!expense) throw new ApiError(404, "Expense not found");
  return res.json(apiSuccess(expense));
}

export async function createExpense(req, res) {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid expense payload", parsed.error.flatten());

  const expense = await ExpenseModel.create({
    ...parsed.data,
    date: new Date(parsed.data.date),
    createdBy: req.user.id
  });

  await logActivity({
    actorUserId: req.user.id,
    action: "expense.create",
    entityType: "Expense",
    entityId: expense._id.toString(),
    after: expense.toObject()
  });

  return res.status(201).json(apiSuccess(expense, "Expense created"));
}

export async function updateExpense(req, res) {
  const parsed = updateExpenseSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid expense payload", parsed.error.flatten());

  const expense = await ExpenseModel.findById(req.params.expenseId);
  if (!expense) throw new ApiError(404, "Expense not found");

  const before = expense.toObject();

  Object.assign(expense, {
    ...parsed.data,
    ...(parsed.data.date !== undefined ? { date: new Date(parsed.data.date) } : {})
  });

  await expense.save();

  await logActivity({
    actorUserId: req.user.id,
    action: "expense.update",
    entityType: "Expense",
    entityId: expense._id.toString(),
    before,
    after: expense.toObject()
  });

  return res.json(apiSuccess(expense, "Expense updated"));
}

export async function patchExpenseApproval(req, res) {
  const parsed = updateExpenseSchema.pick({ approvalStatus: true }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());
  if (!parsed.data.approvalStatus) throw new ApiError(400, "approvalStatus required");

  const expense = await ExpenseModel.findById(req.params.expenseId);
  if (!expense) throw new ApiError(404, "Expense not found");

  const before = expense.toObject();
  expense.approvalStatus = parsed.data.approvalStatus;
  await expense.save();

  await logActivity({
    actorUserId: req.user.id,
    action: "expense.approval",
    entityType: "Expense",
    entityId: expense._id.toString(),
    before,
    after: expense.toObject()
  });

  return res.json(apiSuccess(expense, "Approval updated"));
}

export async function patchExpensePayment(req, res) {
  const parsed = updateExpenseSchema.pick({ paymentStatus: true }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());
  if (!parsed.data.paymentStatus) throw new ApiError(400, "paymentStatus required");

  const expense = await ExpenseModel.findById(req.params.expenseId);
  if (!expense) throw new ApiError(404, "Expense not found");

  const before = expense.toObject();
  expense.paymentStatus = parsed.data.paymentStatus;
  await expense.save();

  await logActivity({
    actorUserId: req.user.id,
    action: "expense.payment",
    entityType: "Expense",
    entityId: expense._id.toString(),
    before,
    after: expense.toObject()
  });

  return res.json(apiSuccess(expense, "Payment status updated"));
}

export async function deleteExpense(req, res) {
  const expense = await ExpenseModel.findById(req.params.expenseId);
  if (!expense) throw new ApiError(404, "Expense not found");

  const before = expense.toObject();
  await expense.deleteOne();

  await logActivity({
    actorUserId: req.user.id,
    action: "expense.delete",
    entityType: "Expense",
    entityId: req.params.expenseId,
    before
  });

  return res.json(apiSuccess(null, "Expense deleted successfully"));
}
