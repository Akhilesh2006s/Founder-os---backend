import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["Invoice", "Agreement", "Employee", "SOP", "Legal", "Meeting", "Bill", "Other"],
      default: "Other"
    },
    storageProvider: {
      type: String,
      enum: ["Local", "R2"],
      default: "Local"
    },
    storageKey: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export const DocumentModel = mongoose.model("Document", documentSchema);
