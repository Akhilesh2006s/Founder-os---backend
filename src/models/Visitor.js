import mongoose from "mongoose";

const visitorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    purpose: { type: String, required: true },
    contact: { type: String, default: "" },
    meetingWithEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    meetingRoom: { type: String, default: "" },
    approvalStatus: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    securityNotes: { type: String, default: "" }
  },
  { timestamps: true }
);

export const VisitorModel = mongoose.model("Visitor", visitorSchema);
