import mongoose from "mongoose";

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    relation: { type: String, required: true }
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    department: { type: String, required: true },
    role: { type: String, required: true },
    joiningDate: { type: Date, required: true },
    attendanceRate: { type: Number, default: 0 },
    leaveBalance: { type: Number, default: 0 },
    payrollStatus: { type: String, enum: ["Pending", "Processed"], default: "Pending" },
    emergencyContact: { type: emergencyContactSchema, required: true },
    documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }]
  },
  { timestamps: true }
);

export const EmployeeModel = mongoose.model("Employee", employeeSchema);
