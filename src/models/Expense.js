import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "Office Rent",
        "Internet",
        "Electricity",
        "Salaries",
        "Cloud Hosting",
        "Marketing",
        "Travel",
        "Software Tools",
        "Miscellaneous"
      ],
      required: true
    },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    isRecurring: { type: Boolean, default: false },
    recurrenceRule: { type: String, default: null },
    vendorName: { type: String, default: "" },
    billDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
    paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
    approvalStatus: { type: String, enum: ["Draft", "Pending", "Approved", "Rejected"], default: "Pending" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export const ExpenseModel = mongoose.model("Expense", expenseSchema);
