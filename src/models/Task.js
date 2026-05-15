import mongoose from "mongoose";

const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  done: { type: Boolean, default: false }
});

const commentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true }
  },
  { timestamps: true, _id: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    mimeType: { type: String, required: true }
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Blocked", "Completed", "Overdue", "Archived"],
      default: "Pending"
    },
    priority: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Medium" },
    type: {
      type: String,
      enum: ["One-time", "Daily", "Weekly", "Monthly", "Recurring"],
      default: "One-time"
    },
    dueDate: { type: Date, default: null },
    recurrenceRule: { type: String, default: null },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    subtasks: [subtaskSchema],
    comments: [commentSchema],
    attachments: [attachmentSchema],
    linkedClientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null },
    linkedProject: { type: String, default: "" },
    /** Daily update note this task was spawned from (portfolio assign flow). */
    sourceUpdateId: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export const TaskModel = mongoose.model("Task", taskSchema);
