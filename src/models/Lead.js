import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    company: { type: String, required: true },
    contactPerson: { type: String, required: true },
    phone: { type: String, default: "" },
    email: { type: String, lowercase: true, trim: true, default: "" },
    source: { type: String, default: "" },
    industry: { type: String, default: "" },
    estimatedDealValue: { type: Number, default: 0 },
    assignedSalesRepId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    followUpDate: { type: Date, default: null },
    notes: { type: String, default: "" },
    stage: {
      type: String,
      enum: ["New Lead", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Won", "Lost"],
      default: "New Lead"
    },
    lostReason: { type: String, default: "" },
    convertedClientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null
    },
    /** Soft-delete — excluded from pipelines and analytics */
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export const LeadModel = mongoose.model("Lead", leadSchema);
