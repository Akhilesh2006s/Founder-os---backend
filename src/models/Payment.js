import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
    method: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

export const PaymentModel = mongoose.model("Payment", paymentSchema);
