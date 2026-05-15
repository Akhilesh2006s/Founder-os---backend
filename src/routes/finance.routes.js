import { Router } from "express";
import {
  createInvoice,
  updateInvoice,
  getFinanceSummary,
  getInvoice,
  getInvoicePdfBlueprint,
  listInvoices,
  recordInvoicePayment
} from "../controllers/finance.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const financeRoles = ["Founder", "CEO", "Finance"];
const financeReadRoles = ["Founder", "CEO", "Finance", "Operations", "Sales"];

export const financeRouter = Router();

financeRouter.use(requireAuth);

financeRouter.get("/summary", requireRoles(...financeReadRoles), getFinanceSummary);
financeRouter.get("/invoices", requireRoles(...financeReadRoles), listInvoices);
financeRouter.post("/invoices", requireRoles(...financeRoles), createInvoice);
financeRouter.patch("/invoices/:invoiceId", requireRoles(...financeRoles), updateInvoice);
financeRouter.get("/invoices/:invoiceId", requireRoles(...financeReadRoles), getInvoice);
financeRouter.post("/invoices/:invoiceId/payments", requireRoles(...financeRoles), recordInvoicePayment);
financeRouter.get("/invoices/:invoiceId/pdf-blueprint", requireRoles(...financeReadRoles), getInvoicePdfBlueprint);
