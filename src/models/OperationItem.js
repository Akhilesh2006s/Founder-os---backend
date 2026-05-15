import mongoose from "mongoose";

const operationItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    type: { type: String, enum: ["SOP", "Checklist", "Vendor", "Procurement", "Issue"], required: true },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Blocked"],
      default: "Pending"
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    dueDate: { type: Date, default: null },
    details: { type: String, default: "" }
  },
  { timestamps: true }
);

export const OperationItemModel = mongoose.model("OperationItem", operationItemSchema);
