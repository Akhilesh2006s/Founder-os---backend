import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 30 },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    notes: { type: String, default: "" },
    decisions: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

meetingSchema.set("toJSON", { virtuals: true });
meetingSchema.set("toObject", { virtuals: true });

meetingSchema.virtual("startTime").get(function getStartTime() {
  return this.scheduledAt ?? null;
});

meetingSchema.virtual("endTime").get(function getEndTime() {
  if (!this.scheduledAt) return null;
  const mins = typeof this.durationMinutes === "number" ? this.durationMinutes : 30;
  return new Date(this.scheduledAt.getTime() + mins * 60 * 1000);
});

export const MeetingModel = mongoose.model("Meeting", meetingSchema);
