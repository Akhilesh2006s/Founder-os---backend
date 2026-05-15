/**
 * Creates or updates one user account (plain password hashed with bcrypt).
 *
 * Either:
 *   npm run seed:user -- amenityforge@gmail.com Amenity26
 * or set SEED_EMAIL + SEED_PASSWORD in backend/.env and run npm run seed:user
 */
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { UserModel } from "../src/models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const emailArg = process.argv[2];
const passwordArg = process.argv[3];

const email = (
  emailArg ||
  process.env.SEED_EMAIL ||
  ""
).toLowerCase().trim();

const password = passwordArg ?? process.env.SEED_PASSWORD ?? "";
const name =
  process.argv[4] ||
  process.env.SEED_NAME ||
  email.split("@")[0] ||
  "Admin";
const role = process.argv[5] ?? process.env.SEED_ROLE ?? "Founder";

const allowedRoles = ["Founder", "CEO", "HR", "Finance", "Sales", "Operations", "Employee"];
const safeRole = allowedRoles.includes(role) ? role : "Founder";

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in backend/.env");
    process.exit(1);
  }
  if (!email || !email.includes("@")) {
    console.error("Provide email as first CLI arg or set SEED_EMAIL in .env");
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error("Password required (min 8 chars): second CLI arg or SEED_PASSWORD in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await UserModel.findOne({ email });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.name = name;
    existing.role = safeRole;
    await existing.save();
    console.log(`Updated user ${email} (role=${safeRole}). You can log in with that password.`);
  } else {
    await UserModel.create({
      email,
      passwordHash,
      name,
      role: safeRole
    });
    console.log(`Created user ${email} (role=${safeRole}). You can log in on /login.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
