import { z } from "zod";
import mongoose from "mongoose";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  rate: z.number().nonnegative()
});

export const createInvoiceSchema = z.object({
  clientId: z.string().refine((id) => mongoose.isValidObjectId(id), "Invalid clientId"),
  issueDate: z.string(),
  dueDate: z.string(),
  items: z.array(itemSchema).min(1),
  gstPercent: z.number().nonnegative().max(100).optional().default(0),
  billingAddress: z.string().optional(),
  shipToGstin: z.string().optional(),
  shipFromGstin: z.string().optional()
});

const invoiceStatusEnum = z.enum(["Pending", "Unpaid", "Partially Paid", "Paid", "Overdue"]);

export const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  status: invoiceStatusEnum.optional()
});

export const recordInvoicePaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().optional(),
  notes: z.string().optional()
});
