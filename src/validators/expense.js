import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "Office Rent",
  "Internet",
  "Electricity",
  "Salaries",
  "Cloud Hosting",
  "Marketing",
  "Travel",
  "Software Tools",
  "Miscellaneous"
];

export const expenseCategoryEnum = z.enum([
  "Office Rent",
  "Internet",
  "Electricity",
  "Salaries",
  "Cloud Hosting",
  "Marketing",
  "Travel",
  "Software Tools",
  "Miscellaneous"
]);

export const createExpenseSchema = z.object({
  title: z.string().min(2),
  category: expenseCategoryEnum,
  amount: z.number().positive(),
  date: z.string(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  vendorName: z.string().optional(),
  paymentStatus: z.enum(["Pending", "Paid"]).optional(),
  approvalStatus: z.enum(["Draft", "Pending", "Approved", "Rejected"]).optional()
});

export const updateExpenseSchema = createExpenseSchema.partial();
