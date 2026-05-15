import mongoose from "mongoose";

const invoiceItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    rate: { type: Number, required: true }
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    items: [invoiceItemSchema],
    subtotal: { type: Number, required: true },
    gstPercent: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Unpaid", "Partially Paid", "Paid", "Overdue"],
      default: "Unpaid"
    },
    pdfUrl: { type: String, default: "" },
    billingAddress: { type: String, default: "" },
    shipToGstin: { type: String, default: "" },
    shipFromGstin: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }
  },
  { timestamps: true }
);

export const InvoiceModel = mongoose.model("Invoice", invoiceSchema);
