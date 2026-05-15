import mongoose from "mongoose";

const communicationLogSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true, default: Date.now },
    message: { type: String, required: true }
  },
  { _id: true }
);

const updateAssignmentSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    employeeName: { type: String, required: true, trim: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    assignedAt: { type: Date, default: () => new Date() }
  },
  { _id: true }
);

const projectUpdateSchema = new mongoose.Schema(
  {
    note: { type: String, required: true, trim: true },
    reportDate: { type: Date, default: () => new Date() },
    assignments: { type: [updateAssignmentSchema], default: [] }
  },
  { timestamps: true }
);

const clientProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Planning", "Active", "On Hold", "Completed"],
      default: "Active"
    },
    description: { type: String, default: "" },
    updates: { type: [projectUpdateSchema], default: [] }
  },
  { timestamps: true }
);

const clientSchema = new mongoose.Schema(
  {
    company: { type: String, required: true },
    contactPerson: { type: String, required: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    dealValue: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending"],
      default: "Pending"
    },
    contractIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
    invoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }],
    paymentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
    projects: [clientProjectSchema],
    projectSummary: { type: String, default: "" },
    supportStatus: { type: String, enum: ["Healthy", "At Risk"], default: "Healthy" },
    communicationLogs: [communicationLogSchema]
  },
  { timestamps: true }
);

export const ClientModel = mongoose.model("Client", clientSchema);
