import mongoose from "mongoose";
import { InvoiceModel } from "../models/Invoice.js";
import { ClientModel } from "../models/Client.js";
import { PaymentModel } from "../models/Payment.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { paginateQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/ApiError.js";
import { logActivity } from "../services/activity-log.service.js";
import { createInvoiceSchema, recordInvoicePaymentSchema } from "../validators/finance.js";

function computeTotals(items, gstPercent) {
  const subtotal = items.reduce((sum, row) => sum + row.quantity * row.rate, 0);
  const gstAmount = Math.round(subtotal * (gstPercent / 100) * 100) / 100;
  const total = Math.round((subtotal + gstAmount) * 100) / 100;
  return { subtotal, gstAmount, total };
}

function applyInvoiceStatus(inv) {
  const now = new Date();
  if (inv.paidAmount >= inv.total && inv.total > 0) inv.status = "Paid";
  else if (inv.paidAmount > 0) inv.status = "Partially Paid";
  else if (new Date(inv.dueDate) < now) inv.status = "Overdue";
  else inv.status = "Unpaid";
}

export async function listInvoices(req, res) {
  const filter = {};
  if (req.query.clientId) filter.clientId = req.query.clientId;
  if (req.query.status) filter.status = req.query.status;
  const result = await paginateQuery(InvoiceModel, req.query, filter, ["invoiceNumber", "billingAddress"]);
  return res.json(apiSuccess(result));
}

export async function getInvoice(req, res) {
  const inv = await InvoiceModel.findById(req.params.invoiceId).populate("clientId", "company contactPerson email");
  if (!inv) throw new ApiError(404, "Invoice not found");
  return res.json(apiSuccess(inv));
}

export async function createInvoice(req, res) {
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid invoice", parsed.error.flatten());

  const client = await ClientModel.findById(parsed.data.clientId);
  if (!client) throw new ApiError(404, "Client not found");

  const gstPercent = parsed.data.gstPercent ?? 0;
  const { subtotal, gstAmount, total } = computeTotals(parsed.data.items, gstPercent);

  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const inv = await InvoiceModel.create({
    invoiceNumber,
    clientId: new mongoose.Types.ObjectId(parsed.data.clientId),
    issueDate: new Date(parsed.data.issueDate),
    dueDate: new Date(parsed.data.dueDate),
    items: parsed.data.items,
    subtotal,
    gstPercent,
    gstAmount,
    total,
    paidAmount: 0,
    status: "Unpaid",
    pdfUrl: "",
    billingAddress: parsed.data.billingAddress ?? "",
    shipToGstin: parsed.data.shipToGstin ?? "",
    shipFromGstin: parsed.data.shipFromGstin ?? "",
    createdBy: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined
  });

  applyInvoiceStatus(inv);
  await inv.save();

  await logActivity({
    actorUserId: req.user.id,
    action: "finance.invoice.create",
    entityType: "Invoice",
    entityId: inv._id.toString(),
    after: inv.toObject()
  });

  return res.status(201).json(apiSuccess(inv, "Invoice created"));
}

export async function recordInvoicePayment(req, res) {
  const parsed = recordInvoicePaymentSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payment payload", parsed.error.flatten());

  const inv = await InvoiceModel.findById(req.params.invoiceId);
  if (!inv) throw new ApiError(404, "Invoice not found");

  const before = inv.toObject();
  inv.paidAmount = Math.round((inv.paidAmount + parsed.data.amount) * 100) / 100;
  applyInvoiceStatus(inv);

  await inv.save();

  await PaymentModel.create({
    invoiceId: inv._id,
    amount: parsed.data.amount,
    status: "Paid",
    method: parsed.data.method ?? "",
    paidAt: new Date(),
    notes: parsed.data.notes ?? ""
  });

  await logActivity({
    actorUserId: req.user.id,
    action: "finance.invoice.payment",
    entityType: "Invoice",
    entityId: inv._id.toString(),
    before,
    after: inv.toObject(),
    metadata: { amount: parsed.data.amount }
  });

  return res.json(apiSuccess(inv, "Payment recorded"));
}

/** Placeholder PDF — returns JSON blueprint until PDF engine is wired */
export async function getInvoicePdfBlueprint(req, res) {
  const inv = await InvoiceModel.findById(req.params.invoiceId).populate("clientId");
  if (!inv) throw new ApiError(404, "Invoice not found");
  return res.json(
    apiSuccess({
      invoice: inv,
      pdf: "pending",
      message: "Wire puppeteer/pdfkit worker and return binary or signed R2 URL"
    })
  );
}

export async function getFinanceSummary(_req, res) {
  const [totalsAgg, overdue] = await Promise.all([
    InvoiceModel.aggregate([
      {
        $group: {
          _id: null,
          unpaid: {
            $sum: {
              $cond: [{ $in: ["$status", ["Unpaid", "Partially Paid"]] }, { $subtract: ["$total", "$paidAmount"] }, 0]
            }
          },
          invoiced: { $sum: "$total" },
          collected: { $sum: "$paidAmount" }
        }
      }
    ]),
    InvoiceModel.countDocuments({ status: "Overdue" })
  ]);

  return res.json(
    apiSuccess({
      outstanding: totalsAgg[0]?.unpaid ?? 0,
      totalInvoiced: totalsAgg[0]?.invoiced ?? 0,
      collected: totalsAgg[0]?.collected ?? 0,
      overdueInvoiceCount: overdue
    })
  );
}
