import mongoose from "mongoose";

export const USER_ROLES = [
  "Founder",
  "CEO",
  "HR",
  "Finance",
  "Sales",
  "Operations",
  "Employee"
];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: "Employee" },
    refreshTokenHash: { type: String, default: null }
  },
  { timestamps: true }
);

export const UserModel = mongoose.model("User", userSchema);
