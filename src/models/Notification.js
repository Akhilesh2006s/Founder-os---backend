import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["Task", "Payment", "Meeting", "Approval", "FollowUp", "System"],
      required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    readAt: { type: Date, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export const NotificationModel = mongoose.model("Notification", notificationSchema);
