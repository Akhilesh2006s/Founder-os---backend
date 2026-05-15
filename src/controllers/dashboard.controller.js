import { TaskModel } from "../models/Task.js";
import { ExpenseModel } from "../models/Expense.js";
import { PaymentModel } from "../models/Payment.js";
import { LeadModel } from "../models/Lead.js";
import { ClientModel } from "../models/Client.js";
import { EmployeeModel } from "../models/Employee.js";
import { apiSuccess } from "../utils/apiResponse.js";

export async function getDashboardKpis(_req, res) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    pendingTasks,
    overdueTasks,
    pendingPaymentsAgg,
    activeEmployees,
    leads,
    convertedClients,
    totalExpensesAgg,
    revenueThisMonthAgg
  ] = await Promise.all([
    TaskModel.countDocuments({ status: { $in: ["Pending", "In Progress", "Blocked"] } }),
    TaskModel.countDocuments({ status: "Overdue" }),
    PaymentModel.aggregate([{ $match: { status: "Pending" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    EmployeeModel.countDocuments(),
    LeadModel.countDocuments({ stage: { $nin: ["Won", "Lost"] }, deletedAt: null }),
    ClientModel.countDocuments(),
    ExpenseModel.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
    PaymentModel.aggregate([
      {
        $match: {
          status: "Paid",
          paidAt: { $gte: monthStart },
          invoiceId: { $ne: null }
        }
      },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ])
  ]);

  const expenseMonth = await ExpenseModel.aggregate([
    { $match: { date: { $gte: monthStart } } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  const monthlyBurn = expenseMonth[0]?.total ?? 0;
  const totalRevenuePaid = revenueThisMonthAgg[0]?.total ?? 0;

  return res.json(
    apiSuccess({
      totalRevenue: totalRevenuePaid,
      monthlyRevenue: totalRevenuePaid,
      burnRate: monthlyBurn,
      runwayRemainingMonths: monthlyBurn > 0 ? Math.floor((totalRevenuePaid || 0) / monthlyBurn) : 0,
      totalExpenses: totalExpensesAgg[0]?.total ?? 0,
      pendingPayments: pendingPaymentsAgg[0]?.total ?? 0,
      leads,
      convertedClients,
      activeEmployees,
      pendingTasks,
      overdueTasks
    })
  );
}

/** Last 6 calendar months of expenses & lead volume, plus task status mix */
export async function getDashboardCharts(_req, res) {
  const now = new Date();

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("default", { month: "short" })
    });
  }

  const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [monthlyExpensesAgg, monthlyLeadsAgg, taskStatusBreakdown] = await Promise.all([
    ExpenseModel.aggregate([
      { $match: { date: { $gte: windowStart } } },
      {
        $group: {
          _id: { y: { $year: "$date" }, m: { $month: "$date" } },
          total: { $sum: "$amount" }
        }
      }
    ]),
    LeadModel.aggregate([
      { $match: { createdAt: { $gte: windowStart }, deletedAt: null } },
      {
        $group: {
          _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
          count: { $sum: 1 }
        }
      }
    ]),
    TaskModel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  const expMap = Object.fromEntries(
    monthlyExpensesAgg.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, "0")}`, r.total])
  );
  const leadMap = Object.fromEntries(
    monthlyLeadsAgg.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, "0")}`, r.count])
  );

  return res.json(
    apiSuccess({
      monthlyExpenses: months.map((m) => ({ month: m.label, total: expMap[m.key] ?? 0 })),
      monthlyLeads: months.map((m) => ({ month: m.label, count: leadMap[m.key] ?? 0 })),
      taskStatusBreakdown: taskStatusBreakdown.map((r) => ({ status: r._id, count: r.count }))
    })
  );
}
